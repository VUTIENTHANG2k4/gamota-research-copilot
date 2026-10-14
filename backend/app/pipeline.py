"""End-to-end pipeline: brief -> retrieve -> extract -> verify -> grade -> dedupe -> conflict -> confidence.
The logic of scripts/run_p2.py and scripts/run_p3.py, callable for any question."""
import csv
import hashlib
import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from app import dedupe
from app.brief import make_brief
from app.confidence import confidence
from app.conflict import classify, find_candidates
from app.extract import extract_claims
from app.grade import data_kind, grade_source
from app.retrieve import Index
from app.verify import verify_claim

ROOT = Path(__file__).resolve().parent.parent
MAX_PAIRS = 6  # LLM cause labels per sub-question (cost cap)
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


def retrieve_extract(question: str, tag: str) -> dict:
    """Steps 1-4 (P2). Stops early when the brief asks for clarification."""
    t0 = time.time()
    brief, b_retries = make_brief(question, tag=f"{tag}_brief")
    out = {"question": question, "brief": brief.model_dump(), "brief_retries": b_retries, "subs": [],
           "timing": {"brief_s": round(time.time() - t0, 1)}}
    if brief.needs_clarification:
        return out
    t1 = time.time()
    jobs = []
    for sq in brief.sub_questions:  # retrieval is local and fast: done in order
        chunks = index().search(f"{sq.search_query} {sq.search_query_en} {question}", 8, per_source=2)
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


def grade_and_decide(p2: dict, tag: str) -> dict:
    """Steps 5 (P3): grades, origins, conflicts, confidence. Verdict computed real-only and with SYNTHETIC."""
    t0 = time.time()
    result = {"question": p2["question"], "subs": []}
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
        pairs = find_candidates(claims)
        prepared.append((s, kind, claims, pairs))
        jobs += [(s["id"], n, a, b) for n, (a, b, _) in enumerate(pairs) if n < MAX_PAIRS]

    # cause labels (model calls) for the pairs of all sub-questions, in parallel; tags are unchanged
    labels = dict(zip([(j[0], j[1]) for j in jobs],
                      _pmap(lambda j: classify(j[2], j[3], f"{tag}_{j[0]}_conf{j[1]}"), jobs)))
    for s, kind, claims, pairs in prepared:
        conflicts = []
        for n, (a, b, diff) in enumerate(pairs):
            syn = bool(a["is_synthetic"] or b["is_synthetic"])
            if n < MAX_PAIRS:
                conflicts.append({**labels[(s["id"], n)], "relative_diff": round(diff, 3), "synthetic_involved": syn})
            else:
                conflicts.append({"claim_a": a["claim_id"], "claim_b": b["claim_id"], "cause": "unknown",
                                  "status": "unexplained", "relative_diff": round(diff, 3),
                                  "explanation": "Chưa gán nhãn nguyên nhân (vượt giới hạn số cặp).",
                                  "usage_suggestion": "", "synthetic_involved": syn})
        real = [c for c in claims if not c["is_synthetic"]]
        real_ids = {c["claim_id"] for c in real}
        real_conf = [x for x in conflicts if x["claim_a"] in real_ids and x["claim_b"] in real_ids]
        result["subs"].append({
            "id": s["id"], "text": s["text"], "data_kind": kind, "claims": claims, "conflicts": conflicts,
            "pairs_found": len(pairs),
            "verdict_real_only": confidence(real, real_conf),
            "verdict_with_synthetic": confidence(claims, conflicts)})
    result["timing"] = {"grade_conflict_s": round(time.time() - t0, 1)}
    return result


def run(question: str, tag: str) -> tuple[dict, dict]:
    p2 = retrieve_extract(question, tag)
    return p2, grade_and_decide(p2, tag)
