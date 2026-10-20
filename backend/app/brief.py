from app.jsonllm import call_model
from app.schemas import Brief, FollowupBrief

SYSTEM = (
    "Bạn là trợ lý nghiên cứu thị trường game cho một nhà phát hành game Việt Nam. "
    "Từ câu hỏi nghiên cứu, lập brief: quyết định cần đưa ra, phạm vi, 3-5 câu hỏi con "
    "(mỗi câu có search_query là từ khóa tiếng Việt ngắn, search_query_en là từ khóa tiếng Anh tương đương để tìm tài liệu tiếng Anh, và evidence_type), "
    "tối đa 3 câu hỏi làm rõ. Không trả lời câu hỏi, không bịa số liệu. "
    "Chỉ đặt needs_clarification=true khi KHÔNG xác định được chủ đề nghiên cứu hoặc quyết định cần đưa ra "
    "(ví dụ câu chỉ hỏi chung chung 'Thị trường game casual thế nào?' mà không nói quyết định, phạm vi hay thời gian); "
    "khi đó đưa 1-3 câu hỏi làm rõ và để sub_questions rỗng. "
    "Nếu câu hỏi đã nêu rõ chủ đề, thị trường và loại thông tin cần (kể cả khi thiếu chi tiết như tên game, "
    "ngân sách hay năm) thì BẮT BUỘC needs_clarification=false và có 3-5 câu hỏi con; các điều còn thiếu ghi vào "
    "clarifying_questions (tối đa 3) để người dùng bổ sung sau. "
    "Không đưa tên tổ chức/nhà cung cấp dữ liệu hay năm cụ thể vào câu hỏi con nếu câu hỏi gốc không nêu. "
    "Với mỗi câu hỏi con, đặt core=true nếu câu hỏi con đó trả lời TRỰC TIẾP câu hỏi gốc (thường 1-2 câu), "
    "core=false nếu chỉ là thông tin bổ trợ hoặc bối cảnh."
)

FOLLOWUP = (
    "Đây là câu hỏi TIẾP THEO trong cùng một nghiên cứu. Bối cảnh của nghiên cứu trước được cho bên dưới. "
    "Nếu câu hỏi mới liên quan đến nghiên cứu trước, đặt related_to_parent=true, giữ nguyên quyết định, phạm vi "
    "(thị trường, nền tảng, thời gian) trừ khi câu hỏi mới nói khác, và viết các câu hỏi con đầy đủ phạm vi đó; "
    "ưu tiên các khoảng trống chưa có căn cứ nếu câu hỏi mới nhắm vào chúng. Không đặt needs_clarification chỉ vì "
    "câu hỏi mới ngắn khi bối cảnh đã đủ. Nếu câu hỏi mới KHÔNG liên quan đến nghiên cứu trước, đặt "
    "related_to_parent=false và lập brief độc lập, không dùng bối cảnh."
)


def make_brief(question: str, tag: str = "brief", context: dict | None = None) -> tuple[Brief, int]:
    if not context:
        return call_model(Brief, [{"role": "system", "content": SYSTEM},
                                  {"role": "user", "content": question}], tag)
    lines = [f"Câu hỏi trước: {context['parent_question']}",
             f"Quyết định: {context.get('decision', '')}",
             f"Phạm vi: {context.get('scope', '')}",
             "Khoảng trống chưa có căn cứ: " + ("; ".join(context.get("gaps") or []) or "không có")]
    nl = chr(10)
    user = f"BỐI CẢNH NGHIÊN CỨU TRƯỚC:{nl}{nl.join(lines)}{nl}{nl}CÂU HỎI MỚI: {question}"
    return call_model(FollowupBrief, [{"role": "system", "content": SYSTEM + " " + FOLLOWUP},
                                      {"role": "user", "content": user}], tag)
