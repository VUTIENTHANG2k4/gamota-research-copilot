"""Mission 3, proof layer B (docs/spec/09-mission3.md section 6): live round with the M3 code.
Resumable: an item whose files exist is skipped, so a run stopped by the free-tier quota continues later.

    cd backend && python scripts/m3_live.py [round] [key ...]   -> runs/m3/round_<n>/<key>/...
Order = priority agreed with the user on 2026-10-20: X1-X3, Q2, Q3, Q4, T14, T15, then Q1, Q5, A, B, AMB, T7.
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.service import effective_for_memo  # noqa: E402
from app.brief import make_brief  # noqa: E402
from app.extract import extract_claims  # noqa: E402
from app.memo import build  # noqa: E402
from app.pipeline import grade_and_decide, index, retrieve_extract  # noqa: E402
from app.verify import verify_claim  # noqa: E402
from tests.run_eval import AMBIGUOUS, EXTRA, QS, T7_QUERIES  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
X = {  # pre-registered in spec 09 section 5
    "X1": "Thị trường game nông trại trên mobile tại Việt Nam năm 2025 có bao nhiêu lượt tải?",
    "X2": "Doanh thu game cờ tướng trên mobile tại Việt Nam năm 2025 là bao nhiêu?",
    "X3": "Doanh thu game đua xe trên mobile tại Việt Nam là bao nhiêu?",
}
FOLLOW = {  # key: (parent key, question, sources the analyst rejects in the parent before asking)
    "T14": ("Q2", "Riêng nhóm game nhập vai thì chiếm bao nhiêu trong đó?", ["S017"]),
    "T15": ("Q3", "Giá cà phê Robusta Tây Nguyên tháng 9/2026 thế nào?", []),
}
ORDER = ["X1", "X2", "X3", "Q2", "Q3", "Q4", "T14", "T15", "Q1", "Q5", "A", "B", "AMB", "T7"]


def save(p: Path, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def load(p: Path):
    return json.load(open(p, encoding="utf-8")) if p.exists() else None


def question_run(d: Path, key: str, q: str, tag: str, context=None, reviews=None):
    p2 = load(d / "p2.json")
    if p2 is None:
        t0 = time.time()
        p2 = retrieve_extract(q, tag, context=context)
        p2["wall_s"] = round(time.time() - t0, 1)
        save(d / "p2.json", p2)
    if p2["brief"]["needs_clarification"]:
        return p2, None
    p3 = load(d / "p3.json")
    if p3 is None:
        p3 = grade_and_decide(p2, tag)
        if context:
            p3["followup"] = {"parent_id": context["parent_id"], "parent_question": context["parent_question"],
                              "related": bool((p2.get("followup") or {}).get("related")), "inherit": True,
                              "inherited": 0}
        save(d / "p3.json", p3)
    eff = p3
    if reviews is not None:
        eff = effective_for_memo(p3, reviews)
        save(d / "reviews.json", reviews)
    for mode in ("real", "test"):
        if not (d / f"memo_{mode}.json").exists():
            t0 = time.time()
            m = build(eff, mode, f"{tag}_{mode}")
            m["memo_s"] = round(time.time() - t0, 1)
            save(d / f"memo_{mode}.json", m)
    return p2, p3


def followup(out: Path, key: str, n: int):
    parent_key, q, reject_sources = FOLLOW[key]
    pd = out / parent_key
    pp2, pp3, pmemo = load(pd / "p2.json"), load(pd / "p3.json"), load(pd / "memo_real.json")
    if not (pp3 and pmemo):
        print(key, "skipped: parent", parent_key, "not finished", flush=True)
        return
    parent_claims = [c for s in pp3["subs"] for c in s["claims"]]
    rejected = sorted(c["claim_id"] for c in parent_claims if c["source_id"] in reject_sources)
    by_src = {}
    for c in parent_claims:
        by_src.setdefault(c["source_id"], []).append(c["claim_id"])
    ctx = {"parent_id": parent_key, "parent_question": pp2["question"], "inherit": True,
           "decision": pp2["brief"].get("decision", ""), "scope": pp2["brief"].get("scope", ""),
           "gaps": [s["text"] for s in pmemo["subs"] if s.get("refused_text")],
           "rejected_claims": rejected, "confirmed_claims": [],
           "rejected_sources": sorted(s for s, ids in by_src.items() if all(i in rejected for i in ids))}
    d = out / key
    save(d / "context.json", ctx)
    p2 = load(d / "p2.json") or retrieve_extract(q, f"m3r{n}_{key}", context=ctx)
    save(d / "p2.json", p2)
    reviews = None
    if not p2["brief"]["needs_clarification"]:
        p3 = load(d / "p3.json") or grade_and_decide(p2, f"m3r{n}_{key}")
        related = bool((p2.get("followup") or {}).get("related"))
        if related:  # same rule as api.service.inherit_reviews
            reviews = {c["claim_id"]: {"state": "rejected", "reviewed_by": f"kế thừa từ {parent_key}"}
                       for s in p3["subs"] for c in s["claims"]
                       if c["claim_id"] in rejected or c["source_id"] in ctx["rejected_sources"]}
        p3["followup"] = {"parent_id": parent_key, "parent_question": ctx["parent_question"], "related": related,
                          "inherit": True, "inherited": len(reviews or {})}
        save(d / "p3.json", p3)
    question_run(d, key, q, f"m3r{n}_{key}", context=ctx, reviews=reviews or {})


def main(n: int, keys: list[str]):
    out = ROOT / "runs" / "m3" / f"round_{n}"
    index()  # load BM25 once
    for key in keys or ORDER:
        t0 = time.time()
        try:
            if key in FOLLOW:
                followup(out, key, n)
            elif key == "AMB":
                f = out / "AMB" / "brief.json"
                if not f.exists():
                    b, retries = make_brief(AMBIGUOUS, f"m3r{n}_AMB")
                    save(f, {"question": AMBIGUOUS, "brief": b.model_dump(), "retries": retries})
            elif key == "T7":
                f = out / "T7" / "claims.json"
                if not f.exists():
                    res = []
                    for query in T7_QUERIES:
                        chunks = [c for c in index().search(query, 40) if c["source_id"] in ("S005", "S006")][:6]
                        if not chunks:
                            continue
                        ex, _ = extract_claims(query, chunks, f"m3r{n}_T7")
                        for cl in ex.claims:
                            v = verify_claim(cl.model_dump(), chunks)
                            ch = next((c for c in chunks if c["chunk_id"] == v["chunk_id"]), None)
                            res.append({"query": query, **cl.model_dump(), **v,
                                        "source_id": ch["source_id"] if ch else None,
                                        "chunk_text": ch["text"] if ch else None})
                    save(f, {"claims": res})
            else:
                q = X.get(key) or EXTRA.get(key) or QS[key]
                question_run(out / key, key, q, f"m3r{n}_{key}")
            print(key, "done", round(time.time() - t0), "s", flush=True)
        except Exception as e:  # quota or provider error: stop here, the next call resumes
            print(key, "STOPPED:", type(e).__name__, str(e)[:300], flush=True)
            return


if __name__ == "__main__":
    a = sys.argv[1:]
    main(int(a[0]) if a else 1, a[1:])
