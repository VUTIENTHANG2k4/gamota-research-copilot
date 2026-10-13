"""P3 runner: grade + dedupe + conflict + confidence over runs/p2/Q*.json -> runs/p3/Q*.json."""
import csv
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app import dedupe
from app.conflict import classify, find_candidates
from app.confidence import confidence
from app.grade import data_kind, grade_source

MAX_PAIRS = 6  # LLM cause labels per sub-question (cost cap); the rest are listed as unlabelled
SRC = {r["id"]: r for r in csv.DictReader(open(ROOT / "corpus/sources.csv", encoding="utf-8"))}
only = sys.argv[1:] or ["Q1", "Q2", "Q3", "Q4", "Q5"]
out_dir = ROOT / "runs" / "p3"
out_dir.mkdir(parents=True, exist_ok=True)

for qid in only:
    d = json.load(open(ROOT / "runs/p2" / f"{qid}.json", encoding="utf-8"))
    result = {"question": d["question"], "subs": []}
    for s in d["subs"]:
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
                           "src_data_date": src["data_date"]})
        pairs = find_candidates(claims)
        conflicts = []
        for n, (a, b, diff) in enumerate(pairs):
            if n < MAX_PAIRS:
                conflicts.append({**classify(a, b, f"{qid}_{s['id']}_conf{n}"), "relative_diff": round(diff, 3),
                                  "synthetic_involved": bool(a["is_synthetic"] or b["is_synthetic"])})
            else:
                conflicts.append({"claim_a": a["claim_id"], "claim_b": b["claim_id"], "cause": "unknown",
                                  "status": "unexplained", "relative_diff": round(diff, 3),
                                  "explanation": "Chưa gán nhãn nguyên nhân (vượt giới hạn số cặp).",
                                  "synthetic_involved": bool(a["is_synthetic"] or b["is_synthetic"])})
        real = [c for c in claims if not c["is_synthetic"]]
        real_ids = {c["claim_id"] for c in real}
        real_conf = [x for x in conflicts if x["claim_a"] in real_ids and x["claim_b"] in real_ids]
        result["subs"].append({
            "id": s["id"], "text": s["text"], "data_kind": kind, "claims": claims, "conflicts": conflicts,
            "pairs_found": len(pairs),
            "verdict_real_only": confidence(real, real_conf),          # headline: no SYNTHETIC evidence
            "verdict_with_synthetic": confidence(claims, conflicts),   # test mode: traps included
        })
    (out_dir / f"{qid}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"== {qid}: {d['question']}")
    for s in result["subs"]:
        gc = {g: sum(c["grade"] == g for c in s["claims"]) for g in "ABCD"}
        print(f"  {s['id']} grades={gc} conflicts={len(s['conflicts'])} "
              f"real={s['verdict_real_only']['level']} | +syn={s['verdict_with_synthetic']['level']}")
