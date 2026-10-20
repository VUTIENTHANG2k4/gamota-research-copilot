"""Local MOCK of the backend for UI tests only. It never calls the model and never touches the real run history.

What is real and what is fake:
  * The FastAPI routes, response shapes, review logic (confidence and Mission 3 trust tiers recomputed by code),
    stale-memo logic, the follow-up endpoint (context building, chain limit, inherited review decisions) and the
    chunk endpoint are the REAL code from api/main.py, api/service.py, app/trust.py, app/memo.py and the real
    database (read-only: chunks).
  * Runs live in memory. Fixture runs are built from saved results (real pipeline output, used here only as sample
    data for the UI):
      - mockq1: runs/p4/round_1/Q1 (Mission 2 run: memo without tiers, claims without relevance labels)
      - m3q1..m3q5, m3a, m3b: runs/m3/layer_a/<key> (M3 code on saved M2 model outputs; p2 from runs/p4/round_1)
      - r1-<key>: every finished item under runs/m3/round_1 (live M3 outputs; follow-ups T14/T15 when present,
        with their context.json and inherited reviews.json)
  * The quota-spending jobs (pipeline run, follow-up run and memo rewrite) are replaced by timed simulations.
    A new question finishes with the content of the M3 Q1 fixture; a follow-up finishes with a copy of its PARENT's
    content (so inherited decisions can be seen), the memo rebuilt by the real memo code from the saved sentences.
    Questions containing LOI end in an error; VAGUE asks for clarification; a follow-up containing KHAC is treated
    as unrelated to its parent (nothing inherited).
  * /mock/* switches force special states: ingest, busy, dbdown, memofail.

Start (repo root, backend on 8000 untouched):
  .venv\\Scripts\\python frontend\\tests\\mock_api.py            # listens on :8001
Point the UI at it:  NEXT_PUBLIC_API_URL=http://localhost:8001 npx next dev -p 3001
"""
import copy
import json
import os
import sys
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)
os.environ["SKIP_STARTUP_JOBS"] = "1"
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3001,http://127.0.0.1:3001,http://localhost:3000")

import psycopg  # noqa: E402
import uvicorn  # noqa: E402

from api import main as m  # noqa: E402
from api import service, store  # noqa: E402
from app import db  # noqa: E402
from app import memo as memo_mod  # noqa: E402
from app.memo import MemoOut  # noqa: E402

STEP_S = float(os.getenv("MOCK_STEP_S", "5"))
FLAGS = {"busy": False, "dbdown": False, "memofail": False}
RUNS: dict[str, dict] = {}
REVIEWS: dict[str, dict[str, dict]] = {}
P4 = ROOT / "runs" / "p4" / "round_1"
M3A = ROOT / "runs" / "m3" / "layer_a"
M3R1 = ROOT / "runs" / "m3" / "round_1"
LAYER_A_KEYS = ["Q1", "Q2", "Q3", "Q4", "Q5", "A", "B"]
LOCK = threading.Lock()


def now() -> datetime:
    return datetime.now(timezone.utc)


def jload(path: Path):
    return json.load(open(path, encoding="utf-8"))


def done_run(run_id: str, minutes_ago: int, p2: dict, p3: dict, memo: dict, **kw) -> dict:
    t = now() - timedelta(minutes=minutes_ago)
    run = {"id": run_id, "question": p2["question"], "parent_id": None, "created_by": None, "context": None,
           "status": "done", "stage": "xong", "error": None, "created_at": t, "finished_at": t + timedelta(minutes=4),
           "brief": p2["brief"], "p2": p2, "p3": p3, "memo": memo, "memo_status": "fresh", "memo_error": None,
           "memo_generated_at": t + timedelta(minutes=4)}
    run.update(kw)
    return run


def blank(run_id: str, question: str, minutes_ago: int, **kw) -> dict:
    t = now() - timedelta(minutes=minutes_ago)
    base = {"id": run_id, "question": question, "parent_id": None, "created_by": None, "context": None, "status": "queued",
            "stage": "chờ xử lý", "error": None, "created_at": t, "finished_at": None, "brief": None, "p2": None, "p3": None,
            "memo": None, "memo_status": "none", "memo_error": None, "memo_generated_at": None}
    base.update(kw)
    return base


def layer_a(key: str, minutes_ago: int) -> dict:
    """M3 decision code on saved M2 outputs: p3 + memo from runs/m3/layer_a, p2 (retrieval, rejected claims) from P4."""
    return done_run(f"m3{key.lower()}", minutes_ago, jload(P4 / key / "p2.json"), jload(M3A / key / "p3.json"),
                    jload(M3A / key / "memo_real.json"))


