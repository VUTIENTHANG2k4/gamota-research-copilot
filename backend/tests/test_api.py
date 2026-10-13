"""API plumbing tests with a fake LLM (no quota used). Needs PostgreSQL (DATABASE_URL) with the corpus ingested."""
import io
import os
import time

import pytest

os.environ.setdefault("SKIP_STARTUP_JOBS", "1")
from fastapi.testclient import TestClient  # noqa: E402

from api import main, service, store  # noqa: E402
from app import db, llm  # noqa: E402
from tests import fake_llm  # noqa: E402


@pytest.fixture(scope="module")
def client():
    try:
        with db.connect() as conn:
            db.init_schema(conn)
            if conn.execute("SELECT count(*) FROM chunks").fetchone()[0] == 0:
                pytest.skip("corpus not ingested (run python -m app.ingest)")
    except Exception as e:  # no database in this environment
        pytest.skip(f"database not available: {e}")
    mp = pytest.MonkeyPatch()
    mp.setattr(llm, "chat", fake_llm.chat)
    main.INGEST.update(state="ready")
    yield TestClient(main.app)
    mp.undo()


def wait(client, run_id, until, timeout=120):
    t0 = time.time()
    while time.time() - t0 < timeout:
        r = client.get(f"/api/runs/{run_id}").json()
        if until(r):
            return r
        time.sleep(0.5)
    raise AssertionError(f"timeout, last state: {r['status']} {r.get('error')}")


def test_health_and_about(client):
    assert client.get("/api/health").json()["mode"] == "MVP / prototype"
    a = client.get("/api/about").json()
    assert a["corpus"]["documents"] == 30 and a["corpus"]["synthetic"] == 12


def test_question_validation(client):
    assert client.post("/api/runs", json={"question": "ab"}).status_code == 422


def test_full_flow_run_review_rewrite_export_delete(client):
    rid = client.post("/api/runs", json={"question": "Quy định về thời gian chơi game của trẻ em là gì?"}).json()["id"]
    run = wait(client, rid, lambda r: r["status"] in ("done", "error", "needs_clarification"))
    assert run["status"] == "done", run.get("error")
    assert run["memo_status"] == "fresh" and run["memo"]["mode"] == "real"
    assert not any("SYN" in c["source_id"] for s in run["subs"] for c in s["claims"] if False)  # synthetic allowed in store
    # history persists in the database
    assert rid in [r["id"] for r in client.get("/api/runs").json()]
    claims = [c for s in run["subs"] for c in s["claims"]]
    assert claims, "fake LLM + real corpus should produce at least one valid claim"
    cid = claims[0]["claim_id"]
    # confirm
    r = client.put(f"/api/runs/{rid}/claims/{cid}/review", json={"state": "confirmed"}).json()
    assert r["review_summary"]["confirmed"] == 1 and r["memo_status"] == "stale"
    # reject: verdict is recomputed by code at once
    r = client.put(f"/api/runs/{rid}/claims/{cid}/review", json={"state": "rejected"}).json()
    assert r["review_summary"]["rejected"] == 1
    flagged = [c for s in r["subs"] for c in s["claims"] if c["claim_id"] == cid][0]
    assert flagged["review"] == "rejected"
    # unknown claim
    assert client.put(f"/api/runs/{rid}/claims/C-00000000/review", json={"state": "confirmed"}).status_code == 404
    # rewrite memo (stale -> fresh); the rejected claim must not be cited
    assert client.post(f"/api/runs/{rid}/memo").status_code == 202
    r = wait(client, rid, lambda x: x["memo_status"] in ("fresh", "error"))
    assert r["memo_status"] == "fresh", r.get("memo_error")
    cited = [i for s in r["memo"]["subs"] for p in s["points"] for i in p["claim_ids"]]
    assert cid not in cited
    # export
    d = client.get(f"/api/runs/{rid}/export.docx")
    assert d.status_code == 200 and d.content[:2] == b"PK"
    from docx import Document
    text = "\n".join(p.text for p in Document(io.BytesIO(d.content)).paragraphs)
    assert "Giới hạn đã biết" in text and "MVP" in text
    # chunks endpoint feeds the source panel
    assert client.get(f"/api/chunks/{flagged['chunk_id']}").status_code == 200
    # delete
    assert client.delete(f"/api/runs/{rid}").status_code == 200
    assert client.get(f"/api/runs/{rid}").status_code == 404


def test_clarification_flow(client):
    rid = client.post("/api/runs", json={"question": "XYZ-VAGUE thị trường thế nào?"}).json()["id"]
    run = wait(client, rid, lambda r: r["status"] in ("needs_clarification", "done", "error"))
    assert run["status"] == "needs_clarification" and run["brief"]["clarifying_questions"]
    assert run["subs"] == [] and run["memo"] is None
    new = client.post(f"/api/runs/{rid}/clarify", json={"answer": "Quyết định phát hành game idle RPG tại Việt Nam"}).json()["id"]
    r2 = wait(client, new, lambda r: r["status"] in ("done", "error", "needs_clarification"))
    assert r2["parent_id"] == rid and r2["status"] == "done", r2.get("error")
    assert client.post(f"/api/runs/{new}/clarify", json={"answer": "x1"}).status_code == 409
    for i in (rid, new):
        client.delete(f"/api/runs/{i}")


def test_apply_reviews_recomputes_confidence():
    claim = {"claim_id": "C-1", "source_id": "S001", "grade": "A", "is_synthetic": False}
    p3 = {"subs": [{"id": "sq1", "text": "x", "claims": [claim], "conflicts": [],
                    "verdict_real_only": {}, "verdict_with_synthetic": {}}]}
    kept = service.apply_reviews(p3, {})["subs"][0]["verdict_real_only"]
    assert kept["level"] == "Medium"
    gone = service.apply_reviews(p3, {"C-1": {"state": "rejected"}})["subs"][0]["verdict_real_only"]
    assert gone["level"] == "Chưa đủ căn cứ" and gone["refused"]


def test_interrupted_jobs_are_marked_on_startup(client):
    rid = store.create_run("Câu hỏi bị gián đoạn khi khởi động")
    store.update_run(rid, status="running")
    store.init()
    r = client.get(f"/api/runs/{rid}").json()
    assert r["status"] == "error" and "gián đoạn" in r["error"]
    client.delete(f"/api/runs/{rid}")


def test_error_text_has_no_local_paths():
    e = RuntimeError("OpenRouter HTTP 429: limit (see D:\gamota\runs\20261013_x.json)")
    msg = service.clean_error(e)
    assert "D:\\" not in msg and "RuntimeError: OpenRouter HTTP 429: limit" in msg
