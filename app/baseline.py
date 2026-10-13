"""T8 baseline: the LLM answers directly, with no corpus and no claim flow."""
from app import llm

SYSTEM = "Bạn là chuyên gia nghiên cứu thị trường game. Trả lời câu hỏi ngắn gọn bằng tiếng Việt, tối đa một trang."


def answer(question: str, tag: str) -> dict:
    r = llm.chat([{"role": "system", "content": SYSTEM}, {"role": "user", "content": question}],
                 tag=f"{tag}_baseline", max_tokens=4000)
    return {"question": question, "answer": r["content"] or "", "latency_s": r["latency_s"]}
