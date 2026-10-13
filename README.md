# gamota-research-copilot

Trợ lý AI nghiên cứu thị trường game cho Gamota. Nhận một câu hỏi nghiên cứu, trả về **memo 1 trang** gồm kết luận, mức chắc chắn và căn cứ kiểm chứng được: mỗi con số bấm vào là xem được đoạn trích gốc.

> **Trạng thái hiện tại:** MVP/prototype cho cuộc thi (Mission 2), không phải sản phẩm hoàn chỉnh. Pipeline, API, giao diện và bộ kiểm thử đã có; xem `docs/PROGRESS.md` để biết kết quả đo thật và các lỗi còn mở. Chưa deploy.

## Dự án chứng minh điều gì

Một hệ thống AI có thể vừa nhanh vừa đáng tin, nếu:

1. Mọi nhận định đều bám vào nguồn và kiểm tra được bằng code.
2. Nguồn được chấm hạng khác nhau, không coi mọi nguồn ngang nhau.
3. Hệ thống biết nói **"Chưa đủ căn cứ"** khi thiếu dữ liệu, thay vì đoán.

Phần cốt lõi là bộ máy biến nguồn thành nhận định có căn cứ: trích claim, kiểm tra trích dẫn, chấm hạng nguồn, xử lý mâu thuẫn, sinh memo.

## Cấu trúc thư mục

```
gamota-research-copilot/
├── backend/                  # Toàn bộ Python
│   ├── app/                  # Pipeline: brief, retrieve, extract, verify, grade, dedupe, conflict, confidence, memo; llm.py là nơi duy nhất gọi mô hình
│   ├── api/                  # FastAPI: lịch sử, duyệt claim, viết lại memo, xuất Word
│   ├── corpus/               # 30 tài liệu cố định (18 thật, 12 SYNTHETIC), sources.csv
│   ├── scripts/              # Script chạy từng giai đoạn
│   ├── tests/                # pytest, run_eval.py (T1-T9), reports/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                 # Next.js + Tailwind, tiếng Việt
├── docs/                     # Đặc tả, thiết kế, PROGRESS.md, CHANGES.md, DEPLOY.md, api.md
├── .claude/agents/           # Subagent: source-collector, evaluator, ui-builder
├── .github/workflows/ci.yml  # CI: test backend (LLM giả) và build frontend
├── docker-compose.yml        # PostgreSQL cho chạy cục bộ
├── render.yaml               # Render Blueprint (API + PostgreSQL)
├── CLAUDE.md                 # Quy tắc và kế hoạch cho Claude Code (tiếng Anh)
└── .env.example              # Mẫu cấu hình, sao chép thành .env ở thư mục gốc
```

## Chạy cục bộ

```
docker compose up -d                                  # PostgreSQL, cổng 5434
python -m venv .venv && .venv\Scripts\pip install -r backend/requirements.txt
cd backend
..\.venv\Scripts\python -m app.ingest                 # nạp 30 tài liệu (lần đầu)
..\.venv\Scripts\python -m uvicorn api.main:app --port 8000
cd ../frontend && npm install && npm run dev          # http://localhost:3000
```

Kiểm thử: `cd backend && ..\.venv\Scripts\python -m pytest tests -q` (dùng LLM giả, không tốn hạn mức). Hướng dẫn deploy: `docs/DEPLOY.md`.

## Bộ đặc tả

Toàn bộ tài liệu trong `docs/` viết bằng tiếng Anh (giao diện, memo và báo cáo kiểm thử vẫn bằng tiếng Việt).

| File | Nội dung |
|---|---|
| `docs/spec/00-decisions.md` | Các quyết định đã chốt. **Thắng nếu các file khác mâu thuẫn** |
| `docs/spec/01-overview.md` | Tóm tắt MVP, phạm vi, người dùng |
| `docs/spec/02-pipeline-and-requirements.md` | Core loop và yêu cầu chức năng |
| `docs/spec/03-data-model-and-scoring-rules.md` | Mô hình dữ liệu, luật chấm hạng và mức chắc chắn |
| `docs/spec/04-architecture.md` | Kiến trúc, tech stack, chốt chặn chất lượng |
| `docs/spec/05-corpus-and-sample-questions.md` | Kho nguồn, câu hỏi mẫu Q1-Q5 |
| `docs/spec/06-evaluation.md` | Tình huống kiểm thử T1-T9, chỉ số |
| `docs/spec/07-contest-answers.md` | Bản nháp trả lời 3 câu hỏi bắt buộc |
| `docs/spec/08-plan-risks-agents-honesty.md` | Kế hoạch, rủi ro, khung agent, nguyên tắc trung thực |

