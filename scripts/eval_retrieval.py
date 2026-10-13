"""FR2: share of gold queries whose expected document is in the top-5 (target >= 80%)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.retrieve import Index

gold = json.load(open(Path(__file__).resolve().parent.parent / "tests/retrieval_gold.json", encoding="utf-8"))
idx = Index()
hit = 0
for g in gold:
    res = idx.search(g["query"], 5)
    srcs = [r["source_id"] for r in res]
    ok = any(s in g["expect_any"] for s in srcs)
    hit += ok
    print(("HIT " if ok else "MISS"), g["q"], g["query"][:55], "->", srcs)
print(f"FR2 top-5: {hit}/{len(gold)} = {hit/len(gold):.0%} (target 80%)")
