"""P2 runner: brief -> retrieve -> extract -> verify for Q1-Q5. Writes runs/p2/<Q>.json."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.pipeline import retrieve_extract

qs = json.load(open(ROOT / "tests/questions.json", encoding="utf-8"))
out_dir = ROOT / "runs" / "p2"
out_dir.mkdir(parents=True, exist_ok=True)
for qid in sys.argv[1:] or list(qs):
    result = retrieve_extract(qs[qid], qid)
    (out_dir / f"{qid}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    allc = [c for s in result["subs"] for c in s["claims"]]
    print(qid, f"subs={len(result['subs'])} claims={len(allc)} valid={sum(c['valid'] for c in allc)} "
          f"rejected={sum(not c['valid'] for c in allc)}")
