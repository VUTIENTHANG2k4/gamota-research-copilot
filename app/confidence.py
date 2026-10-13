"""Guardrail 3 (code): confidence from hard rules in docs/spec/03, plus the refusal rule."""
from app import dedupe

NEI = "Chưa đủ căn cứ"


def confidence(claims: list[dict], conflicts: list[dict]) -> dict:
    """claims: valid, graded claims for ONE sub-question (each has source_id, grade, claim_id).
    conflicts: conflict dicts between those claims (claim_a, claim_b, status)."""
    if not claims:
        return {"level": NEI, "reason": "Không có claim hợp lệ nào trả lời câu hỏi con.", "refused": True}
    ab = [c for c in claims if c["grade"] in ("A", "B")]
    if not ab:
        return {"level": NEI, "refused": True,
                "reason": f"Chỉ có {len(claims)} claim hạng C/D, không có claim hạng A/B nên không viết kết luận."}
    ab_ids = {c["claim_id"] for c in ab}
    rel = [x for x in conflicts if x["claim_a"] in ab_ids or x["claim_b"] in ab_ids]
    unexplained = [x for x in rel if x["status"] == "unexplained"]
    n_ind = dedupe.independent_count([c["source_id"] for c in ab])
    if unexplained:
        return {"level": "Low", "refused": False, "independent_ab": n_ind,
                "reason": f"Có {len(unexplained)} mâu thuẫn chưa giải thích được liên quan claim hạng A/B."}
    if rel:
        return {"level": "Medium", "refused": False, "independent_ab": n_ind,
                "reason": f"Có {len(rel)} mâu thuẫn nhưng đã giải thích được nguyên nhân."}
    if n_ind >= 2:
        return {"level": "High", "refused": False, "independent_ab": n_ind,
                "reason": f"{n_ind} nguồn A/B độc lập (tính theo gốc trích dẫn), không có mâu thuẫn số liệu được phát hiện."}
    return {"level": "Medium", "refused": False, "independent_ab": n_ind,
            "reason": "Chỉ có 1 nguồn A/B độc lập (các nguồn cùng gốc được tính là một)."}
