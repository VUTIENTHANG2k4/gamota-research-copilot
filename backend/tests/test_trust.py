"""Mission 3 trust layer, code only (no model calls). Claims are built from the real sources.csv rows of the
SYNTHETIC test documents SYN13-SYN18, graded by app.grade, as the pipeline does. Expectations come from
docs/spec/09-mission3.md (sections 3 and 5), written before this code."""
import hashlib

from app import trust
from app.confidence import confidence
from app.grade import grade_source
from app.memo import _numbers_ok
from app.trust import NEI


def claim(source_id: str, content: str, kind: str = "market", answers=None, data_date=None) -> dict:
    src = trust.sources()[source_id]
    g = grade_source(src, kind)
    return {"claim_id": "C-" + hashlib.sha1(f"{source_id}|{content}".encode()).hexdigest()[:8],
            "source_id": source_id, "content": content, "scope": "Việt Nam, mobile", "passage": content,
            "grade": g["grade"], "grade_detail": g, "is_synthetic": src["is_synthetic"] == "true",
            "src_data_date": src["data_date"], "src_publish_date": src["publish_date"],
            "data_date": data_date, "answers": answers, "claim_type": "fact"}


FARM = "Game nông trại trên mobile tại Việt Nam năm 2025 đạt {} triệu lượt tải"
CHESS = "Doanh thu game cờ tướng trên mobile tại Việt Nam năm 2025 đạt {} triệu USD"
RACE = "Doanh thu game đua xe trên mobile tại Việt Nam năm {} đạt {} triệu USD"


def test_t11_weak_newer_source_does_not_lower_strong_one():
    a = claim("SYN13", FARM.format(12), answers="direct")
    b = claim("SYN14", FARM.format(30), answers="direct")
    assert (a["grade"], b["grade"]) == ("A", "C")
    v = trust.evaluate([a, b], [], "market", "Thị trường game nông trại có bao nhiêu lượt tải?")
    assert v["level"] == "Medium" and v["tier"] == "uncertain"  # one A origin; NOT lowered to Low by the C source
    assert v["main"] == [a["claim_id"]]
    codes = {u["code"]: u for u in v["uncertain"]}
    assert "weak_dissent" in codes and codes["weak_dissent"]["claim_ids"] == [b["claim_id"]]
    assert "single_origin" in codes
    assert any("nguồn A/B độc lập thứ hai" in s for s in v["next_steps"])


def test_t12_revised_figure_supersedes_preliminary_one():
    old = claim("SYN15", CHESS.format(20), answers="direct")
    new = claim("SYN16", CHESS.format(26), answers="direct")
    v = trust.evaluate([old, new], [], "market", "Doanh thu game cờ tướng 2025?")
    assert v["main"] == [new["claim_id"]]
    assert [h["code"] for h in v["history"]] == ["superseded"] and v["history"][0]["claim_id"] == old["claim_id"]
    assert v["level"] == "Medium" and v["independent_ab"] == 1
    assert not any(r["relation"] == "conflict" for r in v["relations"])  # no LLM label needed


def test_t13_only_stale_sources_is_refused_with_dates():
    a = claim("SYN17", RACE.format(2022, 15), answers="direct")
    b = claim("SYN18", RACE.format(2021, 11), answers="direct")
    v = trust.evaluate([a, b], [], "market", "Doanh thu game đua xe trên mobile tại Việt Nam?")
    assert v["level"] == NEI and v["refused"] and v["tier"] == "refused"
    assert "2021" in v["reason"] and "2022" in v["reason"] and "cũ" in v["reason"]
    assert {h["code"] for h in v["history"]} == {"stale"}
    assert any("18 tháng" in s for s in v["next_steps"])


def test_stale_claim_never_trusted_even_if_strong_type():
    a = claim("SYN17", RACE.format(2022, 15))
    assert a["grade"] == "C" and not trust.is_fresh(a)
    fresh = claim("SYN13", FARM.format(12))
    v = trust.evaluate([a, fresh], [], "market", "x")
    assert a["claim_id"] not in v["main"]


