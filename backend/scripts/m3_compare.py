"""Mission 3: compare M2 (runs/p4/round_1) with an M3 folder that has the same layout, with no model call.
Uses the unchanged M2 machine scorer (tests/run_eval.py score_round) plus M3 metrics from spec 09 section 7.

    cd backend && python scripts/m3_compare.py runs/m3/layer_a   -> <folder>/compare.json and compare.md
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import trust  # noqa: E402
from tests import run_eval  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
M2 = ROOT / "runs" / "p4" / "round_1"
KEYS = ["Q1", "Q2", "Q3", "Q4", "Q5", "A", "B"]
SCEN = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "D1", "D2", "D3", "D4", "D5"]


def j(p: Path):
    return json.load(open(p, encoding="utf-8")) if p.exists() else None


def cited_history(p3: dict, memo: dict) -> int:
    """Memo sentences that cite a stale (freshness 0) or superseded claim as their basis."""
    claims = {c["claim_id"]: c for s in p3["subs"] for c in s["claims"]}
    vkey = "verdict_real_only" if memo["mode"] == "real" else "verdict_with_synthetic"
    superseded = {h["claim_id"] for s in p3["subs"] for h in (s[vkey].get("history") or [])
                  if h["code"] == "superseded"}
    bad = 0
    for s in memo["subs"]:
        for p in s["points"]:
            if any(i in claims and (not trust.is_fresh(claims[i]) or i in superseded) for i in p["claim_ids"]):
                bad += 1
    return bad


def per_question(rd: Path, key: str) -> dict:
    p3, out = j(rd / key / "p3.json"), {}
    for mode in ("real", "test"):
        m = j(rd / key / f"memo_{mode}.json")
        if not m:
            continue
        vkey = "verdict_real_only" if mode == "real" else "verdict_with_synthetic"
        pts = [p for s in m["subs"] for p in s["points"]]
        out[mode] = {"overall": m["overall"]["level"],
                     "levels": [s[vkey]["level"] for s in p3["subs"]],
                     "tiers": {t: len(v) for t, v in (m.get("tiers") or {}).items()} or None,
                     "points": len(pts), "fact_points": sum(p["is_fact"] for p in pts),
                     "demoted": (m.get("stats") or {}).get("demoted"),
                     "cited_stale_or_superseded": cited_history(p3, m),
                     "next_steps": len(m.get("next_steps") or [])}
    return out


def main(target: str):
    rd = Path(target) if Path(target).is_absolute() else ROOT / target
    s2, s3 = run_eval.score_round(M2), run_eval.score_round(rd)
    scen = {k: {"M2": s2.get(k, {}).get("status"), "M3": s3.get(k, {}).get("status")} for k in SCEN}
    regress = [k for k, v in scen.items() if v["M2"] == "Pass" and v["M3"] != "Pass"]
    q = {k: {"M2": per_question(M2, k), "M3": per_question(rd, k)} for k in KEYS}
    res = {"scenarios_machine": scen, "machine_regressions_pass_to_not_pass": regress, "questions": q}
    (rd / "compare.json").write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = ["| Scenario | M2 | M3 |", "|---|---|---|"] + [f"| {k} | {v['M2']} | {v['M3']} |" for k, v in scen.items()]
    lines += ["", f"Machine regressions (Pass -> not Pass): {regress or 'none'}", "",
              "| Q | mode | overall M2 -> M3 | sub levels M2 -> M3 | fact points M2 -> M3 | demoted M2 -> M3 | "
              "cites stale/superseded M2 -> M3 | tiers M3 |", "|---|---|---|---|---|---|---|---|"]
    for k in KEYS:
        for mode in ("real", "test"):
            a, b = q[k]["M2"].get(mode), q[k]["M3"].get(mode)
            if a and b:
                lines.append(f"| {k} | {mode} | {a['overall']} -> {b['overall']} | {a['levels']} -> {b['levels']} | "
                             f"{a['fact_points']} -> {b['fact_points']} | {a['demoted']} -> {b['demoted']} | "
                             f"{a['cited_stale_or_superseded']} -> {b['cited_stale_or_superseded']} | {b['tiers']} |")
    (rd / "compare.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main(sys.argv[1])
