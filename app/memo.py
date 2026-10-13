"""Memo generation (step 7). The LLM writes points from approved A/B claims using claim IDs only;
code decides confidence, refusal, labels, citations and removes/relabels any unsupported 'fact' sentence."""
import re

from pydantic import BaseModel

from app.confidence import NEI
from app.jsonllm import call_model
from app.verify import numbers_in

LEVEL_ORDER = {"Low": 0, "Medium": 1, "High": 2}
DRAFT = re.compile(r"dự thảo|đề xuất|dự kiến|draft|proposed", re.I)


class Point(BaseModel):
    sub_id: str
    text: str
    claim_ids: list[str]
    is_fact: bool


class MemoOut(BaseModel):
    points: list[Point]


SYSTEM = (
    "Bạn viết các luận điểm cho memo nghiên cứu từ DANH SÁCH CLAIM đã được duyệt. QUY TẮC: "
    "chỉ dùng thông tin có trong claim; mọi con số phải lấy nguyên từ claim; mỗi luận điểm là MỘT câu tiếng Việt "
    "và liệt kê claim_ids (đúng mã C-xxxxxxxx) làm căn cứ; is_fact=true cho câu nêu sự kiện/số liệu từ claim, "
    "is_fact=false cho nhận định suy luận của bạn. Không thêm kiến thức ngoài. Nếu hai claim khác nhau về số liệu, "
    "nêu cả hai và không chọn bừa. Mỗi câu hỏi con 1-3 luận điểm."
)


def _status(claim: dict) -> str:
    text = " ".join([claim["content"], claim.get("scope") or "", claim.get("passage") or ""])
    return "draft" if DRAFT.search(text) else "in_force_or_data"


def _cite(claim: dict) -> str:
    year = claim.get("src_data_date") or claim.get("src_publish_date") or "không rõ"
    syn = ", SYNTHETIC" if claim.get("is_synthetic") else ""
    return f"{claim['claim_id']}: {claim['source_id']}, hạng {claim['grade']}, dữ liệu {year}{syn}"


def _numbers_ok(text: str, claims: list[dict]) -> bool:
    pool = {f for c in claims for s in numbers_in(c["content"] + " " + (c.get("passage") or "")) for f in s}
    return all(forms & pool for forms in numbers_in(text))