def test_partial_relevance_is_not_main_evidence():
    a = claim("SYN13", FARM.format(12), answers="partial")
    v = trust.evaluate([a], [], "market", "x")
    assert v["refused"] and any(u["code"] == "partial_relevance" for u in v["uncertain"])


def test_two_independent_fresh_sources_are_trusted():
    a = claim("SYN13", FARM.format(12), answers="direct")
    b = claim("SYN16", "Doanh thu game cờ tướng năm 2025 đạt 26 triệu USD", answers="direct")
    v = trust.evaluate([a, b], [], "market", "x")
    assert v["level"] == "High" and v["tier"] == "supported"


def test_regression_m2_confidence_rules_unchanged_where_not_redefined():
    """Same outcomes as app.confidence (M2) for the cases M3 does not redefine: none, C/D only, 1 origin,
    2 origins, same origin twice, unexplained and explained A/B conflicts."""
    one = claim("SYN13", FARM.format(12))
    two = claim("SYN16", "Doanh thu game cờ tướng năm 2025 đạt 26 triệu USD")
    dup = claim("SYN15", "Báo cáo sơ bộ về game cờ tướng phát hành tháng 1/2026")
    low = claim("SYN14", FARM.format(30))
    for cs, conf in (([], []), ([low], []), ([one], []), ([one, two], []), ([two, dup], [])):
        assert trust.evaluate(cs, conf, "market", "x")["level"] == confidence(cs, conf)["level"], cs
    # A/B vs A/B, same period, labelled by the LLM
    b2 = {**claim("SYN05", "Doanh thu mobile game Việt Nam năm 2025 đạt 700 triệu USD")}
    b3 = {**claim("SYN06", "Doanh thu mobile game Việt Nam năm 2025 đạt 490 triệu USD")}
    pair = {"claim_a": b2["claim_id"], "claim_b": b3["claim_id"]}
    for status, level in (("unexplained", "Low"), ("explained", "Medium")):
        lab = [{**pair, "status": status, "cause": "definition" if status == "explained" else "unknown"}]
        assert trust.evaluate([b2, b3], lab, "market", "x")["level"] == level == confidence([b2, b3], lab)["level"]


def test_unlabelled_ab_conflict_is_flagged_for_the_model():
    b2 = claim("SYN05", "Doanh thu mobile game Việt Nam năm 2025 đạt 700 triệu USD")
    b3 = claim("SYN06", "Doanh thu mobile game Việt Nam năm 2025 đạt 490 triệu USD")
    rels = trust.relations([b2, b3], [])
    assert len(rels) == 1 and rels[0]["relation"] == "conflict" and rels[0]["needs_label"]


def test_overall_counts_refused_core_subquestions():
    """M2 defect T5: Q4 showed overall Medium while its core sub-question was refused."""
    sv = lambda lvl: {"level": lvl, "refused": lvl == NEI, "reason": "r"}
    subs = [{"id": "sq1", "v": sv(NEI)}, {"id": "sq2", "v": sv("Medium")}]
    assert trust.overall(subs, "v")["level"] == NEI  # no core flags -> every sub-question is core
    assert trust.overall(subs, "v", {"sq2"})["level"] == "Medium"  # sq1 not core: stays a gap, noted
    assert "phụ" in trust.overall(subs, "v", {"sq2"})["reason"]
    assert trust.overall(subs, "v", {"sq1"})["level"] == NEI


def test_memo_number_check_ignores_digits_inside_ids():
    """M2 defect: 'SYN05' and 'C-dff7cd85' made correct sentences fail the number check."""
    c = {"content": "Doanh thu năm 2025 đạt 700 triệu USD", "passage": "đạt 700 triệu USD năm 2025"}
    assert _numbers_ok("Theo SYN05 (C-dff7cd85), doanh thu năm 2025 đạt 700 triệu USD", [c])
    assert not _numbers_ok("Doanh thu năm 2025 đạt 750 triệu USD", [c])  # a wrong figure is still caught


