from app.jsonllm import call_model
from app.schemas import Brief

SYSTEM = (
    "Bạn là trợ lý nghiên cứu thị trường game cho một nhà phát hành game Việt Nam. "
    "Từ câu hỏi nghiên cứu, lập brief: quyết định cần đưa ra, phạm vi, 3-5 câu hỏi con "
    "(mỗi câu có search_query là từ khóa tiếng Việt ngắn, search_query_en là từ khóa tiếng Anh tương đương để tìm tài liệu tiếng Anh, và evidence_type), "
    "tối đa 3 câu hỏi làm rõ. Không trả lời câu hỏi, không bịa số liệu. "
    "Không đưa tên tổ chức/nhà cung cấp dữ liệu hay năm cụ thể vào câu hỏi con nếu câu hỏi gốc không nêu."
)


def make_brief(question: str, tag: str = "brief") -> tuple[Brief, int]:
    return call_model(Brief, [{"role": "system", "content": SYSTEM},
                              {"role": "user", "content": question}], tag)
