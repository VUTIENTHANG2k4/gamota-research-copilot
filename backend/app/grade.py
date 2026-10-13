"""Guardrail 2 (code): source grade A-D from the scoring table in docs/spec/03 (max 9 points)."""
import re
from datetime import date

NOW = date(2026, 10, 13)  # reference date for freshness; fixed so results are reproducible

# Collector labels -> spec "Source type" points (initial proposal approved by the user, see CHANGES.md)
TYPE_POINTS = {"legal_primary": 4, "industry_report": 3, "press": 2, "press_repost": 2,
               "internal": 2, "press_release": 1, "vendor_blog": 1}
WINDOW_MONTHS = {"market": 18, "reviews": 6}


def data_kind(text: str) -> str:
    t = text.lower()
    if re.search(r"quy định|nghị định|giấy phép|xử phạt|dự thảo|pháp luật|luật |decree", t):
        return "legal"
    if re.search(r"phàn nàn|đánh giá|xếp hạng|review", t):
        return "reviews"
    return "market"


def parse_data_date(*fields: str) -> date | None:
    """Latest date mentioned. Year only -> 31 Dec, quarter -> its last day, H1 -> 30 Jun (favourable)."""
    best = None
    for f in fields:
        for m in re.finditer(r"(20\d\d)(?:-(\d\d)|-Q([1-4])| H([12]))?", f or ""):
            y = int(m.group(1))
            if m.group(2):
                mo = int(m.group(2))
                d = date(y, mo, 28)
            elif m.group(3):
                d = date(y, int(m.group(3)) * 3, 28)
            elif m.group(4):
                d = date(y, 6 if m.group(4) == "1" else 12, 28)
            else:
                d = date(y, 12, 28)
            best = d if best is None or d > best else best
    return best


def months_between(d: date, now: date = NOW) -> float:
    return (now.year - d.year) * 12 + (now.month - d.month) + (now.day - d.day) / 30


def freshness_points(src: dict, kind: str) -> tuple[int, str]:
    if kind == "legal":
        if src["source_type"] == "legal_primary":
            return 3, "primary legal text, in-force version at the time of collection (not re-checked for repeal)"
        return 1, "press on regulation: cannot confirm it describes the version in force"
    d = parse_data_date(src.get("data_date"), src.get("publish_date")) if not src.get("data_date") else \
        parse_data_date(src.get("data_date"))
    if d is None:
        return 0, "data date unknown"
    age, win = max(0.0, months_between(d)), WINDOW_MONTHS[kind]  # future-dated (year-only) -> age 0
    if age <= win:
        return 3, f"{age:.0f} months old, window {win}"
    if age <= win * 1.5:
        return 1, f"{age:.0f} months old, partly expired (window {win})"
    return 0, f"{age:.0f} months old, expired (window {win})"


def grade_source(src: dict, kind: str = "market") -> dict:
    if src["source_type"] == "legal_primary":
        kind = "legal"  # a primary legal text is always judged by the in-force rule, whatever the question wording
    t = TYPE_POINTS.get(src["source_type"], 0)
    f, f_why = freshness_points(src, kind)
    meth = {"true": 2, "n/a": 2, "partial": 1}.get((src.get("has_methodology") or "").lower(), 0)
    coi = -2 if (src.get("conflict_of_interest_note") or "").strip() else 0
    total = t + f + meth + coi
    letter = "A" if total >= 8 else "B" if total >= 6 else "C" if total >= 4 else "D"
    return {"source_id": src["id"], "grade": letter, "score": total, "kind": kind,
            "components": {"source_type": t, "freshness": f, "methodology": meth, "conflict_of_interest": coi},
            "freshness_note": f_why}