def test_draft_regulation_is_not_main_evidence():
    a = claim("S009", "Dự thảo đề xuất giới hạn trẻ em chơi game 60 phút mỗi ngày", kind="legal", answers="direct")
    v = trust.evaluate([a], [], "legal", "Quy định thời gian chơi game của trẻ em?")
    assert a["claim_id"] not in v["main"] and any(u["code"] == "draft" for u in v["uncertain"])


def test_internal_data_gap_points_to_internal_data():
    v = trust.evaluate([], [], "market", "Retention D7 thực tế của game X quý gần nhất")
    assert v["refused"] and "nội bộ" in v["next_steps"][0]


def test_live_x1_bug_publication_date_in_scope_does_not_make_a_newer_period():
    """Found in the live M3 run (X1, 2026-10-21): SYN14's scope says 'bài đăng ngày 20/9/2026', the M2 year
    parser read 2026, and the grade A 2025 figure from SYN13 was moved to history as an older period."""
    a = claim("SYN13", FARM.format(12), answers="direct")
    b = claim("SYN14", FARM.format(30), answers="partial")
    b["scope"] = "Ước tính của một thành viên diễn đàn Giả Lập Q (bài đăng ngày 20/9/2026), năm 2025"
    assert trust.period_year(b) == 2025
    v = trust.evaluate([a, b], [], "market", "Tổng lượt tải game nông trại năm 2025?")
    assert v["main"] == [a["claim_id"]] and v["level"] == "Medium" and not v["history"]
    assert any(u["code"] == "weak_dissent" for u in v["uncertain"])


def test_weaker_source_about_a_later_period_does_not_push_a_strong_one_into_history():
    a = claim("SYN13", FARM.format(12), answers="direct")
    b = claim("SYN14", "Năm 2026 game nông trại trên mobile tại Việt Nam có khoảng 30 triệu lượt tải", answers="direct")
    v = trust.evaluate([a, b], [], "market", "x")
    assert a["claim_id"] in v["main"] and not v["history"]


# ---- iteration 2 (fixes for defects found by the evaluator in live round 1) ----

def test_out_of_topic_stale_claim_is_background_not_history():
    """Round 1, Q2: racing-game revenue 2022 (SYN17) appeared as 'history' under total market revenue."""
    race = claim("SYN17", RACE.format(2022, 15), answers="context")
    main = claim("SYN13", FARM.format(12), answers="direct")
    v = trust.evaluate([race, main], [], "market", "Tổng lượt tải?")
    assert race["claim_id"] not in {h["claim_id"] for h in v["history"]}
    assert race["claim_id"] in v["background"]


def test_internal_data_hint_only_for_own_games():
    own = trust.evaluate([], [], "market", "Retention D7 thực tế của game X trong quý gần nhất")
    bench = trust.evaluate([], [], "market", "Retention D7 trung bình của thể loại 4X tại Việt Nam")
    arpu = trust.evaluate([], [], "market", "Xu hướng DAU/MAU và ARPU của game cờ tướng mobile")
    assert "nội bộ" in own["next_steps"][0]
    assert "nội bộ" not in bench["next_steps"][0] and "nội bộ" not in arpu["next_steps"][0]


def test_refusal_reason_names_strong_context_claims():
    """Round 1, Q4 sq1: the reason said 'C/D' for a grade B claim that was only context."""
    b = claim("SYN13", FARM.format(12), answers="context")
    v = trust.evaluate([b], [], "market", "x")
    assert v["refused"] and "A/B chỉ là thông tin bối cảnh" in v["reason"] and "C/D" not in v["reason"]


def test_memo_status_words_check():
    from app.memo import _status_words_ok
    achieved = {"content": "Năm 2025 game nông trại đạt 12 triệu lượt tải", "passage": "đạt 12 triệu lượt tải"}
    forecast = {"content": "Doanh thu dự kiến đạt 430 triệu USD", "passage": "dự kiến đạt 430 triệu USD"}
    assert not _status_words_ok("Năm 2025 game nông trại dự báo đạt 12 triệu lượt tải.", [achieved])
    assert _status_words_ok("Năm 2025 game nông trại đạt 12 triệu lượt tải.", [achieved])
    assert _status_words_ok("Doanh thu dự kiến đạt 430 triệu USD.", [forecast])