Vì sao chia nhỏ: `CLAUDE.md` được nạp vào mọi phiên, còn file spec chỉ được đọc khi giai đoạn cần. Bảng "giai đoạn nào đọc file nào" nằm trong `CLAUDE.md`.

## Khung agent

Một agent chính giữ kế hoạch và pipeline, ba subagent chuyên trách:

| Agent | Việc | Giới hạn chính |
|---|---|---|
| Agent chính | Kế hoạch, pipeline từ ingest đến memo | Cập nhật `docs/PROGRESS.md` và `docs/CHANGES.md` mỗi giai đoạn |
| `source-collector` | Thu thập nguồn thật, ghi `sources.csv` | Không viết hay sửa nội dung tài liệu, không bịa metadata |
| `evaluator` | Chạy T1-T9 và baseline, chấm độc lập | Không sửa code, không sửa kỳ vọng |
| `ui-builder` | Dựng giao diện Next.js tiếng Việt | Chỉ bắt đầu sau P4, phải hiển thị trung thực |

## Các giai đoạn (mỗi giai đoạn dừng chờ bạn duyệt)

| GĐ | Việc | Cổng duyệt |
|---|---|---|
| P0 | Khởi tạo repo, docker compose, kiểm tra gọi được OpenRouter | Gọi mô hình thành công |
| P1 | Thu thập kho nguồn thật, soạn tài liệu bẫy SYNTHETIC | Bạn xem danh sách nguồn |
| P2 | ingest, retrieve, extract, verify | Q1-Q5 ra được claim hợp lệ |
| P3 | grade, dedupe, conflict, confidence, từ chối khi thiếu dữ liệu | Bẫy bị bắt, Q4 bị từ chối |
| P4 | memo, baseline, bộ kiểm thử T1-T9 | Bảng kết quả thật |
| P5 | Giao diện Next.js | Demo chạy từ đầu đến cuối |

Nếu hết giờ, cắt từ P5 trở lên. **Không bao giờ cắt P4**: không có kết quả kiểm thử thì không chứng minh được gì.

## Cách bắt đầu

1. Sao chép `.env.example` thành `.env` (ở thư mục gốc), điền `OPENROUTER_API_KEY`.
2. Mở thư mục này bằng Claude Code và yêu cầu: *"Đọc CLAUDE.md và bắt đầu P0."*
3. Cuối mỗi giai đoạn, đọc báo cáo, rồi cho phép làm giai đoạn tiếp theo.

Cần có sẵn: Docker, Python, Node.js. Cú pháp khai báo subagent trong `.claude/agents/` chưa được thử với Claude Code thật; nếu Claude Code không nhận ra, hãy kiểm tra lại định dạng theo tài liệu của nó.

## Nguyên tắc trung thực

1. Không che giấu lỗi hay hạn chế; trình bày chúng rõ ràng và chuyên nghiệp.
2. Không sửa kỳ vọng để kiểm thử đạt. Thất bại là kết quả hợp lệ.
3. Không bịa số liệu, nguồn, URL hay trích dẫn.
4. Tài liệu tự soạn luôn gắn nhãn `SYNTHETIC`.
5. Không gọi sản phẩm là production-ready.
6. Không commit hay in API key.

## Lưu ý về mô hình và dữ liệu

- Mô hình: NVIDIA Nemotron 3 Ultra qua OpenRouter (`nvidia/nemotron-3-ultra-550b-a55b`).
- Endpoint miễn phí (`:free`) có ghi log để NVIDIA cải thiện sản phẩm. Chỉ gửi tài liệu công khai và tài liệu SYNTHETIC; không gửi dữ liệu thật của Gamota.
- Chưa xác minh được OpenRouter hỗ trợ ép JSON schema cho mô hình này đến đâu, chất lượng tiếng Việt và độ trễ. P0 sẽ đo; phương án dự phòng là parse JSON, kiểm tra bằng Pydantic và thử lại tối đa 2 lần.
- Bản đặc tả trên Docs và bản trong `docs/spec/` là hai bản riêng. Bản trong repo là bản Claude Code dùng; nếu sửa tay một bên, bên kia không tự đổi theo.
