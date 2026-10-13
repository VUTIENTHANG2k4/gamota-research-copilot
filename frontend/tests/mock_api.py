"""Local MOCK of the backend for UI tests only. It never calls the model and never touches the real run history.

What is real and what is fake:
  * The FastAPI routes, response shapes, review logic (confidence recomputed by code), stale-memo logic and the
    chunk endpoint are the REAL code from api/main.py, api/service.py and the real database (read-only: chunks).
  * Runs live in memory. Fixture runs are built from the saved P4 results under runs/p4/round_1 (real pipeline
    output of an earlier phase, used here only as sample data for the UI).
  * The quota-spending jobs (pipeline run and memo rewrite) are replaced by timed simulations that finish with
    canned content. Questions containing LOI end in an error; questions containing VAGUE ask for clarification.
  * /mock/* switches force special states: ingest, busy, dbdown, memofail.

Start (repo root, backend on 8000 untouched):
  .venv\\Scripts\\python ui\\tests\\mock_api.py            # listens on :8001
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

STEP_S = float(os.getenv("MOCK_STEP_S", "5"))
FLAGS = {"busy": False, "dbdown": False, "memofail": False}
RUNS: dict[str, dict] = {}
REVIEWS: dict[str, dict[str, dict]] = {}
SAVED = ROOT / "runs" / "p4" / "round_1"
LOCK = threading.Lock()


def now() -> datetime:
    return datetime.now(timezone.utc)


def load(q: str, name: str):
    return json.load(open(SAVED / q / name, encoding="utf-8"))


def fixture(q: str, run_id: str, minutes_ago: int) -> dict:
    p2, p3, memo = load(q, "p2.json"), load(q, "p3.json"), load(q, "memo_real.json")
    t = now() - timedelta(minutes=minutes_ago)
    return {"id": run_id, "question": p2["question"], "parent_id": None, "status": "done", "stage": "xong", "error": None,
            "created_at": t, "finished_at": t + timedelta(minutes=4), "brief": p2["brief"], "p2": p2, "p3": p3, "memo": memo,
            "memo_status": "fresh", "memo_error": None, "memo_generated_at": t + timedelta(minutes=4)}


def blank(run_id: str, question: str, minutes_ago: int, **kw) -> dict:
    t = now() - timedelta(minutes=minutes_ago)
    base = {"id": run_id, "question": question, "parent_id": None, "status": "queued", "stage": "chờ xử lý", "error": None,
            "created_at": t, "finished_at": None, "brief": None, "p2": None, "p3": None, "memo": None,
            "memo_status": "none", "memo_error": None, "memo_generated_at": None}
    base.update(kw)
    return base


def seed() -> None:
    RUNS.clear()
    REVIEWS.clear()
    for run in (
        fixture("Q1", "mockq1", 30),
        fixture("Q2", "mockq2", 90),
        fixture("Q4", "mockq4", 200),
        blank("mockerr", "Doanh thu game mobile Việt Nam năm 2030 là bao nhiêu? (MOCK: lần chạy lỗi)", 300, status="error",
              stage="lập brief, truy xuất và trích claim", finished_at=now() - timedelta(minutes=299),
              error="RuntimeError: HTTP 429 free-models-per-day (MOCK, giống lỗi hết quota thật)"),
        blank("mockclar", "Thị trường game casual thế nào?", 400, status="needs_clarification", stage="cần làm rõ câu hỏi",
              finished_at=now() - timedelta(minutes=399), brief=load("AMB", "brief.json")["brief"]),
    ):
        RUNS[run["id"]] = run


# ---- in-memory replacement of api.store -------------------------------------------------------------------------
def create_run(question, parent_id=None):
    run_id = uuid.uuid4().hex[:10]
    with LOCK:
        RUNS[run_id] = blank(run_id, question, 0, parent_id=parent_id)
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
        keys = ("id", "question", "parent_id", "status", "stage", "error", "created_at", "finished_at", "memo_status")
        return [{**{k: r[k] for k in keys}, "has_result": r["p3"] is not None} for r in rows]


def count_active():
    with LOCK:
        return sum(1 for r in RUNS.values() if r["status"] in ("queued", "running") or r["memo_status"] == "running")


def get_reviews(run_id):
    with LOCK:
        return copy.deepcopy(REVIEWS.get(run_id, {}))


def set_review(run_id, claim_id, state):
    with LOCK:
        if state == "none":
            REVIEWS.get(run_id, {}).pop(claim_id, None)
        else:
            REVIEWS.setdefault(run_id, {})[claim_id] = {"claim_id": claim_id, "state": state, "updated_at": now()}
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
def sim_run(run_id: str) -> None:
    run = get_run(run_id)
    q = run["question"]
    stages = ["lập brief, truy xuất và trích claim", "chấm hạng nguồn, đối soát mâu thuẫn, tính mức chắc chắn", "viết memo"]
    update_run(run_id, status="running", stage=stages[0])
    time.sleep(STEP_S)
    if "LOI" in q.upper():
        update_run(run_id, status="error", finished_at=now(), error="RuntimeError: HTTP 429 free-models-per-day (MOCK, giống lỗi hết quota thật)")
        return
    if "VAGUE" in q.upper() and "Làm rõ" not in q:
        update_run(run_id, status="needs_clarification", stage="cần làm rõ câu hỏi", finished_at=now(),
                   brief=load("AMB", "brief.json")["brief"])
        return
    update_run(run_id, stage=stages[1])
    time.sleep(STEP_S)
    update_run(run_id, stage=stages[2])
    time.sleep(STEP_S)
    src = fixture("Q1", run_id, 0)
    memo = copy.deepcopy(src["memo"])
    memo["question"] = q
    update_run(run_id, status="done", stage="xong", finished_at=now(), brief=src["brief"], p2=src["p2"], p3=src["p3"],
              memo=memo, memo_status="fresh", memo_generated_at=now())


def sim_memo(run_id: str) -> None:
    time.sleep(STEP_S)
    if FLAGS["memofail"]:
        update_run(run_id, memo_status="error", memo_error="RuntimeError: HTTP 429 free-models-per-day (MOCK, giống lỗi hết quota thật)")
        return
    run = get_run(run_id)
    reviews = get_reviews(run_id)
    eff = service.effective_for_memo(run["p3"], reviews)
    rejected = {c for c, r in reviews.items() if r["state"] == "rejected"}
    memo = copy.deepcopy(run["memo"])
    for ms in memo["subs"]:
        cur = next(s for s in eff["subs"] if s["id"] == ms["id"])
        ms["verdict"] = cur["verdict_real_only"]
        ms["points"] = [p for p in ms["points"] if not (set(p["claim_ids"]) & rejected)]
        if ms["verdict"]["level"] == "Chưa đủ căn cứ":
            ms["points"], ms["refused_text"] = [], "Chưa đủ căn cứ"
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
