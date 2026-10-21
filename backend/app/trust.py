"""Mission 3 trust layer (code, not LLM): for one sub-question, decide what can be trusted, what is still
uncertain and why, what is only history, and where to look next. Rules: docs/spec/09-mission3.md section 3.

Inputs are graded claims (see pipeline.grade_and_decide) and the conflicts already labelled for that
sub-question. The LLM is only used upstream to label the cause of a conflict between two in-window A/B
claims of the same period; every other relation between claims is decided here from metadata.
"""
import csv
import re
from functools import lru_cache
from itertools import combinations
from pathlib import Path

from app import dedupe
from app.conflict import THRESHOLD, comparable_value, similar
from app.grade import parse_data_date

NEI = "Chưa đủ căn cứ"
LEVEL_ORDER = {NEI: -1, "Low": 0, "Medium": 1, "High": 2}
TIER = {"High": "supported", "Medium": "uncertain", "Low": "uncertain", NEI: "refused"}
DRAFT = re.compile(r"dự thảo|đề xuất|lấy ý kiến|draft|proposed", re.I)
# Internal data only when the sub-question is about Gamota's own games (ownership), not when it merely names a
# metric such as D7 or ARPU: market benchmarks for those metrics are public (evaluator, round 1).
INTERNAL = re.compile(r"gamota|\bgame x\b|game mục tiêu|game này|nội bộ|portfolio|của chúng ta|của công ty", re.I)
SRC_PATH = Path(__file__).resolve().parent.parent / "corpus" / "sources.csv"

CODE_TEXT = {
    "single_origin": "Chỉ có 1 nguồn gốc A/B độc lập; chưa có nguồn thứ hai để đối chiếu.",
    "explained_conflict": "Các nguồn A/B cho số khác nhau; nguyên nhân đã được giải thích.",
    "unexplained_conflict": "Các nguồn A/B cho số khác nhau và chưa giải thích được vì sao.",
    "weak_dissent": "Một nguồn yếu hơn (hạng C/D) đưa ra con số khác; không làm thay đổi kết luận nhưng cần biết.",
    "stale": "Số liệu đã cũ so với cửa sổ thời gian của loại dữ liệu này; chỉ giữ làm lịch sử.",
    "superseded": "Đã có bản cập nhật mới hơn từ cùng nguồn gốc; con số cũ chỉ giữ làm lịch sử.",
    "older_period": "Số liệu của kỳ trước; không mâu thuẫn với số của kỳ mới hơn.",
    "draft": "Nội dung dự thảo / đề xuất, chưa phải quy định đang áp dụng.",
    "partial_relevance": "Claim chỉ trả lời một phần câu hỏi con.",
    "relevance_unlabelled": "Chưa có nhãn mức độ liên quan (dữ liệu chạy bằng phiên bản cũ).",
}


@lru_cache
def sources() -> dict[str, dict]:
    return {r["id"]: r for r in csv.DictReader(open(SRC_PATH, encoding="utf-8"))}


def is_fresh(c: dict) -> bool:
    """Legal primary texts are judged by the in-force rule; other sources need freshness points > 0."""
    d = c.get("grade_detail") or {}
    return d.get("kind") == "legal" or (d.get("components") or {}).get("freshness", 1) > 0


def is_draft(c: dict, kind: str) -> bool:
    if kind != "legal":
        return False  # "đề xuất"/"dự kiến" in market text is a forecast, not a draft regulation
    src = sources().get(c["source_id"], {})
    if src.get("source_type") == "legal_primary":
        return False  # the decree text itself is in force (not re-checked for repeal, see grade.py)
    return bool(DRAFT.search(" ".join([c["content"], c.get("scope") or "", c.get("passage") or ""])))


def _pub(c: dict):
    return parse_data_date(c.get("src_publish_date") or "")


def _strong(c: dict) -> bool:
    return c["grade"] in ("A", "B")


YEAR_IN_TEXT = re.compile(r"(?:năm|year|in|FY)\s*(20\d\d)\b", re.I)


def period_year(c: dict) -> int | None:
    """Year the figure is about. From the claim text ("năm 2025"), then the claim's data_date, then the source's
    data date. NOT from the free-text scope: it mixes in publication dates ("bài đăng ngày 20/9/2026"), which made
    a 2025 figure look like 2026 data in the live X1 run (M2's conflict._year reads the scope)."""
    years = [int(y) for y in YEAR_IN_TEXT.findall(c.get("content") or "")]
    if len(set(years)) == 1:
        return years[0]
    d = parse_data_date(c.get("data_date") or "") or parse_data_date(c.get("src_data_date") or "")
    return d.year if d else None


