"""Persistence for runs, review decisions and history (PostgreSQL). Everything survives a restart."""
import uuid

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app import db

JSON_COLS = ("brief", "p2", "p3", "memo", "context")


def _conn():
    return db.connect()


def init() -> None:
    with _conn() as conn:
        db.init_schema(conn)
        # a job that was running when the server stopped will never finish
        conn.execute("UPDATE runs SET status='error', error=%s, finished_at=now() WHERE status IN ('queued','running')",
                     ("Bị gián đoạn vì máy chủ khởi động lại. Hãy chạy lại câu hỏi.",))
        conn.execute("UPDATE runs SET memo_status='error', memo_error=%s WHERE memo_status='running'",
                     ("Việc viết lại memo bị gián đoạn vì máy chủ khởi động lại.",))
        conn.commit()


def create_run(question: str, parent_id: str | None = None, created_by: str | None = None,
               context: dict | None = None) -> str:
    run_id = uuid.uuid4().hex[:10]
    with _conn() as conn:
        conn.execute("INSERT INTO runs (id, question, parent_id, created_by, status, stage, context) "
                     "VALUES (%s,%s,%s,%s,'queued','chờ xử lý',%s)",
                     (run_id, question, parent_id, created_by, Jsonb(context) if context else None))
        conn.commit()
    return run_id


def update_run(run_id: str, **fields) -> None:
    sets, vals = [], []
    for k, v in fields.items():
        sets.append(f"{k} = %s")
        vals.append(Jsonb(v) if k in JSON_COLS and v is not None else v)
    with _conn() as conn:
        conn.execute(f"UPDATE runs SET {', '.join(sets)} WHERE id = %s", [*vals, run_id])
        conn.commit()


def get_run(run_id: str) -> dict | None:
    with _conn() as conn:
        conn.row_factory = dict_row
        return conn.execute("SELECT * FROM runs WHERE id = %s", (run_id,)).fetchone()


def list_runs(limit: int = 100) -> list[dict]:
    with _conn() as conn:
        conn.row_factory = dict_row
        return conn.execute(
            "SELECT id, question, parent_id, created_by, status, stage, error, created_at, finished_at, memo_status, "
            "(p3 IS NOT NULL) AS has_result FROM runs ORDER BY created_at DESC LIMIT %s", (limit,)).fetchall()


def count_active() -> int:
    with _conn() as conn:
        return conn.execute("SELECT count(*) FROM runs WHERE status IN ('queued','running') "
                            "OR memo_status = 'running'").fetchone()[0]


def get_reviews(run_id: str) -> dict[str, dict]:
    with _conn() as conn:
        conn.row_factory = dict_row
        rows = conn.execute("SELECT claim_id, state, updated_at, reviewed_by FROM reviews WHERE run_id = %s", (run_id,)).fetchall()
    return {r["claim_id"]: r for r in rows}


def set_review(run_id: str, claim_id: str, state: str, user: str | None = None) -> None:
    with _conn() as conn:
        if state == "none":
            conn.execute("DELETE FROM reviews WHERE run_id = %s AND claim_id = %s", (run_id, claim_id))
        else:
            conn.execute(
                "INSERT INTO reviews (run_id, claim_id, state, reviewed_by) VALUES (%s,%s,%s,%s) "
                "ON CONFLICT (run_id, claim_id) DO UPDATE SET state = EXCLUDED.state, "
                "reviewed_by = EXCLUDED.reviewed_by, updated_at = now()",
                (run_id, claim_id, state, user))
        # removing a decision also changes what the memo should say
        conn.execute("UPDATE runs SET memo_status = CASE WHEN memo IS NULL THEN memo_status ELSE 'stale' END "
                     "WHERE id = %s AND memo_status = 'fresh'", (run_id,))
        conn.commit()


def delete_run(run_id: str) -> None:
    with _conn() as conn:
        conn.execute("DELETE FROM runs WHERE id = %s", (run_id,))
        conn.commit()
