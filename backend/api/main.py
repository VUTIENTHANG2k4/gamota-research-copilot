"""FastAPI backend of the lean MVP. Contract: docs/api.md.
Runs, review decisions and history live in PostgreSQL. Only app/llm.py talks to the model."""
import csv
import os
import threading
import time
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from api import auth, export, service, store

ROOT = Path(__file__).resolve().parent.parent
INGEST = {"state": "starting", "chunks": 0, "error": None}
SRC_FIELDS = ("id", "title", "url", "source_type", "org", "publish_date", "data_date", "has_methodology",
              "conflict_of_interest_note", "cites_origin", "is_synthetic")

app = FastAPI(title="gamota-research-copilot API (MVP / prototype)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()],
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX") or None,
    allow_methods=["*"], allow_headers=["*"])


def _ingest_job() -> None:
    from app.ingest import ensure_ingested
    try:
        INGEST.update(state="ingesting")
        INGEST.update(chunks=ensure_ingested(), state="ready")
    except Exception as e:
        INGEST.update(state="error", error=f"{type(e).__name__}: {str(e)[:300]}")


@app.on_event("startup")
def startup():
    if os.getenv("SKIP_STARTUP_JOBS") == "1":  # tests
        INGEST.update(state="ready")
        return
    try:
        store.init()
    except Exception as e:
        INGEST.update(state="error", error=f"Không kết nối được cơ sở dữ liệu: {type(e).__name__}")
        return
    threading.Thread(target=_ingest_job, daemon=True).start()


def sources() -> dict[str, dict]:
    rows = csv.DictReader(open(ROOT / "corpus" / "sources.csv", encoding="utf-8"))
    return {r["id"]: {**r, "is_synthetic": r["is_synthetic"].lower() == "true"} for r in rows}


def with_sources(p3: dict) -> dict:
    src = sources()
    for s in p3["subs"]:
        for c in s["claims"]:
            c["source"] = {k: src[c["source_id"]][k] for k in SRC_FIELDS}
    return p3


def need_run(run_id: str) -> dict:
    run = store.get_run(run_id)
    if not run:
        raise HTTPException(404, "Không có lần chạy này.")
    return run


def view(run: dict) -> dict:
    out = {k: run.get(k) for k in ("id", "question", "parent_id", "created_by", "context", "status", "stage", "error", "created_at", "finished_at",
                                "brief", "memo", "memo_status", "memo_error", "memo_generated_at")}
    out["subs"], out["review_summary"] = [], {"confirmed": 0, "rejected": 0}
    if run["p3"]:
        reviews = store.get_reviews(run["id"])
        out["review_summary"] = {k: sum(1 for r in reviews.values() if r["state"] == k) for k in ("confirmed", "rejected")}
        eff = with_sources(service.apply_reviews(run["p3"], reviews))
        for s3, s2 in zip(eff["subs"], run["p2"]["subs"]):
            out["subs"].append({
                "id": s3["id"], "text": s3["text"], "retrieved": s2["retrieved"], "claims": s3["claims"],
                "rejected_claims": [{"content": c["content"], "passage": c["passage"], "reason": c["reason"],
                                     "source_id": c.get("source_id"), "is_synthetic": c.get("is_synthetic")}
                                    for c in s2["claims"] if not c["valid"]],
                "conflicts": s3["conflicts"], "verdict": s3["verdict_real_only"]})
        out["timing"] = {**run["p2"].get("timing", {}), **run["p3"].get("timing", {})}
    return out


class QuestionIn(BaseModel):
    question: str = Field(min_length=5, max_length=400)


class ClarifyIn(BaseModel):
    answer: str = Field(min_length=2, max_length=600)


class FollowupIn(BaseModel):
    question: str = Field(min_length=3, max_length=400)
    inherit: bool = True  # the UI lets the user drop the inherited context


class ReviewIn(BaseModel):
    state: Literal["confirmed", "rejected", "none"]


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)


User = Depends(auth.require_user)  # signed-in username; None when sign-in is off (APP_USERS empty)


@app.get("/api/health")
def health():
    return {"status": "ok", "mode": "MVP / prototype", "corpus": INGEST}


@app.get("/api/auth/config")
def auth_config():
    return {"enabled": auth.enabled()}


@app.post("/api/auth/login")
def login(req: LoginIn):
    if not auth.enabled():
        raise HTTPException(409, "Đăng nhập chưa được bật trên máy chủ này.")
    if not auth.check_password(req.username.strip(), req.password):
        time.sleep(auth.FAIL_DELAY_S)
        raise HTTPException(401, "Sai tên đăng nhập hoặc mật khẩu.")
    return auth.issue(req.username.strip())


@app.get("/api/auth/me")
def me(user: str | None = User):
    return {"username": user, "enabled": auth.enabled()}


@app.get("/api/about")
def about():
    src = list(sources().values())
    return {"corpus": {"documents": len(src), "synthetic": sum(1 for s in src if s["is_synthetic"]),
                       "real": sum(1 for s in src if not s["is_synthetic"])},
            "limitations": export.LIMITATIONS + [
                "Bước duyệt claim của chuyên viên chỉ loại hoặc xác nhận claim; việc viết lại memo cần bấm 'Viết lại memo' và dùng model.",
                "Xuất PDF dùng chức năng in của trình duyệt (Lưu thành PDF); xuất Word do máy chủ tạo.",
                "Đăng nhập đơn giản: tài khoản và mật khẩu do người triển khai khai báo trên máy chủ, không có đăng ký, quên mật khẩu hay phân quyền; mọi người dùng chung một lịch sử. Không phải bảo mật cho dữ liệu thật.",
                "Model :free của NVIDIA ghi log sử dụng: chỉ nhập câu hỏi và dùng tài liệu công khai, không nhập dữ liệu thật của Gamota hoặc dữ liệu cá nhân."]}