def round_1() -> list[dict]:
    """Every finished live M3 item; follow-ups (context.json) are linked to their parent's fixture."""
    if not M3R1.exists():
        return []
    out, reviews = [], {}
    dirs = sorted(d for d in M3R1.iterdir() if d.is_dir() and all((d / f).exists() for f in ("p2.json", "p3.json", "memo_real.json")))
    for i, d in enumerate(dirs):
        rid = f"r1-{d.name.lower()}"
        p2, p3, memo = jload(d / "p2.json"), jload(d / "p3.json"), jload(d / "memo_real.json")
        kw = {}
        if (d / "context.json").exists():
            ctx = jload(d / "context.json")
            parent = f"r1-{str(ctx['parent_id']).lower()}"
            if not (M3R1 / str(ctx["parent_id"]) / "p3.json").exists():
                parent = f"m3{str(ctx['parent_id']).lower()}"  # parent not run live yet: link to its layer A fixture
            ctx["parent_id"] = parent
            for obj in (p3.get("followup"), memo.get("followup")):
                if obj:
                    obj["parent_id"] = parent
            kw = {"parent_id": parent, "context": ctx}
            if (d / "reviews.json").exists():
                reviews[rid] = {cid: {"claim_id": cid, "state": r["state"], "updated_at": now(),
                                      "reviewed_by": f"kế thừa từ {parent}"} for cid, r in jload(d / "reviews.json").items()}
        out.append(done_run(rid, 10 + i, p2, p3, memo, **kw))
    REVIEWS.update(reviews)
    return out


def seed() -> None:
    RUNS.clear()
    REVIEWS.clear()
    runs = [done_run("mockq1", 600, jload(P4 / "Q1" / "p2.json"), jload(P4 / "Q1" / "p3.json"), jload(P4 / "Q1" / "memo_real.json"))]
    runs += [layer_a(k, 60 + 5 * i) for i, k in enumerate(LAYER_A_KEYS) if (M3A / k / "p3.json").exists()]
    runs += round_1()
    runs += [
        blank("mockerr", "Doanh thu game mobile Việt Nam năm 2030 là bao nhiêu? (MOCK: lần chạy lỗi)", 700, status="error",
              stage="lập brief, truy xuất và trích claim", finished_at=now() - timedelta(minutes=699),
              error="RuntimeError: HTTP 429 free-models-per-day (MOCK, giống lỗi hết quota thật)"),
        blank("mockclar", "Thị trường game casual thế nào?", 800, status="needs_clarification", stage="cần làm rõ câu hỏi",
              finished_at=now() - timedelta(minutes=799), brief=jload(P4 / "AMB" / "brief.json")["brief"]),
    ]
    for run in runs:
        RUNS[run["id"]] = run


# ---- in-memory replacement of api.store -------------------------------------------------------------------------
def create_run(question, parent_id=None, created_by=None, context=None):
    run_id = uuid.uuid4().hex[:10]
    with LOCK:
        RUNS[run_id] = blank(run_id, question, 0, parent_id=parent_id, created_by=created_by, context=context)
    return run_id


def update_run(run_id, **fields):
    with LOCK:
        if run_id in RUNS:
            RUNS[run_id].update(fields)


def get_run(run_id):
    with LOCK:
        r = RUNS.get(run_id)
        return copy.deepcopy(r) if r else None


def list_runs(limit=100):
    with LOCK:
        rows = sorted(RUNS.values(), key=lambda r: r["created_at"], reverse=True)[:limit]
        keys = ("id", "question", "parent_id", "created_by", "status", "stage", "error", "created_at", "finished_at", "memo_status")
        return [{**{k: r[k] for k in keys}, "has_result": r["p3"] is not None} for r in rows]


def count_active():
    with LOCK:
        return sum(1 for r in RUNS.values() if r["status"] in ("queued", "running") or r["memo_status"] == "running")


def get_reviews(run_id):
    with LOCK:
        return copy.deepcopy(REVIEWS.get(run_id, {}))


def set_review(run_id, claim_id, state, user=None):
    with LOCK:
        if state == "none":
            REVIEWS.get(run_id, {}).pop(claim_id, None)
        else:
            REVIEWS.setdefault(run_id, {})[claim_id] = {"claim_id": claim_id, "state": state, "updated_at": now(),
                                                        "reviewed_by": user}
        r = RUNS[run_id]
        if r["memo"] is not None and r["memo_status"] == "fresh":
            r["memo_status"] = "stale"


def delete_run(run_id):
    with LOCK:
        RUNS.pop(run_id, None)
        REVIEWS.pop(run_id, None)


for fn in (create_run, update_run, get_run, list_runs, count_active, get_reviews, set_review, delete_run):
    setattr(store, fn.__name__, fn)


# ---- simulated jobs (replace the model-backed ones) -------------------------------------------------------------
SUFFIXES = (" (hạ xuống 'suy luận': thiếu claim ID hợp lệ hoặc số không khớp claim)",
            " [DỰ THẢO, chưa có hiệu lực — không phải quy định đang áp dụng]")


