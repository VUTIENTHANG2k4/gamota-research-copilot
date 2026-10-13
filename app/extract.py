from app.jsonllm import call_model
from app.schemas import ExtractOut

SYSTEM = (
    "Bạn trích claim (nhận định có số liệu hoặc sự kiện cụ thể) từ các đoạn tài liệu để trả lời "
    "câu hỏi con. QUY TẮC: chỉ trích điều đoạn văn nói rõ; không suy diễn, không dùng kiến thức ngoài; "
    "mọi con số và tên riêng trong claim phải xuất hiện nguyên văn trong 'passage'; "
    "'passage' phải là trích dẫn NGUYÊN VĂN (copy chính xác) từ đoạn tài liệu, ngắn gọn (1-3 câu); "
    "ghi rõ phạm vi (thị trường, nền tảng, năm, định nghĩa đo lường) trong 'scope'. "
    "Hãy trích MỌI claim liên quan đến chủ đề của câu hỏi con, kể cả khi năm, nguồn hay định nghĩa khác với câu hỏi; "
    "không loại bỏ chỉ vì khác năm hay khác định nghĩa, mà ghi sự khác biệt đó vào scope. "
    "Chỉ trả claims rỗng khi các đoạn hoàn toàn không liên quan. Viết content bằng tiếng Việt."
)


def extract_claims(sub_question: str, chunks: list[dict], tag: str):
    ctx = "\n\n".join(f"[{c['chunk_id']}]\n{c['text']}" for c in chunks)
    msgs = [{"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Câu hỏi con: {sub_question}\n\nCác đoạn tài liệu:\n{ctx}\n\n"
             "Mỗi claim phải kèm chunk_id nguồn trong trường scope không cần; chỉ cần passage nguyên văn."}]
    return call_model(ExtractOut, msgs, tag)
