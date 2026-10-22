"""Memo generation (step 7). The LLM writes points from the main evidence (A/B, in window, not superseded,
not draft) using claim IDs only; code decides tiers, confidence, refusal, labels, citations, where to look next,
and relabels any unsupported 'fact' sentence."""
import re

from pydantic import BaseModel

from app import trust
from app.jsonllm import call_model
from app.trust import NEI
from app.verify import numbers_in

LEVEL_ORDER = {"Low": 0, "Medium": 1, "High": 2}
DRAFT = re.compile(r"dự thảo|đề xuất|dự kiến|draft|proposed", re.I)
ID_TOKEN = re.compile(r"\bC-[0-9a-f]{8}\b|\bSYN\d+\b|\bS\d{3}\b|\bsq\d+\b", re.I)


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
    "nêu cả hai và không chọn bừa. Mỗi câu hỏi con 1-3 luận điểm. Giữ đúng trạng thái của số liệu như trong claim: "
    "số đã đạt thì viết 'đạt', không đổi thành 'dự báo', 'ước tính' hay 'dự kiến'; chỉ dùng các từ đó khi chính claim "
    "dùng chúng. Không đổi phạm vi của số liệu (ví dụ không gọi doanh thu thực nhận là tổng doanh thu thị trường)."
)
HEDGE = re.compile(r"dự báo|ước tính|ước đạt|dự kiến|forecast|estimate", re.I)


def _status_words_ok(text: str, claims: list[dict]) -> bool:
    """Code check (Mission 3, evaluator round 1): a sentence may call a figure a forecast/estimate only if a cited
    claim or its passage does; 'đạt' turned into 'dự báo' misstates the evidence."""
    if not HEDGE.search(text):
        return True
    return any(HEDGE.search(c["content"] + " " + (c.get("passage") or "")) for c in claims)


def _status(claim: dict) -> str:
    text = " ".join([claim["content"], claim.get("scope") or "", claim.get("passage") or ""])
    return "draft" if DRAFT.search(text) else "in_force_or_data"


def _cite(claim: dict) -> str:
    year = claim.get("src_data_date") or claim.get("src_publish_date") or "không rõ"
    syn = ", SYNTHETIC" if claim.get("is_synthetic") else ""
    return f"{claim['claim_id']}: {claim['source_id']}, hạng {claim['grade']}, dữ liệu {year}{syn}"


def _numbers_ok(text: str, claims: list[dict]) -> bool:
    """Every number in the sentence must appear in a cited claim or its passage. Digits inside IDs such as
    'SYN05', 'S014' or 'C-dff7cd85' are not figures (M2 defect: 4 of 5 demotions were false)."""
    pool = {f for c in claims for s in numbers_in(c["content"] + " " + (c.get("passage") or "")) for f in s}
    return all(forms & pool for forms in numbers_in(ID_TOKEN.sub(" ", text)))


def conflict_line(x: dict) -> str:
    """One conflict as text, whether code or the model labelled it (memo markdown and Word export)."""
    who = "code xếp loại" if x.get("decided_by") == "code" else "AI gán nguyên nhân"
    tip = f" Gợi ý dùng: {x['usage_suggestion']}" if x.get("usage_suggestion") else ""
    return (f"- Mâu thuẫn {x['claim_a']} / {x['claim_b']} ({x['cause']}, {x['status']}, {who}): "
            f"{x['explanation']}{tip}")


