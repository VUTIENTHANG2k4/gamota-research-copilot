"""Mission 3 T16 (automatic part) and timing: every 'fact' sentence of every M3 memo must carry claim IDs and
every number in it must appear in a cited source passage. No model call.

    cd backend && python scripts/m3_t16.py [runs/m3/round_1]
"""
import glob
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.memo import ID_TOKEN  # noqa: E402
from app.verify import numbers_in  # noqa: E402


def j(p):
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else None


def main(base: str):
    tot = ok = 0
    bad = []
    for d in sorted(glob.glob(os.path.join(base, "*", ""))):
        k = os.path.basename(os.path.normpath(d))
        p3 = j(os.path.join(d, "p3.json"))
        if not p3:
            continue
        claims = {c["claim_id"]: c for s in p3["subs"] for c in s["claims"]}
        for mode in ("real", "test"):
            m = j(os.path.join(d, f"memo_{mode}.json"))
            for s in m["subs"]:
                for p in s["points"]:
                    if not p["is_fact"]:
                        continue
                    tot += 1
                    pool = {f for i in p["claim_ids"] for x in numbers_in(claims[i]["passage"]) for f in x}
                    good = bool(p["claim_ids"]) and all(f & pool for f in numbers_in(ID_TOKEN.sub(" ", p["text"])))
                    ok += good
                    if not good:
                        bad.append((k, mode, p["text"][:100]))
    print(f"fact sentences with claim IDs and every number in a cited passage: {ok}/{tot}")
    for b in bad:
        print("  FAIL", b)


def timing():
    for base, label in (("runs/m3/round_1", "M3"), ("runs/p4/round_1", "M2 round_1"), ("runs/m3/m2_on_new", "M2 on new")):
        rows = []
        for d in sorted(glob.glob(os.path.join(base, "*", ""))):
            p2 = j(os.path.join(d, "p2.json"))
            if p2 and p2.get("timing"):
                t = p2["timing"]
                rows.append((os.path.basename(os.path.normpath(d)), t.get("brief_s"), t.get("extract_verify_s")))
        print(label, rows)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "runs/m3/round_1")
    timing()