def rebuild_memo(p3: dict, reviews: dict, saved_memo: dict | None, question: str) -> dict:
    """The REAL memo code (tiers, overall, main evidence, history, next steps) on the claims not rejected; the model
    call is replaced by the sentences saved in `saved_memo`, so no quota is spent."""
    saved_points = []
    for s in (saved_memo or {}).get("subs", []):
        for p in s.get("points", []):
            text = p["text"]
            for suf in SUFFIXES:
                text = text.replace(suf, "")
            saved_points.append({"sub_id": p.get("sub_id") or s["id"], "text": text, "claim_ids": p["claim_ids"],
                                 "is_fact": p["is_fact"]})

    def fake_call_model(cls, msgs, tag, max_tokens=6000):
        return MemoOut.model_validate({"points": saved_points}), 0

    with LOCK:
        memo_mod.call_model = fake_call_model
        built = memo_mod.build(service.effective_for_memo(p3, reviews), "real", "mock")
    built["question"] = question
    return built


def sim_run(run_id: str) -> None:
    run = get_run(run_id)
    q = run["question"]
    ctx = run.get("context")
    stages = ["lập brief, truy xuất và trích claim", "chấm hạng nguồn, đối soát mâu thuẫn, tính mức chắc chắn", "viết memo"]
    update_run(run_id, status="running", stage=stages[0])
    time.sleep(STEP_S)
    if "LOI" in q.upper():
        update_run(run_id, status="error", finished_at=now(), error="RuntimeError: HTTP 429 free-models-per-day (MOCK, giống lỗi hết quota thật)")
        return
    if "VAGUE" in q.upper() and "Làm rõ" not in q:
        update_run(run_id, status="needs_clarification", stage="cần làm rõ câu hỏi", finished_at=now(),
                   brief=jload(P4 / "AMB" / "brief.json")["brief"])
        return
    update_run(run_id, stage=stages[1])
    time.sleep(STEP_S)
    # canned content: a follow-up copies its parent's results (so inherited decisions are visible), otherwise M3 Q1
    src = get_run(ctx["parent_id"]) if ctx else (RUNS.get("m3q1") or RUNS["mockq1"])
    p2, p3 = copy.deepcopy(src["p2"]), copy.deepcopy(src["p3"])
    p2["question"] = p3["question"] = q
    if ctx:
        related = "KHAC" not in q.upper()
        inherit = bool(ctx.get("inherit"))
        p3["followup"] = {"parent_id": ctx["parent_id"], "parent_question": ctx["parent_question"], "related": related,
                          "inherit": inherit, "inherited": 0}
        if inherit and related:
            p3["followup"]["inherited"] = service.inherit_reviews(run_id, p3, ctx)  # real code
    update_run(run_id, stage=stages[2], brief=p2["brief"], p2=p2, p3=p3)
    time.sleep(STEP_S)
    memo = rebuild_memo(p3, get_reviews(run_id), src["memo"], q)
    update_run(run_id, status="done", stage="xong", finished_at=now(), memo=memo, memo_status="fresh",
               memo_generated_at=now())


def sim_memo(run_id: str) -> None:
    time.sleep(STEP_S)
    if FLAGS["memofail"]:
        update_run(run_id, memo_status="error", memo_error="RuntimeError: HTTP 429 free-models-per-day (MOCK, giống lỗi hết quota thật)")
        return
    run = get_run(run_id)
    memo = rebuild_memo(run["p3"], get_reviews(run_id), run["memo"], run["question"])
    update_run(run_id, memo=memo, memo_status="fresh", memo_error=None, memo_generated_at=now())


service.run_job = sim_run
service.memo_job = sim_memo

_reserve = service.reserve_slot


def reserve_slot():
    if FLAGS["busy"]:
        raise service.Busy("Hệ thống đang xử lý tối đa số câu hỏi cùng lúc. Hãy thử lại sau vài phút.")
    _reserve()


service.reserve_slot = reserve_slot

_connect = db.connect


def connect():
    if FLAGS["dbdown"]:
        raise psycopg.OperationalError("mock: database down")
    return _connect()


db.connect = connect


# ---- switches ---------------------------------------------------------------------------------------------------
@m.app.get("/mock/ingest")
def mock_ingest(state: str = "ready"):
    m.INGEST.update(state=state, error="OperationalError: MOCK lỗi nạp kho tài liệu" if state == "error" else None)
    return m.INGEST


@m.app.get("/mock/flag")
def mock_flag(name: str, on: int = 1):
    FLAGS[name] = bool(on)
    return FLAGS


@m.app.get("/mock/reset")
def mock_reset():
    seed()
    FLAGS.update(busy=False, dbdown=False, memofail=False)
    m.INGEST.update(state="ready", error=None)
    return {"ok": True}


seed()
m.INGEST.update(state="ready", chunks=0)

if __name__ == "__main__":
    uvicorn.run(m.app, host="127.0.0.1", port=int(os.getenv("MOCK_PORT", "8001")), log_level="warning")
