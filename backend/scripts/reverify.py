"""Re-run only the code verifier on claims already saved in runs/<dir>/Q*.json (no LLM calls)."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app import db
from app.verify import verify_claim

src = ROOT / "runs" / sys.argv[1]
with db.connect() as conn:
    text = dict(conn.execute("SELECT id, text FROM chunks").fetchall())
    sid = dict(conn.execute("SELECT id, source_id FROM chunks").fetchall())
for f in sorted(src.glob("Q*.json")):
    d = json.load(open(f, encoding="utf-8"))
    tot = ok_before = ok_after = 0
    for s in d["subs"]:
        chunks = [{"chunk_id": r["chunk_id"], "text": text[r["chunk_id"]]} for r in s["retrieved"]]
        for c in s["claims"]:
            v = verify_claim(c, chunks)
            tot += 1
            ok_before += c["valid"]
            ok_after += v["valid"]
            if v["valid"] and not c["valid"]:
                print(f.stem, "now valid:", sid[v["chunk_id"]], "|", c["content"][:100])
    print(f.stem, f"claims={tot} valid_before={ok_before} valid_after={ok_after}")
