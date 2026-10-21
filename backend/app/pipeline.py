"""End-to-end pipeline: brief -> retrieve -> extract -> verify -> grade -> dedupe -> conflict -> confidence.
The logic of scripts/run_p2.py and scripts/run_p3.py, callable for any question."""
import csv
import hashlib
import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from app import dedupe, trust
from app.brief import make_brief
from app.conflict import classify
from app.extract import extract_claims
from app.grade import data_kind, grade_source
from app.retrieve import Index
from app.verify import verify_claim

ROOT = Path(__file__).resolve().parent.parent
MAX_PAIRS = 6  # LLM cause labels per sub-question (cost cap)
REAL_K, SYN_K = 8, 4  # retrieval slots per sub-question: real documents, SYNTHETIC test documents
CONCURRENCY = max(1, int(os.getenv("LLM_CONCURRENCY", "4")))  # parallel model calls; 1 = sequential
SRC = {r["id"]: r for r in csv.DictReader(open(ROOT / "corpus/sources.csv", encoding="utf-8"))}
_idx = None


def index() -> Index:
    global _idx
    if _idx is None:
        _idx = Index()
    return _idx


def reset_index() -> None:
    global _idx
    _idx = None


def _pmap(fn, items: list) -> list:
    """Apply fn to items with up to CONCURRENCY threads; results keep the input order and the first error is raised."""
    if CONCURRENCY == 1 or len(items) <= 1:
        return [fn(x) for x in items]
    with ThreadPoolExecutor(max_workers=min(CONCURRENCY, len(items))) as pool:
        return list(pool.map(fn, items))


def retrieve_extract(question: str, tag: str, context: dict | None = None) -> dict:
    """Steps 1-4 (P2). Stops early when the brief asks for clarification.
    context (Mission 3 follow-up): the parent research's question, decision, scope and gaps."""
    t0 = time.time()
    brief, b_retries = make_brief(question, tag=f"{tag}_brief", context=context)
    out = {"question": question, "brief": brief.model_dump(), "brief_retries": b_retries, "subs": [],
           "timing": {"brief_s": round(time.time() - t0, 1)}}
    if context:
        out["followup"] = {"parent_id": context.get("parent_id"),
                           "related": bool(getattr(brief, "related_to_parent", False))}
    if brief.needs_clarification:
        return out
    t1 = time.time()
    jobs = []
    for sq in brief.sub_questions:  # retrieval is local and fast: done in order
        q = f"{sq.search_query} {sq.search_query_en} {question}"
        # Mission 3 round 3: real documents get their own 8 slots. Before, SYNTHETIC test documents took 51.6% of
        # the top-8 slots of real questions (evaluator, round 2), and the real-documents memo then had nothing left.
        # SYNTHETIC documents are searched separately (up to REAL_K/2) for test mode only.
        chunks = (index().search(q, REAL_K, per_source=2, synthetic=False)
                  + index().search(q, SYN_K, per_source=2, synthetic=True))
        sub = {"id": sq.id, "text": sq.text, "search_query": sq.search_query, "search_query_en": sq.search_query_en,
               "retrieved": [{k: c[k] for k in ("chunk_id", "source_id", "page", "score")} for c in chunks],
               "claims": [], "extract_retries": None}
        out["subs"].append(sub)
        if chunks:
            jobs.append((sub, chunks))

    def extract(job):  # the model call: independent per sub-question, so run in parallel
        sub, chunks = job
        return extract_claims(sub["text"], chunks, tag=f"{tag}_{sub['id']}_extract")

    for (sub, chunks), (ex, retries) in zip(jobs, _pmap(extract, jobs)):
        sub["extract_retries"] = retries
        for cl in ex.claims:
            v = verify_claim(cl.model_dump(), chunks)
            chunk = next((c for c in chunks if c["chunk_id"] == v["chunk_id"]), None)
            sub["claims"].append({**cl.model_dump(), **v,
                                  "source_id": chunk["source_id"] if chunk else None,
                                  "is_synthetic": chunk["is_synthetic"] if chunk else None})
    out["timing"]["extract_verify_s"] = round(time.time() - t1, 1)
    return out


CODE_CAUSE = {"revision": ("revision", "Cùng nguồn gốc, bản phát hành sau thay thế bản trước."),
              "older_period": ("year", "Hai số liệu thuộc hai kỳ khác nhau; số của kỳ mới hơn là căn cứ chính."),
              "stale": ("stale", "Một số liệu đã quá cũ so với cửa sổ thời gian; chỉ giữ làm lịch sử."),
              "weak_dissent": ("weak_dissent", "Nguồn hạng C/D cho số khác nguồn hạng A/B; không làm thay đổi kết luận."),
              "weak_pair": ("unknown", "Hai nguồn hạng C/D cho số khác nhau; không nguồn nào đủ căn cứ.")}