def relations(claims: list[dict], labelled: list[dict]) -> list[dict]:
    """Every pair of comparable claims whose figures differ by more than 10%, with the relation decided by code:
    revision, older_period, stale, weak_dissent, weak_pair, or a labelled conflict (needs_label=True when the
    LLM must say why two in-window A/B claims of the same period differ)."""
    lab = {frozenset((x["claim_a"], x["claim_b"])): x for x in labelled}
    out = []
    for a, b in combinations(claims, 2):
        ca, cb = comparable_value(a), comparable_value(b)
        if not ca or not cb or ca[0] != cb[0]:
            continue
        diff = abs(ca[1] - cb[1]) / max(abs(ca[1]), abs(cb[1]), 1e-9)
        if diff <= THRESHOLD or similar(a, b) < 0.25:
            continue
        rel = {"claim_a": a["claim_id"], "claim_b": b["claim_id"], "relative_diff": round(diff, 3)}
        ya, yb = period_year(a), period_year(b)
        same_origin = dedupe.origin_of(a["source_id"]) == dedupe.origin_of(b["source_id"])
        if same_origin and a["source_id"] != b["source_id"] and (ya is None or yb is None or ya == yb):
            pa, pb = _pub(a), _pub(b)
            if pa and pb and pa != pb:
                old, new = (a, b) if pa < pb else (b, a)
                out.append({**rel, "relation": "revision", "older": old["claim_id"], "newer": new["claim_id"]})
                continue
        if same_origin:
            continue  # same publication or same origin without dates: not an independent disagreement
        if not is_fresh(a) or not is_fresh(b):
            stale = a if not is_fresh(a) else b
            out.append({**rel, "relation": "stale", "older": stale["claim_id"]})
            continue
        if ya and yb and ya != yb:
            old, new = (a, b) if ya < yb else (b, a)
            # a weaker source about a later period never pushes a stronger one into history (found in the live
            # X1 run, 2026-10-21): that case is a weak dissent, handled below
            if _strong(new) or not _strong(old):
                out.append({**rel, "relation": "older_period", "older": old["claim_id"], "years": sorted([ya, yb])})
                continue
        if _strong(a) != _strong(b):
            weak = b if _strong(a) else a
            out.append({**rel, "relation": "weak_dissent", "weak": weak["claim_id"]})
            continue
        if not _strong(a):
            out.append({**rel, "relation": "weak_pair"})
            continue
        x = lab.get(frozenset((a["claim_id"], b["claim_id"])))
        out.append({**rel, "relation": "conflict", "needs_label": x is None,
                    "cause": (x or {}).get("cause", "unknown"),
                    "status": (x or {}).get("status", "unexplained"),
                    "explanation": (x or {}).get("explanation", ""),
                    "usage_suggestion": (x or {}).get("usage_suggestion", "")})
    return out


def _dates(cs: list[dict]) -> str:
    ds = sorted({(c.get("src_data_date") or "không rõ") for c in cs})
    return ", ".join(ds)


