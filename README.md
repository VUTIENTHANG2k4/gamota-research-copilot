# gamota-research-copilot

Trợ lý AI nghiên cứu thị trường game cho Gamota. Nhận một câu hỏi nghiên cứu, trả về **memo 1 trang** gồm kết luận, mức chắc chắn kèm lý do và căn cứ kiểm chứng được: mỗi con số dẫn về đoạn trích gốc trong nguồn.

> **MVP / prototype** cho cuộc thi (Mission 2), không phải sản phẩm hoàn chỉnh. Kho nguồn cố định gồm 30 tài liệu (18 tài liệu thật, 12 tài liệu tự soạn gắn nhãn `SYNTHETIC`). Kết quả đo thật và các lỗi còn mở nằm trong `docs/PROGRESS.md`.

## Dự án chứng minh điều gì

Một hệ thống AI có thể vừa nhanh vừa đáng tin, nếu:

1. Mọi nhận định đều bám vào nguồn và được kiểm tra bằng code, không chỉ dựa vào mô hình.
2. Nguồn được chấm hạng A-D, không coi mọi nguồn ngang nhau.
3. Hệ thống biết nói **"Chưa đủ căn cứ"** khi thiếu dữ liệu, thay vì đoán.

## Cách hoạt động

Câu hỏi → brief (làm rõ phạm vi) → truy xuất đoạn tài liệu → trích claim (mô hình) → **kiểm tra trích dẫn (code)** → **chấm hạng nguồn, gộp nguồn trùng gốc (code)** → đối soát mâu thuẫn → **mức chắc chắn theo luật cứng (code)** → chuyên viên xác nhận hoặc loại claim → memo.

Người dùng có thể xác nhận hoặc loại từng claim, trả lời câu hỏi làm rõ, viết lại memo, xuất Word, lưu PDF và xem lại lịch sử.

## Cấu trúc thư mục

```
gamota-research-copilot/
├── backend/            # Python: pipeline, API, kho tài liệu, kiểm thử
│   ├── app/            # Pipeline; llm.py là nơi duy nhất gọi mô hình
│   ├── api/            # FastAPI: lịch sử, duyệt claim, viết lại memo, xuất Word
│   ├── corpus/         # 30 tài liệu cố định và sources.csv
│   ├── scripts/
│   ├── tests/          # pytest, run_eval.py (T1-T9), reports/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/           # Next.js + Tailwind, tiếng Việt
├── docs/               # Đặc tả, thiết kế, PROGRESS.md, CHANGES.md, DEPLOY.md, api.md
├── .github/workflows/  # CI: test backend (LLM giả) và build frontend
├── docker-compose.yml  # PostgreSQL cho chạy cục bộ
├── render.yaml         # Render Blueprint (API + PostgreSQL)
└── .env.example        # Mẫu cấu hình, sao chép thành .env ở thư mục gốc
```

Công nghệ: Python 3.12, FastAPI, PostgreSQL, tìm kiếm từ khóa BM25; Next.js; mô hình NVIDIA Nemotron 3 Ultra qua OpenRouter (đổi bằng biến môi trường `LLM_MODEL`).

## Chạy cục bộ

```
docker compose up -d                                  # PostgreSQL, cổng 5434
python -m venv .venv && .venv\Scripts\pip install -r backend/requirements.txt
cd backend
..\.venv\Scripts\python -m app.ingest                 # nạp 30 tài liệu (lần đầu)
..\.venv\Scripts\python -m uvicorn api.main:app --port 8000
cd ../frontend && npm install && npm run dev          # http://localhost:3000
```

Cần sao chép `.env.example` thành `.env` ở thư mục gốc và điền `OPENROUTER_API_KEY`. Không bao giờ commit `.env`.

Kiểm thử: `cd backend && ..\.venv\Scripts\python -m pytest tests -q` (dùng mô hình giả, không tốn hạn mức).

## Triển khai

Giao diện trên Vercel, API và PostgreSQL trên Render, tự động deploy khi đẩy lên `main`. Hướng dẫn từng bước và cách đổi model hoặc key sau khi deploy: `docs/DEPLOY.md`.

## Tài liệu

| Tệp | Nội dung |
|---|---|
| `docs/PROGRESS.md` | Tiến độ, số đo thật, lỗi còn mở |
| `docs/CHANGES.md` | Các thay đổi so với kế hoạch ban đầu và lý do |
| `docs/DEPLOY.md` | Hướng dẫn triển khai |
| `docs/api.md` | Hợp đồng API |
| `docs/design/DESIGN.md` | Thiết kế giao diện |
| `docs/spec/` | Đặc tả chi tiết (tiếng Anh) |
| `backend/tests/reports/` | Báo cáo kiểm thử (tiếng Việt) |

## Giới hạn đáng biết

- Đây là prototype: kết quả phải được người dùng đối chiếu với đoạn trích gốc trước khi dùng.
- Kho nguồn chỉ có 30 tài liệu cố định; câu hỏi ngoài phạm vi sẽ nhận "Chưa đủ căn cứ".
- Tài liệu `SYNTHETIC` chỉ để thử các tình huống bẫy, không dùng để rút kết luận về thị trường thật.
- Sản phẩm chưa có đăng nhập: ai có link đều chạy được câu hỏi và dùng hạn mức mô hình của người triển khai.
- Endpoint miễn phí `:free` của mô hình có ghi log sử dụng; chỉ gửi tài liệu công khai và SYNTHETIC, không gửi dữ liệu thật của Gamota.

Danh sách đầy đủ có ở trang "Giới hạn đã biết" trong giao diện.
