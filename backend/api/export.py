"""Word export of a memo with an appendix of approved claims and sources, and the limitations note."""
import io

from docx import Document
from docx.shared import Pt

from app.memo import conflict_line

LEVEL_VI = {"High": "Cao", "Medium": "Trung bình", "Low": "Thấp", "Chưa đủ căn cứ": "Chưa đủ căn cứ"}
LIMITATIONS = [
    "Đây là MVP/prototype do AI biên soạn, không phải sản phẩm hoàn chỉnh; hãy mở đoạn gốc của từng claim trước khi dùng.",
    "Kho nguồn cố định gồm 36 tài liệu, trong đó 18 tài liệu SYNTHETIC tự soạn; chúng không bao giờ được dùng để kết luận về thị trường thật.",
    "Tìm kiếm chỉ dùng từ khóa nên có thể bỏ sót nguồn có trong kho; mức chắc chắn chưa kiểm tra claim có trả lời đúng câu hỏi con hay không.",
    "Phạm vi, năm và chủ thể trong claim do mô hình điền và chưa được kiểm tự động; số trong bảng/biểu đồ PDF có thể bị đọc sai.",
]


def memo_docx(run: dict, effective_p3: dict, reviews: dict[str, dict], stale: bool) -> bytes:
    memo = run["memo"]
    d = Document()
    st = d.styles["Normal"]
    st.font.name = "Arial"
    st.font.size = Pt(10.5)
    d.add_heading("Memo nghiên cứu thị trường game (MVP / prototype)", 0)
    d.add_paragraph(f"Câu hỏi: {run['question']}")
    lvl = memo["overall"]["level"]
    d.add_paragraph(f"Mức chắc chắn tổng thể: {LEVEL_VI.get(lvl, lvl)}. {memo['overall']['reason']}")
    n_ok = sum(1 for r in reviews.values() if r["state"] == "confirmed")
    n_rej = sum(1 for r in reviews.values() if r["state"] == "rejected")
    d.add_paragraph(f"Duyệt của chuyên viên: {n_ok} claim đã xác nhận, {n_rej} claim bị loại khỏi memo."
                    + (" LƯU Ý: memo này chưa phản ánh các thay đổi duyệt gần nhất." if stale else ""))
    fu = memo.get("followup")
    if fu:
        d.add_paragraph(f"Nghiên cứu tiếp từ: {fu['parent_question']} ({fu['parent_id']}). "
                        + (f"Kế thừa phạm vi và {fu.get('inherited', 0)} quyết định duyệt."
                           if fu.get("related") and fu.get("inherit") else "Không kế thừa bối cảnh."))
    tiers = memo.get("tiers")
    if tiers:  # Mission 3: what can be trusted, what is uncertain, what has no basis
        d.add_heading("Tóm tắt: điều gì tin được", 2)
        for key, label in (("supported", "Có thể tin"), ("uncertain", "Chưa chắc chắn"), ("refused", "Chưa có căn cứ")):
            d.add_paragraph(f"{label}: {', '.join(tiers.get(key) or []) or 'không có câu hỏi con nào'}",
                            style="List Bullet")
    for s in memo["subs"]:
        core = " (câu hỏi con chính)" if s["id"] in (memo.get("core") or []) else ""
        d.add_heading(f"{s['id']}. {s['text']}{core}", 2)
        if s["refused_text"]:
            d.add_paragraph(f"Chưa đủ căn cứ. {s['verdict']['reason']}")
            if "searched" in s:
                found = ", ".join(f"{r['source_id']} tr.{r['page']}" for r in s["searched"])
                d.add_paragraph("Đã tìm trong: " + (found or "không tìm thấy đoạn tài liệu nào trong kho"))
        else:
            v = s["verdict"]
            d.add_paragraph(f"Mức chắc chắn: {LEVEL_VI.get(v['level'], v['level'])}. {v['reason']}")
            for p in s["points"]:
                tag = "" if p["is_fact"] else " [suy luận]"
                d.add_paragraph(f"{p['text']}{tag} ({'; '.join(p['citations'])})", style="List Bullet")
        for x in s["conflicts"]:  # every conflict, code- or model-labelled, refused sub-questions included
            d.add_paragraph(conflict_line(x)[2:], style="List Bullet")
        for u in s.get("uncertain", []):
            d.add_paragraph(f"Chưa chắc chắn: {u['text']}", style="List Bullet")
        if s.get("history"):
            d.add_paragraph("Số liệu lịch sử (không dùng làm kết luận):")
            for h in s["history"]:
                d.add_paragraph(f"Dữ liệu {h['data_date']}: {h['content']} ({h['citation']}). {h['text']}",
                                style="List Bullet")
        if s["reference_signals_cd"]:
            d.add_paragraph("Tín hiệu tham khảo hạng C/D (không dùng làm kết luận):")
            for c in s["reference_signals_cd"]:
                d.add_paragraph(f"{c['content']} ({c['citation']})", style="List Bullet")
    for title, items in (("Khoảng trống", memo["gaps"]), ("Giả định chính (kết luận sai nếu...)", memo["key_assumptions"]),
                         ("Nên tìm hiểu tiếp ở đâu", memo["next_steps"])):
        d.add_heading(title, 2)
        for it in items:
            d.add_paragraph(it, style="List Bullet")
    d.add_heading("Giới hạn đã biết", 2)
    for it in LIMITATIONS:
        d.add_paragraph(it, style="List Bullet")
    d.add_page_break()
    d.add_heading("Phụ lục: claim và nguồn", 1)
    t = d.add_table(rows=1, cols=5)
    t.style = "Table Grid"
    for i, h in enumerate(["Mã claim", "Hạng", "Nguồn", "Nội dung", "Duyệt"]):
        t.rows[0].cells[i].text = h
    for s in effective_p3["subs"]:
        for c in s["claims"]:
            if c["is_synthetic"]:
                continue  # SYNTHETIC claims are never part of a real-market memo
            row = t.add_row().cells
            row[0].text = c["claim_id"]
            row[1].text = c["grade"]
            row[2].text = f"{c['source_id']}: {c['source'].get('title', '')}" if c.get("source") else c["source_id"]
            row[3].text = c["content"] + f"\nĐoạn gốc: {c['passage']}"
            row[4].text = {"confirmed": "đã xác nhận", "rejected": "đã loại"}.get(c.get("review"), "chưa duyệt")
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()