def build(p3: dict, mode: str, tag: str) -> dict:
    """mode 'real' = no SYNTHETIC claims (headline memo); 'test' = SYNTHETIC included, labelled."""
    vkey = "verdict_real_only" if mode == "real" else "verdict_with_synthetic"
    subs, answered_input = [], []
    for s in p3["subs"]:
        claims = [c for c in s["claims"] if mode == "test" or not c["is_synthetic"]]
        ids = {c["claim_id"] for c in claims}
        conflicts = [x for x in s["conflicts"] if x["claim_a"] in ids and x["claim_b"] in ids]
        ab = [c for c in claims if c["grade"] in ("A", "B")]
        cd = [c for c in claims if c["grade"] in ("C", "D")]
        v = s[vkey]
        subs.append({"id": s["id"], "text": s["text"], "verdict": v, "ab": ab, "cd": cd, "conflicts": conflicts})
        if not v["refused"] and ab:
            answered_input.append((s, ab))
    raw_points, stats = [], {"llm_fact": 0, "llm_fact_supported": 0, "demoted": 0}
    if answered_input:
        ctx = "\n".join(
            f"[{s['id']}] Câu hỏi con: {s['text']}\n" + "\n".join(
                f"  {c['claim_id']} (nguồn {c['source_id']}, hạng {c['grade']}): {c['content']}" for c in ab)
            for s, ab in answered_input)
        out, _ = call_model(MemoOut, [{"role": "system", "content": SYSTEM}, {"role": "user", "content": ctx}],
                            f"{tag}_memo", max_tokens=6000)
        raw_points = out.points
    by_sub = {s["id"]: s for s in subs}
    points = []
    for p in raw_points:
        sub = by_sub.get(p.sub_id)
        if sub is None:
            continue
        allowed = {c["claim_id"]: c for c in sub["ab"]}
        valid_ids = [i for i in p.claim_ids if i in allowed]
        fact, note = p.is_fact, ""
        if p.is_fact:
            stats["llm_fact"] += 1
            if valid_ids and _numbers_ok(p.text, [allowed[i] for i in valid_ids]):
                stats["llm_fact_supported"] += 1
            else:
                fact, note = False, " (hạ xuống 'suy luận': thiếu claim ID hợp lệ hoặc số không khớp claim)"
                stats["demoted"] += 1
        cited = [allowed[i] for i in valid_ids]
        label = ""
        if any(_status(c) == "draft" for c in cited):
            label = " [DỰ THẢO, chưa có hiệu lực — không phải quy định đang áp dụng]"
        points.append({"sub_id": p.sub_id, "is_fact": fact, "text": p.text + label + note, "claim_ids": valid_ids,
                       "citations": [_cite(c) for c in cited], "draft_flag": bool(label)})
    answered = [s for s in subs if not s["verdict"]["refused"]]
    if answered:
        weakest = min(answered, key=lambda s: LEVEL_ORDER[s["verdict"]["level"]])["verdict"]
        overall = {"level": weakest["level"], "reason": "Mức của phần yếu nhất đã trả lời: " + weakest["reason"]}
    else:
        overall = {"level": NEI, "reason": "Không câu hỏi con nào có đủ căn cứ hạng A/B."}
    gaps = [f"{s['id']}: {s['text']} — {s['verdict']['reason']}" for s in subs if s["verdict"]["refused"]]
    assumptions = []
    for s in subs:
        for x in s["conflicts"]:
            assumptions.append(
                f"Kết luận có thể sai nếu cách giải thích mâu thuẫn ({x['cause']}) không đúng: {x['explanation']}")
        if s["cd"] and not s["verdict"]["refused"]:
            assumptions.append(f"{s['id']}: còn {len(s['cd'])} claim hạng C/D chưa dùng làm căn cứ.")
    next_steps = [f"Bổ sung nguồn hạng A/B cho: {s['text']}" for s in subs if s["verdict"]["refused"]]
    if any(s["conflicts"] for s in subs):
        next_steps.append("Xác minh định nghĩa/phạm vi đo của các con số mâu thuẫn trước khi dùng.")
    memo = {"question": p3["question"], "mode": mode, "overall": overall,
            "analyst_review": "Chưa thực hiện (MVP): claim hạng A/B được duyệt tự động.",
            "subs": [{"id": s["id"], "text": s["text"], "verdict": s["verdict"],
                      "refused_text": NEI if s["verdict"]["refused"] else None,
                      "points": [pt for pt in points if pt["sub_id"] == s["id"]],
                      "conflicts": s["conflicts"],
                      "reference_signals_cd": [{"claim_id": c["claim_id"], "content": c["content"],
                                                "citation": _cite(c)} for c in s["cd"]]} for s in subs],
            "gaps": gaps, "key_assumptions": assumptions[:3], "next_steps": next_steps, "stats": stats}
    memo["markdown"] = render(memo)
    return memo


def render(m: dict) -> str:
    lab = " (CHẾ ĐỘ THỬ BẪY — có tài liệu SYNTHETIC)" if m["mode"] == "test" else ""
    out = [f"# Memo{lab}", f"**Câu hỏi:** {m['question']}", "",
           f"**Mức chắc chắn tổng thể:** {m['overall']['level']} — {m['overall']['reason']}", ""]
    for s in m["subs"]:
        out.append(f"## {s['id']}. {s['text']}")
        if s["refused_text"]:
            out.append(f"**{s['refused_text']}.** {s['verdict']['reason']}")
        else:
            out.append(f"*Mức chắc chắn: {s['verdict']['level']} — {s['verdict']['reason']}*")
            for p in s["points"]:
                tag = "" if p["is_fact"] else " [suy luận]"
                out.append(f"- {p['text']}{tag} ({'; '.join(p['citations']) or 'không có claim'})")
            for x in s["conflicts"]:
                out.append(f"- Mâu thuẫn ({x['cause']}, {x['status']}): {x['explanation']} "
                           f"Gợi ý dùng: {x.get('usage_suggestion', '')}")
        if s["reference_signals_cd"]:
            out.append("Tín hiệu tham khảo hạng C/D (không dùng làm kết luận):")
            out += [f"  - {c['content']} ({c['citation']})" for c in s["reference_signals_cd"]]
        out.append("")
    out += ["## Khoảng trống"] + [f"- {g}" for g in m["gaps"]] + ["", "## Giả định chính (kết luận sai nếu…)"]
    out += [f"- {a}" for a in m["key_assumptions"]] + ["", "## Bước xác minh tiếp theo"]
    out += [f"- {n}" for n in m["next_steps"]] + ["", f"*{m['analyst_review']}*"]
    return "\n".join(out)
