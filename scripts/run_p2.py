"""P2 runner: brief -> retrieve -> extract -> verify for Q1-Q5. Writes runs/p2/<Q>.json."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.brief import make_brief
from app.extract import extract_claims
from app.retrieve import Index
from app.verify import verify_claim

qs = json.load(open(ROOT / "tests/questions.json", encoding="utf-8"))
only = sys.argv[1:] or list(qs)
idx = Index()
out_dir = ROOT / "runs" / "p2"
out_dir.mkdir(parents=True, exist_ok=True)
for qid in only:
    q = qs[qid]
    brief, b_retries = make_brief(q, tag=f"{qid}_brief")
    result = {"question": q, "brief": brief.model_dump(), "brief_retries": b_retries, "subs": []}
    for sq in brief.sub_questions:
        chunks = idx.search(f"{sq.search_query} {sq.search_query_en} {q}", 8, per_source=2)
        sub = {"id": sq.id, "text": sq.text, "search_query": sq.search_query, "search_query_en": sq.search_query_en,
               "retrieved": [{k: c[k] for k in ("chunk_id", "source_id", "page", "score")} for c in chunks],
               "claims": [], "extract_retries": None}
        if chunks:
            ex, retries = extract_claims(sq.text, chunks, tag=f"{qid}_{sq.id}_extract")
            sub["extract_retries"] = retries
            for cl in ex.claims:
                v = verify_claim(cl.model_dump(), chunks)
                chunk = next((c for c in chunks if c["chunk_id"] == v["chunk_id"]), None)
                sub["claims"].append({**cl.model_dump(), **v,
                                      "source_id": chunk["source_id"] if chunk else None,
                                      "is_synthetic": chunk["is_synthetic"] if chunk else None})
        result["subs"].append(sub)
    (out_dir / f"{qid}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    allc = [c for s in result["subs"] for c in s["claims"]]
    print(qid, f"subs={len(result['subs'])} claims={len(allc)} valid={sum(c['valid'] for c in allc)} "
          f"rejected={sum(not c['valid'] for c in allc)}")