@app.get("/api/runs")
def list_runs(user: str | None = User):
    return store.list_runs()


@app.post("/api/runs", status_code=202)
def start_run(req: QuestionIn, user: str | None = User):
    if INGEST["state"] != "ready":
        raise HTTPException(503, "Kho tài liệu chưa sẵn sàng (đang nạp). Hãy thử lại sau ít phút.")
    try:
        service.reserve_slot()
    except service.Busy as e:
        raise HTTPException(429, str(e))
    run_id = store.create_run(req.question.strip(), created_by=user)
    service.start(service.run_job, run_id)
    return {"id": run_id}


@app.get("/api/runs/{run_id}")
def get_run(run_id: str, user: str | None = User):
    return view(need_run(run_id))


@app.delete("/api/runs/{run_id}")
def delete_run(run_id: str, user: str | None = User):
    need_run(run_id)
    store.delete_run(run_id)
    return {"deleted": run_id}


@app.post("/api/runs/{run_id}/clarify", status_code=202)
def clarify(run_id: str, req: ClarifyIn, user: str | None = User):
    run = need_run(run_id)
    if run["status"] != "needs_clarification":
        raise HTTPException(409, "Lần chạy này không đang chờ làm rõ.")
    try:
        service.reserve_slot()
    except service.Busy as e:
        raise HTTPException(429, str(e))
    new_id = store.create_run(f"{run['question']} (Làm rõ: {req.answer.strip()})"[:900], parent_id=run_id, created_by=user)
    service.start(service.run_job, new_id)
    return {"id": new_id}


@app.post("/api/runs/{run_id}/followup", status_code=202)
def followup(run_id: str, req: FollowupIn, user: str | None = User):
    """Mission 3: continue the research from a finished run, keeping its context."""
    parent = need_run(run_id)
    if parent["status"] != "done" or not parent["p3"]:
        raise HTTPException(409, "Chỉ nghiên cứu tiếp được từ một lần chạy đã xong.")
    if service.depth(run_id) + 1 > service.MAX_DEPTH:
        raise HTTPException(409, f"Chuỗi nghiên cứu tiếp đã đủ {service.MAX_DEPTH} bước; hãy bắt đầu câu hỏi mới.")
    try:
        service.reserve_slot()
    except service.Busy as e:
        raise HTTPException(429, str(e))
    ctx = service.followup_context(parent, req.inherit)
    new_id = store.create_run(req.question.strip(), parent_id=run_id, created_by=user, context=ctx)
    service.start(service.run_job, new_id)
    return {"id": new_id}


@app.put("/api/runs/{run_id}/claims/{claim_id}/review")
def review(run_id: str, claim_id: str, req: ReviewIn, user: str | None = User):
    run = need_run(run_id)
    if not run["p3"] or claim_id not in {c["claim_id"] for s in run["p3"]["subs"] for c in s["claims"]}:
        raise HTTPException(404, "Không có claim này trong lần chạy.")
    store.set_review(run_id, claim_id, req.state, user)
    return view(need_run(run_id))


@app.post("/api/runs/{run_id}/memo", status_code=202)
def rewrite_memo(run_id: str, user: str | None = User):
    run = need_run(run_id)
    if not run["p3"]:
        raise HTTPException(409, "Chưa có kết quả để viết memo.")
    if run["memo_status"] == "running":
        raise HTTPException(409, "Memo đang được viết lại.")
    try:
        service.reserve_slot()
    except service.Busy as e:
        raise HTTPException(429, str(e))
    store.update_run(run_id, memo_status="running", memo_error=None)
    service.start(service.memo_job, run_id)
    return {"id": run_id}


@app.get("/api/runs/{run_id}/export.docx")
def export_docx(run_id: str, user: str | None = User):
    run = need_run(run_id)
    if not run["memo"]:
        raise HTTPException(409, "Chưa có memo để xuất.")
    reviews = store.get_reviews(run_id)
    eff = with_sources(service.apply_reviews(run["p3"], reviews))
    data = export.memo_docx(run, eff, reviews, stale=run["memo_status"] != "fresh")
    return Response(data, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    headers={"Content-Disposition": f'attachment; filename="memo-{run_id}.docx"'})


@app.get("/api/chunks/{chunk_id}")
def get_chunk(chunk_id: str, user: str | None = User):
    from app import db
    try:
        with db.connect() as conn:
            row = conn.execute("SELECT source_id, page, text FROM chunks WHERE id = %s", (chunk_id,)).fetchone()
    except Exception as e:
        raise HTTPException(503, f"Không kết nối được cơ sở dữ liệu: {type(e).__name__}")
    if not row:
        raise HTTPException(404, "Không tìm thấy đoạn tài liệu.")
    meta = sources()[row[0]]
    return {"chunk_id": chunk_id, "source_id": row[0], "page": row[1], "text": row[2],
            "source": {k: meta[k] for k in SRC_FIELDS}}


@app.get("/api/sources")
def list_sources(user: str | None = User):
    return list(sources().values())
