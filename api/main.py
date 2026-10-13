"""FastAPI backend for the UI. Serves SAVED pipeline results (runs/p4/round_1) and can start a live run.
Contract: docs/api.md. The UI never talks to OpenRouter; only app/llm.py does, inside live runs."""
import csv
import json
import re
import threading
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
SAVED = ROOT / "runs" / "p4" / "round_1"
LIVE = ROOT / "runs" / "live"
REPORTS = ROOT / "tests" / "reports"
LABELS = {"Q1": "Q1", "Q2": "Q2", "Q3": "Q3", "Q4": "Q4", "Q5": "Q5",
          "A": "Câu hỏi phụ A (thử bẫy trùng nguồn)", "B": "Câu hỏi phụ B (thử bẫy mâu thuẫn thật)"}
KEY_RE = re.compile(r"^(Q[1-5]|A|B|live-[0-9a-f]{8})$")

app = FastAPI(title="gamota-research-copilot API (MVP)")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
                   allow_methods=["*"], allow_headers=["*"])
JOBS: dict[str, dict] = {}


def sources() -> dict[str, dict]:
    rows = csv.DictReader(open(ROOT / "corpus" / "sources.csv", encoding="utf-8"))
    return {r["id"]: {**r, "is_synthetic": r["is_synthetic"].lower() == "true"} for r in rows}


def run_dir(key: str) -> Path:
    if not KEY_RE.match(key):
        raise HTTPException(404, "Không có lần chạy này.")
    d = LIVE / key.removeprefix("live-") if key.startswith("live-") else SAVED / key
    if not (d / "p3.json").exists() and not (d / "p2.json").exists():
        raise HTTPException(404, "Không có kết quả đã lưu cho lần chạy này.")
    return d


def load(d: Path, name: str):
    f = d / name
    return json.load(open(f, encoding="utf-8")) if f.exists() else None


class RunRequest(BaseModel):
    question: str


@app.get("/api/health")
def health():
    return {"status": "ok", "mode": "MVP / prototype", "saved_runs": sorted(p.name for p in SAVED.iterdir()) if SAVED.exists() else []}


@app.get("/api/runs")
def list_runs():
    out = []
    for key in ("Q1", "Q2", "Q3", "Q4", "Q5", "A", "B"):
        p2 = load(SAVED / key, "p2.json") if (SAVED / key).exists() else None
        if p2:
            out.append({"key": key, "label": LABELS[key], "question": p2["question"], "origin": "saved",
                        "origin_note": "Kết quả đã lưu từ lần chạy kiểm thử P4 (vòng 1), không phải chạy mới."})
    for d in sorted(LIVE.glob("*")) if LIVE.exists() else []:
        p2 = load(d, "p2.json")
        if p2:
            out.append({"key": f"live-{d.name}", "label": "Chạy trực tiếp", "question": p2["question"], "origin": "live",
                        "origin_note": "Chạy mới trên pipeline, dùng model :free."})
    return out


@app.get("/api/runs/{key}")
def get_run(key: str):
    d = run_dir(key)
    p2, p3 = load(d, "p2.json"), load(d, "p3.json")
    src = sources()
    if p3 is None:  # brief asked for clarification: nothing else was run
        return {"key": key, "question": p2["question"], "brief": p2["brief"], "needs_clarification": p2["brief"]["needs_clarification"],
                "subs": [], "memo_real": None, "memo_test": None, "baseline": None}
    subs = []
    for s3, s2 in zip(p3["subs"], p2["subs"]):
        claims = []
        for c in s3["claims"]:
            meta = src[c["source_id"]]
            claims.append({**c, "source": {k: meta[k] for k in (
                "id", "title", "url", "source_type", "org", "publish_date", "data_date", "has_methodology",
                "conflict_of_interest_note", "cites_origin", "is_synthetic")}})
        rejected = [{"content": c["content"], "passage": c["passage"], "reason": c["reason"], "source_id": c.get("source_id"),
                     "is_synthetic": c.get("is_synthetic")} for c in s2["claims"] if not c["valid"]]
        subs.append({"id": s3["id"], "text": s3["text"], "retrieved": s2["retrieved"], "claims": claims,
                     "rejected_claims": rejected, "conflicts": s3["conflicts"],
                     "verdict_real_only": s3["verdict_real_only"], "verdict_with_synthetic": s3["verdict_with_synthetic"]})
    return {"key": key, "question": p2["question"], "needs_clarification": False, "brief": p2["brief"], "subs": subs,
            "memo_real": load(d, "memo_real.json"), "memo_test": load(d, "memo_test.json"), "baseline": load(d, "baseline.json"),
            "timing": {**p2.get("timing", {}), **p3.get("timing", {})}}


@app.get("/api/chunks/{chunk_id}")
def get_chunk(chunk_id: str):
    """Full text of the chunk a claim was quoted from (for the source-passage panel)."""
    from app import db
    try:
        with db.connect() as conn:
            row = conn.execute("SELECT source_id, page, text FROM chunks WHERE id = %s", (chunk_id,)).fetchone()
    except Exception as e:  # database down: say so plainly
        raise HTTPException(503, f"Không kết nối được cơ sở dữ liệu: {type(e).__name__}")
    if not row:
        raise HTTPException(404, "Không tìm thấy đoạn tài liệu.")
    meta = sources()[row[0]]
    return {"chunk_id": chunk_id, "source_id": row[0], "page": row[1], "text": row[2],
            "source": {k: meta[k] for k in ("id", "title", "url", "org", "publish_date", "data_date", "is_synthetic")}}