def code_conflict(r: dict) -> dict:
    """A relation decided by code (no model call), in the same shape as an LLM-labelled conflict."""
    cause, why = CODE_CAUSE[r["relation"]]
    return {"claim_a": r["claim_a"], "claim_b": r["claim_b"], "cause": cause, "decided_by": "code",
            "status": "unexplained" if r["relation"] == "weak_pair" else "explained", "explanation": why,
            "usage_suggestion": "", "relative_diff": r["relative_diff"]}


def grade_and_decide(p2: dict, tag: str) -> dict:
    """Step 5: grades, origins, conflicts, trust tiers. Verdict computed real-only and with SYNTHETIC.
    Mission 3: relations between claims (revision, older period, stale, weak dissent) are decided by code;
    the model only labels the cause for two in-window A/B claims of the same period (trust.relations)."""
    t0 = time.time()
    core = [q["id"] for q in (p2.get("brief") or {}).get("sub_questions", []) if q.get("core")]
    result = {"question": p2["question"], "subs": [], "core": core}
    prepared, jobs = [], []
    for s in p2["subs"]:
        kind = data_kind(s["text"])
        seen, claims = set(), []
        for c in s["claims"]:
            if not c["valid"]:
                continue
            key = (c["source_id"], c["content"])
            if key in seen:
                continue
            seen.add(key)
            src = SRC[c["source_id"]]
            gr = grade_source(src, kind)
            cid = "C-" + hashlib.sha1(f"{c['source_id']}|{c['content']}".encode()).hexdigest()[:8]
            claims.append({**c, "claim_id": cid, "grade": gr["grade"], "grade_detail": gr,
                           "origin_group": dedupe.origin_of(c["source_id"]),
                           "source_type": src["source_type"], "has_methodology": src["has_methodology"],
                           "src_data_date": src["data_date"], "src_publish_date": src["publish_date"]})
        rels = trust.relations(claims, [])
        need = [r for r in rels if r.get("needs_label")]
        prepared.append((s, kind, claims, rels))
        by_id = {c["claim_id"]: c for c in claims}
        jobs += [(s["id"], n, by_id[r["claim_a"]], by_id[r["claim_b"]], r["relative_diff"])
                 for n, r in enumerate(need) if n < MAX_PAIRS]

    # cause labels (model calls) only where code cannot decide, in parallel
    labels = _pmap(lambda j: {**classify(j[2], j[3], f"{tag}_{j[0]}_conf{j[1]}"), "relative_diff": round(j[4], 3),
                              "decided_by": "llm"}, jobs)
    labelled = {}
    for j, lab in zip(jobs, labels):
        labelled.setdefault(j[0], []).append(lab)
    for s, kind, claims, rels in prepared:
        conflicts = list(labelled.get(s["id"], []))
        done = {frozenset((x["claim_a"], x["claim_b"])) for x in conflicts}
        for r in rels:
            if r["relation"] == "conflict" and frozenset((r["claim_a"], r["claim_b"])) not in done:
                conflicts.append({"claim_a": r["claim_a"], "claim_b": r["claim_b"], "cause": "unknown",
                                  "status": "unexplained", "decided_by": "code", "relative_diff": r["relative_diff"],
                                  "explanation": "Chưa gán nhãn nguyên nhân (vượt giới hạn số cặp).", "usage_suggestion": ""})
            elif r["relation"] != "conflict":
                conflicts.append(code_conflict(r))
        by_id = {c["claim_id"]: c for c in claims}
        for x in conflicts:
            x["synthetic_involved"] = bool(by_id[x["claim_a"]]["is_synthetic"] or by_id[x["claim_b"]]["is_synthetic"])
        real = [c for c in claims if not c["is_synthetic"]]
        real_ids = {c["claim_id"] for c in real}
        real_conf = [x for x in conflicts if x["claim_a"] in real_ids and x["claim_b"] in real_ids]
        result["subs"].append({
            "id": s["id"], "text": s["text"], "data_kind": kind, "claims": claims, "conflicts": conflicts,
            "pairs_found": len(rels), "retrieved": s.get("retrieved", []),
            "verdict_real_only": trust.evaluate(real, real_conf, kind, s["text"]),
            "verdict_with_synthetic": trust.evaluate(claims, conflicts, kind, s["text"])})
    result["timing"] = {"grade_conflict_s": round(time.time() - t0, 1)}
    return result


def run(question: str, tag: str) -> tuple[dict, dict]:
    p2 = retrieve_extract(question, tag)
    return p2, grade_and_decide(p2, tag)