def next_steps(sub_text: str, kind: str, codes: set[str], refused: bool, main: list[dict],
               dissent: list[dict]) -> list[str]:
    """Where to look next, from the type of gap. Organisation names only from sources.csv."""
    steps = []
    if refused:
        if INTERNAL.search(sub_text):
            steps.append("Cần dữ liệu nội bộ của Gamota (dashboard/BI vận hành của chính game đó); kho tài liệu công khai "
                         "không thể có số này.")
        elif kind == "legal":
            steps.append("Cần văn bản pháp luật gốc đang có hiệu lực (Công báo, cơ sở dữ liệu văn bản pháp luật) cho nội dung: "
                         f"{sub_text}")
        elif kind == "reviews":
            steps.append("Cần đánh giá của người chơi trong 6 tháng gần nhất (cửa hàng ứng dụng, cộng đồng người chơi).")
        else:
            steps.append("Cần báo cáo ngành có nêu phương pháp và dữ liệu trong 18 tháng gần nhất cho nội dung: "
                         f"{sub_text}")
        if "stale" in codes:
            steps.append("Các số liệu tìm được đã quá cũ; cần số liệu mới hơn cùng phạm vi đo.")
        return steps
    if "single_origin" in codes and main:
        orgs = sorted({sources().get(c["source_id"], {}).get("org") or c["source_id"] for c in main})
        steps.append(f"Tìm một nguồn A/B độc lập thứ hai (khác gốc với: {', '.join(orgs)}) để nâng lên 'Có thể tin'.")
    if "unexplained_conflict" in codes:
        steps.append("Đối chiếu định nghĩa, phạm vi và phương pháp đo của các nguồn đang mâu thuẫn trước khi dùng số.")
    if "explained_conflict" in codes:
        steps.append("Chọn con số theo đúng định nghĩa/phạm vi cần dùng (xem phần mâu thuẫn).")
    if "weak_dissent" in codes and dissent:
        steps.append("Có thể kiểm tra lại nguồn yếu đang cho số khác ("
                     + ", ".join(sorted({c["source_id"] for c in dissent})) + "); hiện không thay đổi kết luận.")
    if "draft" in codes:
        steps.append("Theo dõi văn bản chính thức khi dự thảo được ban hành.")
    if "partial_relevance" in codes:
        steps.append("Tìm nguồn trả lời trực tiếp câu hỏi con thay vì thông tin liên quan một phần.")
    return steps