@app.get("/api/sources")
def list_sources():
    return list(sources().values())


def latest_report() -> Path:
    files = sorted(REPORTS.glob("*.md"))
    if not files:
        raise HTTPException(404, "Chưa có báo cáo kiểm thử trong tests/reports/.")
    return files[-1]


def sections(md: str) -> dict[str, str]:
    parts = re.split(r"^## ", md, flags=re.M)
    return {p.split("\n", 1)[0].strip(): p.split("\n", 1)[1] if "\n" in p else "" for p in parts[1:]}


def table_rows(md: str) -> list[list[str]]:
    rows = []
    for line in md.splitlines():
        if line.startswith("|") and not re.match(r"^\|[\s:-]+\|", line):
            rows.append([c.strip() for c in line.strip().strip("|").split("|")])
    return rows


@app.get("/api/test-results")
def test_results():
    f = latest_report()
    md = f.read_text(encoding="utf-8")
    sec = sections(md)
    find = lambda prefix: next((v for k, v in sec.items() if k.startswith(prefix)), "")
    t_rows = table_rows(find("2."))
    scores = ROOT / "runs" / "p4" / "scores.json"
    return {"report_file": f.name, "title": md.splitlines()[0].lstrip("# ").strip(),
            "summary_markdown": find("0."), "scenario_table_header": t_rows[0] if t_rows else [],
            "scenario_table": t_rows[1:] if t_rows else [], "scenario_details_markdown": find("2."),
            "metrics_markdown": find("5."), "metrics_table": table_rows(find("5.")),
            "baseline_markdown": find("6."), "limitations_of_suite_markdown": find("9."),
            "machine_scores": json.load(open(scores, encoding="utf-8")) if scores.exists() else None}


@app.get("/api/limitations")
def limitations():
    f = latest_report()
    sec = sections(f.read_text(encoding="utf-8"))
    find = lambda prefix: next((v for k, v in sec.items() if k.startswith(prefix)), "")
    progress = (ROOT / "docs" / "PROGRESS.md").read_text(encoding="utf-8")
    m = re.search(r"\*\*Top open defects.*?(?=\n\*\*Not checked)", progress, flags=re.S)
    nc = re.search(r"\*\*Not checked\*\*:.*", progress)
    return {"report_file": f.name, "defects_markdown": find("8."), "not_testable_markdown": find("9."),
            "defects_from_progress": m.group(0) if m else "", "not_checked": nc.group(0) if nc else "",
            "fixed_statements": [
                "Đây là MVP/prototype, không phải sản phẩm production.",
                "Bước duyệt claim của chuyên viên (analyst review) chưa được làm: claim hạng A/B được duyệt tự động.",
                "Chưa xuất Word/PDF.",
                "Kho nguồn nhỏ (30 tài liệu, trong đó 12 là SYNTHETIC tự soạn); chỉ 5 câu hỏi mẫu cộng 2 câu hỏi phụ.",
                "Chỉ một vòng kiểm thử; độ ổn định giữa các lần chạy chưa được đo.",
                "Model :free của NVIDIA ghi log sử dụng; chỉ gửi tài liệu công khai và SYNTHETIC.",
                "Tìm kiếm chỉ dùng từ khóa (BM25); chưa thử embedding."]}


def _live_job(job_id: str, question: str):
    d = LIVE / job_id
    try:
        from app.memo import build
        from app.pipeline import grade_and_decide, retrieve_extract
        d.mkdir(parents=True, exist_ok=True)
        JOBS[job_id]["stage"] = "truy xuất và trích claim"
        p2 = retrieve_extract(question, f"live_{job_id}")
        (d / "p2.json").write_text(json.dumps(p2, ensure_ascii=False, indent=2), encoding="utf-8")
        if not p2["brief"]["needs_clarification"]:
            JOBS[job_id]["stage"] = "chấm hạng, mâu thuẫn, mức chắc chắn"
            p3 = grade_and_decide(p2, f"live_{job_id}")
            (d / "p3.json").write_text(json.dumps(p3, ensure_ascii=False, indent=2), encoding="utf-8")
            for mode in ("real", "test"):
                JOBS[job_id]["stage"] = f"viết memo ({mode})"
                (d / f"memo_{mode}.json").write_text(json.dumps(build(p3, mode, f"live_{job_id}_{mode}"),
                                                                ensure_ascii=False, indent=2), encoding="utf-8")
        JOBS[job_id].update(status="done", stage="xong")
    except Exception as e:  # shown to the user as is
        JOBS[job_id].update(status="error", error=f"{type(e).__name__}: {str(e)[:600]}")


@app.post("/api/runs")
def start_run(req: RunRequest):
    q = req.question.strip()
    if not 5 <= len(q) <= 400:
        raise HTTPException(422, "Câu hỏi cần dài từ 5 đến 400 ký tự.")
    job_id = uuid.uuid4().hex[:8]
    JOBS[job_id] = {"status": "running", "stage": "bắt đầu", "key": f"live-{job_id}", "question": q}
    threading.Thread(target=_live_job, args=(job_id, q), daemon=True).start()
    return {"job_id": job_id, "key": f"live-{job_id}"}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(404, "Không có tác vụ này.")
    return JOBS[job_id]
