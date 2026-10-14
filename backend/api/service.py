"""Background jobs (pipeline run, memo rewrite) and the code-side effect of analyst review decisions."""
import copy
import re
import threading
import time

from api import store
from app.confidence import confidence

MAX_ACTIVE = 2  # concurrent pipeline/memo jobs: protects the small server, not the LLM quota
_lock = threading.Lock()


class Busy(Exception):
    pass


def reserve_slot() -> None:
    with _lock:
        if store.count_active() >= MAX_ACTIVE:
            raise Busy("Hệ thống đang xử lý tối đa số câu hỏi cùng lúc. Hãy thử lại sau vài phút.")


def apply_reviews(p3: dict, reviews: dict[str, dict]) -> dict:
    """Copy of p3 with rejected claims removed and verdicts recomputed by code (confidence rules).
    SYNTHETIC claims never count towards a real-market conclusion."""
    rejected = {cid for cid, r in reviews.items() if r["state"] == "rejected"}
    out = copy.deepcopy(p3)
    for s in out["subs"]:
        for c in s["claims"]:
            c["review"] = reviews.get(c["claim_id"], {}).get("state", "none")
            c["reviewed_by"] = reviews.get(c["claim_id"], {}).get("reviewed_by")
        kept = [c for c in s["claims"] if c["claim_id"] not in rejected]
        ids = {c["claim_id"] for c in kept}
        s["conflicts"] = [x for x in s["conflicts"] if x["claim_a"] in ids and x["claim_b"] in ids]
        real = [c for c in kept if not c["is_synthetic"]]
        real_ids = {c["claim_id"] for c in real}
        real_conf = [x for x in s["conflicts"] if x["claim_a"] in real_ids and x["claim_b"] in real_ids]
        s["verdict_real_only"] = confidence(real, real_conf)
        s["verdict_with_synthetic"] = confidence(kept, s["conflicts"])
        s["rejected_by_reviewer"] = [c for c in s["claims"] if c["claim_id"] in rejected]
        s["claims"] = s["claims"]  # keep rejected ones visible, flagged by `review`
    return out


def effective_for_memo(p3: dict, reviews: dict[str, dict]) -> dict:
    """Input for memo.build: only claims not rejected by the reviewer."""
    eff = apply_reviews(p3, reviews)
    for s in eff["subs"]:
        s["claims"] = [c for c in s["claims"] if c.get("review") != "rejected"]
    return eff


def clean_error(e: Exception) -> str:
    """Error text for the user: verbatim, minus local file paths such as '(see D:\...json)'."""
    msg = re.sub(r"\s*\(see [^)]*\)", "", str(e))
    return f"{type(e).__name__}: {msg[:700]}"


def run_job(run_id: str) -> None:
    from app.memo import build
    from app.pipeline import grade_and_decide, retrieve_extract
    run = store.get_run(run_id)
    q = run["question"]
    try:
        store.update_run(run_id, status="running", stage="lập brief, truy xuất và trích claim")
        p2 = retrieve_extract(q, f"run_{run_id}")
        store.update_run(run_id, brief=p2["brief"], p2=p2)
        if p2["brief"]["needs_clarification"]:
            store.update_run(run_id, status="needs_clarification", stage="cần làm rõ câu hỏi", finished_at=_now())
            return
        store.update_run(run_id, stage="chấm hạng nguồn, đối soát mâu thuẫn, tính mức chắc chắn")
        p3 = grade_and_decide(p2, f"run_{run_id}")
        store.update_run(run_id, p3=p3, stage="viết memo")
        memo = build(p3, "real", f"run_{run_id}")
        store.update_run(run_id, memo=memo, memo_status="fresh", memo_generated_at=_now(), status="done",
                         stage="xong", finished_at=_now())
    except Exception as e:  # shown to the user as is
        store.update_run(run_id, status="error", error=clean_error(e), finished_at=_now())


def memo_job(run_id: str) -> None:
    from app.memo import build
    try:
        run = store.get_run(run_id)
        eff = effective_for_memo(run["p3"], store.get_reviews(run_id))
        memo = build(eff, "real", f"run_{run_id}_rewrite_{int(time.time())}")
        store.update_run(run_id, memo=memo, memo_status="fresh", memo_generated_at=_now(), memo_error=None)
    except Exception as e:
        store.update_run(run_id, memo_status="error", memo_error=clean_error(e))


def start(target, run_id: str) -> None:
    threading.Thread(target=target, args=(run_id,), daemon=True).start()


def _now():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc)
