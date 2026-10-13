"""A canned LLM for TESTS ONLY (plumbing checks: persistence, review, memo rewrite, export).
Never imported by the product. It builds claims from the retrieved chunk text, so the real code-side checks
(verify, grade, dedupe, conflict, confidence) still run on real corpus passages."""
import json
import re


def _user(messages):
    return next(m["content"] for m in reversed(messages) if m["role"] == "user")


def chat(messages, schema=None, tag="call", max_tokens=1024, timeout=0):
    user = _user(messages)
    if tag.endswith("_brief_a0") and "XYZ-VAGUE" in user and "Làm rõ" not in user:
        out = {"decision": "?", "scope": "?", "needs_clarification": True, "sub_questions": [],
               "clarifying_questions": ["Bạn cần quyết định gì?", "Phạm vi thị trường nào?"]}
    elif "_brief_a" in tag:
        out = {"decision": "Quyết định thử nghiệm", "scope": "Việt Nam", "needs_clarification": False,
               "clarifying_questions": [],
               "sub_questions": [{"id": f"sq{i}", "text": f"Câu hỏi con {i}: giới hạn thời gian chơi game dưới 18 tuổi",
                                  "search_query": "giới hạn thời gian chơi game 60 phút 180 phút",
                                  "search_query_en": "game time limit minors", "evidence_type": "legal"} for i in range(1, 4)]}
    elif "_extract_a" in tag:
        # first chunk in the prompt: "[chunk_id]\n<text>"
        m = re.search(r"\[([^\]]+)\]\n(.+?)(?:\n\n|\Z)", user, re.S)
        text = m.group(2).strip().splitlines()[0][:200] if m else ""
        out = {"claims": [{"content": text, "value": None, "unit": None, "scope": "Việt Nam", "data_date": None,
                           "claim_type": "fact", "passage": text}] if len(text) > 30 else []}
    elif "_conf" in tag:
        out = {"cause": "unknown", "explanation": "Không đủ căn cứ để giải thích.", "usage_suggestion": "Chưa chọn."}
    elif tag.endswith("_memo_a0") or "_memo_a" in tag:
        ids = re.findall(r"(C-[0-9a-f]{8}) \(nguồn", user)
        subs = re.findall(r"\[(sq\d+)\]", user)
        out = {"points": [{"sub_id": subs[0], "text": "Luận điểm thử nghiệm dựa trên claim.", "claim_ids": ids[:1],
                           "is_fact": True}] if ids and subs else []}
    else:
        out = {}
    content = json.dumps(out, ensure_ascii=False)
    return {"content": content, "usage": {}, "latency_s": 0.0, "raw": {}, "run_file": "fake"}
