"""P3 runner: grade + dedupe + conflict + confidence over runs/p2/Q*.json -> runs/p3/Q*.json."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.pipeline import grade_and_decide

out_dir = ROOT / "runs" / "p3"
out_dir.mkdir(parents=True, exist_ok=True)
for qid in sys.argv[1:] or ["Q1", "Q2", "Q3", "Q4", "Q5"]:
    p2 = json.load(open(ROOT / "runs/p2" / f"{qid}.json", encoding="utf-8"))
    result = grade_and_decide(p2, qid)
    (out_dir / f"{qid}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"== {qid}: {p2['question']}")
    for s in result["subs"]:
        gc = {g: sum(c["grade"] == g for c in s["claims"]) for g in "ABCD"}
        print(f"  {s['id']} grades={gc} conflicts={len(s['conflicts'])} "
              f"real={s['verdict_real_only']['level']} | +syn={s['verdict_with_synthetic']['level']}")