def evaluate(claims: list[dict], labelled_conflicts: list[dict], kind: str, sub_text: str) -> dict:
    """claims: valid graded claims of ONE sub-question in the chosen mode (SYNTHETIC already filtered out in real mode).
    Returns the verdict (level, reason, refused, independent_ab) plus the trust breakdown."""
    rels = relations(claims, labelled_conflicts)
    by_id = {c["claim_id"]: c for c in claims}
    history, uncertain, background = [], [], []
    hist_ids = set()
    for r in rels:
        if r["relation"] in ("revision", "older_period", "stale"):
            hist_ids.add(r["older"])
    for c in claims:
        if not is_fresh(c):
            hist_ids.add(c["claim_id"])
    # a claim the extractor labelled 'context' (another topic, e.g. racing-game revenue under total market revenue)
    # is background, never a history figure of this sub-question (evaluator, round 1)
    out_of_topic = {i for i in hist_ids if by_id[i].get("answers") == "context"}
    hist_ids -= out_of_topic
    for cid in sorted(hist_ids):
        c = by_id[cid]
        code = ("superseded" if any(r["relation"] == "revision" and r["older"] == cid for r in rels)
                else "stale" if not is_fresh(c) else "older_period")
        history.append({"code": code, "claim_id": cid, "text": CODE_TEXT[code],
                        "data_date": c.get("src_data_date") or "không rõ"})

    drafts = [c for c in claims if is_draft(c, kind)]
    answers = {c["claim_id"]: c.get("answers") for c in claims}
    usable = [c for c in claims if c["claim_id"] not in hist_ids | out_of_topic and c not in drafts]
    background += sorted(out_of_topic)
    for c in usable:
        if answers[c["claim_id"]] == "context":
            background.append(c["claim_id"])
    main = [c for c in usable if _strong(c) and answers[c["claim_id"]] in ("direct", None)]
    partial = [c for c in usable if _strong(c) and answers[c["claim_id"]] == "partial"]
    main_ids = {c["claim_id"] for c in main}

    codes = set()
    if drafts:
        codes.add("draft")
        uncertain.append({"code": "draft", "text": CODE_TEXT["draft"], "claim_ids": [c["claim_id"] for c in drafts]})
    if partial:
        codes.add("partial_relevance")
        uncertain.append({"code": "partial_relevance", "text": CODE_TEXT["partial_relevance"],
                          "claim_ids": [c["claim_id"] for c in partial]})
    dissent = []
    for r in rels:
        if r["relation"] == "weak_dissent" and ({r["claim_a"], r["claim_b"]} & main_ids):
            dissent.append(by_id[r["weak"]])
    if dissent:
        codes.add("weak_dissent")
        uncertain.append({"code": "weak_dissent", "text": CODE_TEXT["weak_dissent"],
                          "claim_ids": sorted({c["claim_id"] for c in dissent})})
    if main and any(answers[c["claim_id"]] is None for c in main):
        codes.add("relevance_unlabelled")

    conflicts = [r for r in rels if r["relation"] == "conflict"
                 and r["claim_a"] in main_ids and r["claim_b"] in main_ids]
    n_ind = dedupe.independent_count([c["source_id"] for c in main])
    base = {"history": history, "uncertain": uncertain, "background": background, "relations": rels,
            "main": sorted(main_ids), "independent_ab": n_ind}

    if not main:
        strong_stale = [by_id[h["claim_id"]] for h in history if _strong(by_id[h["claim_id"]])]
        if any(h["code"] == "stale" for h in history):
            codes.add("stale")
        if strong_stale or history:
            stale_cs = [by_id[h["claim_id"]] for h in history]
            reason = (f"Chỉ có số liệu cũ hoặc đã được thay thế (dữ liệu {_dates(stale_cs)}); "
                      "không dùng làm kết luận.")
        elif partial:
            reason = "Chỉ có claim hạng A/B trả lời một phần câu hỏi con, không viết kết luận."
        elif drafts:
            reason = "Chỉ có nội dung dự thảo / đề xuất, chưa phải quy định đang áp dụng."
        elif claims:
            strong_ctx = [c for c in usable if _strong(c)]
            weak = [c for c in claims if not _strong(c)]
            parts = []
            if strong_ctx:
                parts.append(f"{len(strong_ctx)} claim hạng A/B chỉ là thông tin bối cảnh")
            if weak:
                parts.append(f"{len(weak)} claim hạng C/D")
            reason = ("Chỉ có " + " và ".join(parts) + "; không có claim hạng A/B trả lời trực tiếp nên không viết kết luận."
                      if parts else "Không có claim hạng A/B trả lời trực tiếp câu hỏi con.")
        else:
            reason = "Không có claim hợp lệ nào trả lời câu hỏi con."
        return {"level": NEI, "reason": reason, "refused": True, "tier": "refused", **base,
                "codes": sorted(codes), "next_steps": next_steps(sub_text, kind, codes, True, main, dissent)}

    unexplained = [x for x in conflicts if x["status"] == "unexplained"]
    if unexplained:
        level, code = "Low", "unexplained_conflict"
        reason = f"Có {len(unexplained)} mâu thuẫn giữa các nguồn A/B chưa giải thích được."
    elif conflicts:
        level, code = "Medium", "explained_conflict"
        reason = f"Có {len(conflicts)} mâu thuẫn giữa các nguồn A/B, đã giải thích được nguyên nhân."
    elif n_ind >= 2:
        level, code = "High", None
        reason = f"{n_ind} nguồn A/B độc lập (tính theo gốc trích dẫn), số liệu còn trong hạn, không có mâu thuẫn chưa giải thích."
    else:
        level, code = "Medium", "single_origin"
        reason = "Chỉ có 1 nguồn A/B độc lập (các nguồn cùng gốc được tính là một)."
    if code:
        codes.add(code)
        uncertain.insert(0, {"code": code, "text": CODE_TEXT[code],
                             "claim_ids": sorted({i for x in conflicts for i in (x["claim_a"], x["claim_b"])}) or
                             sorted(main_ids)})
    return {"level": level, "reason": reason, "refused": False, "tier": TIER[level], **base,
            "conflicts": conflicts, "codes": sorted(codes),
            "next_steps": next_steps(sub_text, kind, codes, False, main, dissent)}


def overall(subs: list[dict], vkey: str, core_ids: set[str] | None = None) -> dict:
    """Overall verdict over the core sub-questions, refusals counted (fixes M2 defect T5).
    core_ids empty or None -> every sub-question is core."""
    core = [s for s in subs if not core_ids or s["id"] in core_ids] or subs
    refused = [s for s in core if s[vkey]["refused"]]
    others = [s for s in subs if s not in core and s[vkey]["refused"]]
    note = f" Ngoài ra {len(others)} câu hỏi con phụ chưa đủ căn cứ." if others else ""
    if not core:
        return {"level": NEI, "reason": "Không có câu hỏi con nào.", "refused": True}
    if refused:
        return {"level": NEI, "refused": True,
                "reason": f"{len(refused)}/{len(core)} câu hỏi con chính chưa đủ căn cứ ("
                          + ", ".join(s["id"] for s in refused) + "), nên câu hỏi gốc chưa có kết luận." + note}
    weakest = min(core, key=lambda s: LEVEL_ORDER[s[vkey]["level"]])
    return {"level": weakest[vkey]["level"], "refused": False,
            "reason": f"Mức của câu hỏi con chính yếu nhất ({weakest['id']}): {weakest[vkey]['reason']}" + note}