def build(p3: dict, mode: str, tag: str) -> dict:
    """mode 'real' = no SYNTHETIC claims (headline memo); 'test' = SYNTHETIC included, labelled."""
    vkey = "verdict_real_only" if mode == "real" else "verdict_with_synthetic"
    subs, answered_input = [], []
    for s in p3["subs"]:
        claims = [c for c in s["claims"] if mode == "test" or not c["is_synthetic"]]
        by_id = {c["claim_id"]: c for c in claims}
        ids = set(by_id)
        conflicts = [x for x in s["conflicts"] if x["claim_a"] in ids and x["claim_b"] in ids]
        v = s[vkey]
        main = [by_id[i] for i in v.get("main", []) if i in by_id]
        others = [c for c in claims if c["claim_id"] not in {m["claim_id"] for m in main}]
        subs.append({"id": s["id"], "text": s["text"], "verdict": v, "main": main, "others": others,
                     "kind": s.get("data_kind") or "market",
                     # None when the run predates the saved retrieval list: unknown, not "nothing found"
                     "searched": None if "retrieved" not in s else list({
                         (r["source_id"], r["page"]): r for r in s["retrieved"]
                         if mode == "test" or trust.sources().get(r["source_id"], {}).get("is_synthetic") != "true"
                     }.values()),
                     "conflicts": conflicts, "by_id": by_id})
        if not v["refused"] and main:
            answered_input.append((s, main))
    raw_points, stats = [], {"llm_fact": 0, "llm_fact_supported": 0, "demoted": 0}
    if answered_input:
        ctx = "\n".join(
            f"[{s['id']}] Câu hỏi con: {s['text']}\n" + "\n".join(
                f"  {c['claim_id']} (nguồn {c['source_id']}, hạng {c['grade']}): {c['content']}" for c in main)
            for s, main in answered_input)
        out, _ = call_model(MemoOut, [{"role": "system", "content": SYSTEM}, {"role": "user", "content": ctx}],
                            f"{tag}_memo", max_tokens=6000)
        raw_points = out.points
    by_sub = {s["id"]: s for s in subs}
    points = []
    for p in raw_points:
        sub = by_sub.get(p.sub_id)
        if sub is None or sub["verdict"]["refused"]:
            continue
        allowed = {c["claim_id"]: c for c in sub["main"]}
        valid_ids = [i for i in p.claim_ids if i in allowed]
        fact, note = p.is_fact, ""
        if p.is_fact:
            stats["llm_fact"] += 1
            cited_claims = [allowed[i] for i in valid_ids]
            if not (valid_ids and _numbers_ok(p.text, cited_claims)):
                fact, note = False, " (hạ xuống 'suy luận': thiếu claim ID hợp lệ hoặc số không khớp claim)"
                stats["demoted"] += 1
            elif not _status_words_ok(p.text, cited_claims):
                fact, note = False, (" (hạ xuống 'suy luận': câu gọi số liệu là dự báo/ước tính trong khi claim "
                                     "không nói vậy)")
                stats["demoted"] += 1
                stats["demoted_status_words"] = stats.get("demoted_status_words", 0) + 1
            else:
                stats["llm_fact_supported"] += 1
        cited = [allowed[i] for i in valid_ids]
        label = ""
        if any(_status(c) == "draft" for c in cited):
            label = " [DỰ THẢO, chưa có hiệu lực — không phải quy định đang áp dụng]"
        points.append({"sub_id": p.sub_id, "is_fact": fact, "text": p.text + label + note, "claim_ids": valid_ids,
                       "citations": [_cite(c) for c in cited], "draft_flag": bool(label)})

    overall = trust.overall([{"id": s["id"], vkey: s["verdict"]} for s in subs], vkey, set(p3.get("core") or []))
    tiers = {t: [s["id"] for s in subs if s["verdict"].get("tier", trust.TIER[s["verdict"]["level"]]) == t]
             for t in ("supported", "uncertain", "refused")}
    gaps = [f"{s['id']}: {s['text']} — {s['verdict']['reason']}" for s in subs if s["verdict"]["refused"]]
    assumptions = []
    for s in subs:
        for x in s["conflicts"]:
            if x.get("decided_by") == "llm" and x["claim_a"] in {c["claim_id"] for c in s["main"]}:
                assumptions.append(
                    f"Kết luận có thể sai nếu cách giải thích mâu thuẫn ({x['cause']}) không đúng: {x['explanation']}")
    next_steps = [f"{s['id']}: {step}" for s in subs for step in s["verdict"].get("next_steps", [])]

    def item(s, code_item):
        return {**code_item, "claims": [{"claim_id": i, "content": s["by_id"][i]["content"],
                                         "citation": _cite(s["by_id"][i])} for i in code_item.get("claim_ids", [])
                                        if i in s["by_id"]]}

    memo = {"question": p3["question"], "mode": mode, "overall": overall, "tiers": tiers,
            "followup": p3.get("followup"),
            "core": p3.get("core") or [],
            "analyst_review": "Claim hạng A/B được duyệt tự động; chuyên viên có thể xác nhận hoặc loại claim và viết lại memo.",
            "subs": [{"id": s["id"], "text": s["text"], "verdict": s["verdict"],
                      "tier": s["verdict"].get("tier", trust.TIER[s["verdict"]["level"]]),
                      "refused_text": NEI if s["verdict"]["refused"] else None,
                      "points": [pt for pt in points if pt["sub_id"] == s["id"]],
                      "main_evidence": [{"claim_id": c["claim_id"], "content": c["content"], "citation": _cite(c)}
                                        for c in s["main"]],
                      "uncertain": [item(s, u) for u in s["verdict"].get("uncertain", [])],
                      "history": [{**h, "content": s["by_id"][h["claim_id"]]["content"],
                                   "citation": _cite(s["by_id"][h["claim_id"]])}
                                  for h in s["verdict"].get("history", []) if h["claim_id"] in s["by_id"]],
                      "next_steps": s["verdict"].get("next_steps", []),
                      # what was searched, so a reader can tell "the corpus has nothing" from "retrieval missed it"
                      **({"searched": [{"source_id": r["source_id"], "page": r["page"], "chunk_id": r["chunk_id"]}
                                       for r in s["searched"]] if s["verdict"]["refused"] else []}
                         if s["searched"] is not None else {}),
                      "conflicts": s["conflicts"],
                      "reference_signals_cd": [{"claim_id": c["claim_id"], "citation": _cite(c),
                                                "draft_flag": trust.is_draft(c, s["kind"]),
                                                "content": c["content"] + (" [DỰ THẢO, chưa có hiệu lực]"
                                                                           if trust.is_draft(c, s["kind"]) else "")}
                                               for c in s["others"]
                                               if c["grade"] in ("C", "D")]} for s in subs],
            "gaps": gaps, "key_assumptions": assumptions[:3], "next_steps": next_steps, "stats": stats}
    memo["markdown"] = render(memo)
    return memo


