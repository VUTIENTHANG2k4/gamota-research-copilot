"""P3 rule tests. No LLM calls; inputs are built by hand from corpus/sources.csv rows."""
import csv
from pathlib import Path

from app import dedupe
from app.confidence import NEI, confidence
from app.conflict import comparable_value, find_candidates, recheck_cause
from app.grade import grade_source

SRC = {r["id"]: r for r in csv.DictReader(open(Path(__file__).resolve().parent.parent / "corpus/sources.csv", encoding="utf-8"))}


def g(sid, kind="market"):
    return grade_source(SRC[sid], kind)["grade"]


def test_primary_legal_is_A():
    assert g("S001", "legal") == "A"


def test_press_release_by_owner_is_D():          # S014: 825M from Gamota itself
    assert g("S014") == "D"


def test_stale_repost_trap_is_not_AB():           # SYN01: 2021 figure presented as latest
    assert g("SYN01") in ("C", "D")


def test_internal_unverified_is_D():              # SYN10 simulated internal data
    assert g("SYN10") == "D"


def test_methodology_report_with_vendor_conflict_is_B():
    assert g("S004") == "B"


def test_three_reposts_count_as_one_origin():
    assert dedupe.independent_count(["SYN02", "SYN03", "SYN04"]) == 1
    assert dedupe.independent_count(["S007", "S008"]) == 1
    assert dedupe.independent_count(["S016", "S017", "S018"]) == 1
    assert dedupe.independent_count(["S004", "S014"]) == 2


def claim(cid, sid, value, unit, content="Doanh thu mobile game Việt Nam", scope="", data_date=""):
    return {"claim_id": cid, "source_id": sid, "value": value, "unit": unit, "content": content,
            "scope": scope, "data_date": data_date, "passage": "x", "grade": g(sid)}


def test_unit_scaling():
    assert comparable_value(claim("a", "S004", 1.2, "tỷ USD"))[1] == 1.2e9
    assert comparable_value(claim("a", "S004", 700, "triệu USD"))[1] == 7e8


def test_conflict_detected_between_different_origins_only():
    a = claim("a", "SYN05", 700, "triệu USD", scope="gross spend")
    b = claim("b", "SYN06", 490, "triệu USD", scope="net to publisher")
    assert len(find_candidates([a, b])) == 1
    same = [claim("c", "SYN02", 40, "%"), claim("d", "SYN03", 60, "%")]
    assert find_candidates(same) == []            # same origin: not a conflict


def test_within_ten_percent_is_not_conflict():
    assert find_candidates([claim("a", "SYN05", 700, "triệu USD"), claim("b", "S004", 650, "triệu USD")]) == []


def test_year_label_downgraded_when_years_equal():
    a = claim("a", "SYN07", 18, "%", data_date="2025")
    b = claim("b", "SYN08", 9, "%", data_date="2025")
    assert recheck_cause("year", a, b)[0] == "unknown"
    assert recheck_cause("definition", a, b)[0] == "unknown"      # identical scope


def test_year_label_kept_when_years_differ():
    a = claim("a", "SYN01", 600, "triệu USD", data_date="2021")
    b = claim("b", "SYN05", 700, "triệu USD", data_date="2025")
    assert recheck_cause("year", a, b)[0] == "year"


def test_refusal_without_claims_and_without_AB():
    assert confidence([], [])["level"] == NEI
    low = [claim("a", "S014", 825, "triệu USD")]
    r = confidence(low, [])
    assert r["level"] == NEI and r["refused"]


def test_confidence_levels():
    one = [claim("a", "S004", 575, "triệu USD")]
    assert confidence(one, [])["level"] == "Medium"
    two = one + [claim("b", "SYN05", 580, "triệu USD")]
    assert confidence(two, [])["level"] == "High"
    dup = one + [claim("b", "S004", 575, "triệu USD")]
    assert confidence(dup, [])["level"] == "Medium"
    unexplained = [{"claim_a": "a", "claim_b": "b", "status": "unexplained"}]
    assert confidence(two, unexplained)["level"] == "Low"
    explained = [{"claim_a": "a", "claim_b": "b", "status": "explained"}]
    assert confidence(two, explained)["level"] == "Medium"


def test_value_fallback_from_text_when_model_left_it_empty():
    assert comparable_value({"content": "Doanh thu năm 2025 đạt 700 triệu USD", "value": None, "unit": None}) == ("usd", 7e8)
    assert comparable_value({"content": "Doanh thu mobile game đạt 0,6 tỷ USD", "value": None, "unit": None}) == ("usd", 6e8)
    assert comparable_value({"content": "idle RPG chiếm 18% lượt tải", "value": None, "unit": None}) == ("pct", 18.0)
    assert comparable_value({"content": "Tăng trưởng 36,4% so với năm trước", "value": None, "unit": None}) == ("pct", 36.4)


def test_legal_primary_not_downgraded_by_question_wording():
    assert grade_source(SRC["S001"], "reviews")["grade"] == "A"