TIER_VI = {"supported": "Có thể tin", "uncertain": "Chưa chắc chắn", "refused": "Chưa có căn cứ"}


def render(m: dict) -> str:
    lab = " (CHẾ ĐỘ THỬ BẪY — có tài liệu SYNTHETIC)" if m["mode"] == "test" else ""
    fu = m.get("followup") or {}
    out = [f"# Memo{lab}", f"**Câu hỏi:** {m['question']}", ""]
    if fu:
        out += [f"*Nghiên cứu tiếp từ: {fu['parent_question']} ({fu['parent_id']}). "
                + (f"Kế thừa phạm vi và {fu.get('inherited', 0)} quyết định duyệt.*"
                   if fu.get("related") and fu.get("inherit")
                   else "Không kế thừa bối cảnh (người dùng bỏ, hoặc câu hỏi mới không liên quan).*"), ""]
    out += [f"**Mức chắc chắn tổng thể:** {m['overall']['level']} — {m['overall']['reason']}", ""]
    tiers = m.get("tiers") or {}
    out.append("**Tóm tắt:** " + "; ".join(f"{TIER_VI[t]}: {', '.join(ids) or 'không có'}"
                                           for t, ids in tiers.items()))
    out.append("")
    for s in m["subs"]:
        out.append(f"## {s['id']}. {s['text']} — {TIER_VI.get(s.get('tier'), '')}")
        if s["refused_text"]:
            out.append(f"**{s['refused_text']}.** {s['verdict']['reason']}")
        else:
            out.append(f"*Mức chắc chắn: {s['verdict']['level']} — {s['verdict']['reason']}*")
            for p in s["points"]:
                tag = "" if p["is_fact"] else " [suy luận]"
                out.append(f"- {p['text']}{tag} ({'; '.join(p['citations']) or 'không có claim'})")
        for u in s.get("uncertain", []):
            out.append(f"- Chưa chắc chắn ({u['code']}): {u['text']}")
        for h in s.get("history", []):
            out.append(f"- Lịch sử ({h['code']}, dữ liệu {h['data_date']}): {h['content']} ({h['citation']})")
        for x in s["conflicts"]:
            out.append(conflict_line(x))
        if s["reference_signals_cd"]:
            out.append("Tín hiệu tham khảo hạng C/D (không dùng làm kết luận):")
            out += [f"  - {c['content']} ({c['citation']})" for c in s["reference_signals_cd"]]
        if s.get("refused_text") and "searched" in s:
            found = ", ".join(f"{r['source_id']} tr.{r['page']}" for r in s.get("searched", []))
            out.append("Đã tìm trong: " + (found or "không tìm thấy đoạn tài liệu nào trong kho"))
        if s.get("next_steps"):
            out.append("Nên tìm tiếp: " + " ".join(s["next_steps"]))
        out.append("")
    out += ["## Khoảng trống"] + [f"- {g}" for g in m["gaps"]] + ["", "## Giả định chính (kết luận sai nếu…)"]
    out += [f"- {a}" for a in m["key_assumptions"]] + ["", "## Nên tìm hiểu tiếp ở đâu"]
    out += [f"- {n}" for n in m["next_steps"]] + ["", f"*{m['analyst_review']}*"]
    return "\n".join(out)
