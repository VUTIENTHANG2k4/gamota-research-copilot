# gamota-research-copilot

Trợ lý AI nghiên cứu thị trường game cho Gamota. Nhận một câu hỏi nghiên cứu, trả về **memo một trang** gồm kết luận, mức tin cậy kèm lý do và căn cứ kiểm chứng được: mỗi con số dẫn về đoạn trích gốc trong nguồn. Khi kho tài liệu không đủ căn cứ, memo ghi rõ **"Chưa đủ căn cứ"** và chỉ ra nên tìm tiếp ở đâu, thay vì đoán.

> **MVP / prototype** cho cuộc thi (Mission 2, cải tiến ở Mission 3), không phải sản phẩm hoàn chỉnh. Kho nguồn cố định gồm **36 tài liệu**: 18 tài liệu thật công khai và 18 tài liệu tự soạn gắn nhãn `SYNTHETIC` để thử các tình huống bẫy.

- Giao diện: https://gamota-research-copilot.vercel.app (cần tài khoản, xem mục [Đăng nhập](#đăng-nhập))
- API: https://gamota-copilot-api.onrender.com/api/health

## Mục lục

1. [Bài toán và người dùng](#bài-toán-và-người-dùng)
2. [Cách hoạt động](#cách-hoạt-động)
3. [Mức tin cậy được tính thế nào](#mức-tin-cậy-được-tính-thế-nào)
4. [Giao diện](#giao-diện)
5. [Kho tài liệu](#kho-tài-liệu)
6. [Kết quả kiểm thử](#kết-quả-kiểm-thử)
7. [Cấu trúc thư mục](#cấu-trúc-thư-mục)
8. [Chạy cục bộ](#chạy-cục-bộ)
9. [Triển khai](#triển-khai)
10. [Giới hạn đã biết](#giới-hạn-đã-biết)

## Bài toán và người dùng

Chuyên viên nghiên cứu thị trường cần trả lời nhanh các câu hỏi như "quy mô doanh thu mobile game Việt Nam gần nhất là bao nhiêu?" hay "quy định phát hành game online hiện hành là gì?". Một chatbot thông thường trả lời trôi chảy nhưng có thể bịa số, trộn nguồn yếu với nguồn mạnh, hoặc dùng số liệu đã cũ.

Dự án chứng minh một hệ thống AI có thể vừa nhanh vừa đáng tin, nếu:

1. Mọi nhận định bám vào nguồn và được **kiểm tra bằng code**, không chỉ dựa vào mô hình.
2. Nguồn được **chấm hạng A-D**, không coi mọi nguồn ngang nhau.
3. Hệ thống biết nói **"Chưa đủ căn cứ"** khi thiếu dữ liệu.
4. Người dùng thấy rõ **điều gì tin được, điều gì chưa chắc, vì sao**, và có thể nghiên cứu tiếp mà không mất bối cảnh.

Người dùng chính là chuyên viên nghiên cứu (kiểm tra nguồn, duyệt claim, xuất memo). Người quản lý có thể chỉ đọc memo.

## Cách hoạt động

```
Câu hỏi
  → Brief: làm rõ quyết định, phạm vi, tách 3-5 câu hỏi con, đánh dấu câu hỏi con chính   (mô hình)
  → Truy xuất đoạn tài liệu (BM25 từ khóa Việt + Anh)                                       (code)
  → Trích claim kèm đoạn gốc và nhãn mức liên quan                                          (mô hình)
  → Kiểm tra trích dẫn: số và tên trong claim phải có trong đoạn gốc                        (code)
  → Chấm hạng nguồn A-D, gộp các nguồn trùng gốc                                            (code)
  → Đối soát: bản cập nhật, số liệu cũ, kỳ khác nhau, nguồn yếu bất đồng                    (code)
      chỉ cặp mâu thuẫn giữa hai nguồn A/B cùng kỳ mới nhờ mô hình gán nguyên nhân          (mô hình)
  → Mức tin cậy theo luật cứng                                                              (code)
  → Chuyên viên xác nhận hoặc loại claim (tùy chọn)
  → Memo: mô hình chỉ được viết từ mã claim; câu "sự kiện" không có claim đỡ bị hạ thành "suy luận" (mô hình + code)
```

Bốn chốt chặn luôn chạy bằng code, không giao cho mô hình:

| Chốt chặn | Làm gì |
|---|---|
| Kiểm tra trích dẫn | Claim có số hoặc tên không xuất hiện trong đoạn gốc bị loại |
| Chấm hạng nguồn | Hạng A-D tính từ bảng điểm cố định (loại nguồn, phương pháp, độ mới) |
| Mức tin cậy | Tính theo luật, không để mô hình tự đánh giá |
| Kiểm memo | Câu sự kiện thiếu mã claim, sai số, hoặc tự đổi "đạt" thành "dự báo" bị hạ thành "suy luận" |

`backend/app/llm.py` là nơi duy nhất gọi mô hình (nhiệt độ 0, đầu ra JSON có kiểm tra bằng Pydantic, thử lại tối đa 2 lần). Các lượt gọi độc lập (trích claim theo từng câu hỏi con, gán nguyên nhân mâu thuẫn) chạy song song. Một câu hỏi mất khoảng 3-7 phút và 6-12 lượt gọi mô hình.

## Mức tin cậy được tính thế nào

**Hạng nguồn (A-D):** cộng điểm loại nguồn (văn bản pháp luật gốc cao nhất, blog nhà cung cấp thấp nhất), có nêu phương pháp hay không, và độ mới của dữ liệu so với thời hạn theo loại dữ liệu (ví dụ 18 tháng cho số liệu thị trường). Chỉ claim hạng A/B được dùng làm kết luận; claim hạng C/D chỉ là tín hiệu tham khảo.

**Ba mức tin cho mỗi câu hỏi con** (Mission 3):

| Mức | Khi nào |
|---|---|
| **Có thể tin** | Từ 2 nguồn A/B độc lập trở lên, số liệu còn trong hạn, trả lời trực tiếp, không mâu thuẫn |
| **Chưa chắc chắn** | Có căn cứ A/B nhưng còn lý do dè dặt: chỉ một nguồn gốc, mâu thuẫn đã giải thích, nguồn yếu bất đồng, dự thảo, chỉ trả lời một phần |
| **Chưa có căn cứ** | Không có claim A/B dùng được: không viết kết luận, không ước lượng |

Mỗi mức kèm lý do bằng lời thường và gợi ý **"nên tìm tiếp ở đâu"** (ví dụ "cần dữ liệu nội bộ của Gamota" cho câu hỏi về retention của game nội bộ).

**Xử lý thời gian và độ tin cậy nguồn** (code quyết định, không phải mô hình):

- *Bản cập nhật:* cùng một tổ chức công bố lại số mới thì số cũ ghi "đã có bản cập nhật".
- *Số liệu cũ:* quá thời hạn thì chỉ còn trong mục "Số liệu lịch sử", kèm ngày dữ liệu.
- *Kỳ khác nhau:* số của năm trước không bị coi là mâu thuẫn với số năm nay.
- *Nguồn yếu bất đồng:* nguồn C/D cho số khác nguồn A/B không làm hạ kết luận, nhưng được nêu ra để người dùng biết.

**Mức tổng thể:** chỉ cần một câu hỏi con chính "Chưa đủ căn cứ" là câu hỏi gốc chưa có kết luận.

## Giao diện

Tiếng Việt, gồm 4 bước cho mỗi lượt nghiên cứu:

1. **Brief:** quyết định cần hỗ trợ, phạm vi, câu hỏi con (đánh dấu câu hỏi con chính). Câu hỏi quá mơ hồ thì hệ thống hỏi lại 1-3 câu trước khi chạy.
2. **Kho bằng chứng:** từng claim với hạng nguồn, nhãn SYNTHETIC, mức liên quan (trả lời trực tiếp / một phần / bối cảnh), đoạn gốc tô vàng con số. Chuyên viên xác nhận hoặc loại claim; mức tin được tính lại ngay. Mỗi câu hỏi con có danh sách "đã tìm những tài liệu nào" để phân biệt "kho không có" với "có thể tìm sót".
3. **Đối soát:** các cặp con số lệch nhau, nguyên nhân và gợi ý dùng số nào.
4. **Memo:** mức tổng thể, tóm tắt theo ba mức tin, phần trả lời có căn cứ, danh sách gọn các câu hỏi con chưa đủ căn cứ. Xuất Word, lưu PDF, viết lại memo sau khi duyệt.

Ngoài ra:

- **Nghiên cứu tiếp:** hỏi tiếp từ một memo đã xong. Hệ thống kế thừa phạm vi, khoảng trống và quyết định duyệt (kể cả nguồn đã bị loại). Người dùng xem trước và bỏ được phần kế thừa. Câu hỏi không liên quan thì không kế thừa gì. Tối đa 3 bước nối tiếp.
- **Lịch sử:** lưu trên máy chủ, mọi người dùng thấy chung.
- **Nút "Về trang câu hỏi"** trên mọi trang kết quả để quay lại màn ban đầu.

### Đăng nhập

Tài khoản do người triển khai khai báo trong biến môi trường `APP_USERS`. Không có đăng ký hay quên mật khẩu. Tài khoản dùng thử được gửi riêng, không ghi trong repo công khai.

## Kho tài liệu

| Nhóm | Số lượng | Dùng để |
|---|---|---|
| Tài liệu thật (báo cáo ngành, văn bản pháp luật, báo chí, bài đánh giá) | 18 | Trả lời câu hỏi về thị trường thật |
| Tài liệu `SYNTHETIC` tự soạn | 18 | Thử bẫy: số mâu thuẫn, nguồn trùng gốc, dự thảo, nguồn yếu mới hơn, bản cập nhật, số liệu quá cũ |

Danh mục ở `backend/corpus/sources.csv` (cột `is_synthetic`), nhóm nguồn trùng gốc ở `backend/corpus/origin_groups.csv`. Tài liệu SYNTHETIC luôn mang nhãn trên giao diện và **không bao giờ** được dùng để kết luận về thị trường thật: memo chỉ tính tài liệu thật, kết quả có tài liệu SYNTHETIC chỉ dùng ở chế độ thử.

## Kết quả kiểm thử

Kỳ vọng của mỗi kịch bản được chốt **trước khi** viết mã. Kịch bản không đạt được báo cáo nguyên trạng, không hạ chuẩn.

**Mission 3 so với Mission 2** (evaluator chấm độc lập vòng chạy thật 2; người chấm biết bản nào là Mission 2, bản nào là Mission 3, nên không phải chấm mù):

| Kịch bản | Mission 2 | Mission 3 |
|---|---|---|
| T11: nguồn yếu mới hơn mâu thuẫn với nguồn mạnh (12 so với 30 triệu lượt tải) | Không đạt | Đạt |
| T12: cùng tổ chức sửa số (20 thành 26 triệu USD) | Không đạt | Đạt |
| T13: chỉ có số liệu quá cũ (2021, 2022) | Không đạt | Đạt có điều kiện |
| T14: nghiên cứu tiếp giữ bối cảnh | Hỏi lại để làm rõ | Đạt |
| T15: câu hỏi tiếp không liên quan | Không có tính năng | Đạt có điều kiện |
| T5: từ chối câu hỏi về retention nội bộ | Không đạt | Đạt có điều kiện |
| Từ chối đúng ở cấp tổng thể (Q4, Q5, X3) | 2/3 | 3/3 |
| Câu bị hạ nhầm thành "suy luận" | 4/5 lần hạ là nhầm | 0 |
| T16: câu "Có thể tin" kiểm chứng được | không đo | Không kiểm được đầy đủ: tầng "Có thể tin" trống ở vòng 2 |
| Kiểm thử tự động (pytest, mô hình giả) | 36 | 60 |

**Chưa đạt, báo cáo nguyên trạng:**

- Với tài liệu thật, mọi câu hỏi thật vẫn ra "Chưa đủ căn cứ" ở cấp tổng thể. Số câu hỏi con có kết luận: Mission 2 6/50, Mission 3 vòng 2 0/60. Vòng 3 (tự đo, chưa chấm độc lập) tách chỗ tìm kiếm riêng cho tài liệu thật và có lại câu hỏi con trả lời được ở Q1 và Q3.
- Căn cứ chính đúng và liên quan: 36,4% (vòng 1), 80% (vòng 2), mục tiêu 90%.
- Nhãn mức liên quan khớp với người chấm: 71,6%, mục tiêu 80%.
- T1, T7, T9 vẫn không đạt; bẫy D4 trượt ở vòng 2. Độ ổn định giữa hai lần chạy chưa đo được.
- Nguyên nhân chính: tìm kiếm từ khóa bỏ sót số liệu có trong kho, mô hình trích sót, bảng trong PDF bị đọc sai.

Báo cáo đầy đủ (tiếng Việt) trong `backend/tests/reports/`:

| Tệp | Nội dung |
|---|---|
| `Bao-cao-kiem-thu-gamota-research-copilot.docx` | Mission 2: T1-T9, baseline, bài học |
| `20261013-2115.md` | Mission 2: chấm độc lập |
| `20261021-m3-evaluator.md`, `20261021-m3-round2-evaluator.md` | Mission 3: chấm độc lập vòng 1 và vòng 2 |
| `Bao-cao-Mission3-gamota-research-copilot.docx` | Mission 3: trước và sau, chỉ số, giới hạn còn lại |

## Cấu trúc thư mục

```
gamota-research-copilot/
├── backend/
│   ├── app/                # Pipeline
│   │   ├── llm.py          #   nơi duy nhất gọi mô hình, xoay key khi hết hạn mức
│   │   ├── brief.py        #   brief, câu hỏi con, câu hỏi làm rõ, brief nghiên cứu tiếp
│   │   ├── retrieve.py     #   BM25, tách chỗ cho tài liệu thật và SYNTHETIC
│   │   ├── extract.py      #   trích claim và nhãn mức liên quan
│   │   ├── verify.py       #   kiểm tra trích dẫn
│   │   ├── grade.py        #   hạng nguồn A-D
│   │   ├── dedupe.py       #   gộp nguồn trùng gốc
│   │   ├── trust.py        #   quan hệ giữa claim, ba mức tin, lý do, nên tìm tiếp
│   │   ├── conflict.py     #   mô hình gán nguyên nhân cho mâu thuẫn A/B cùng kỳ
│   │   ├── memo.py         #   viết memo và kiểm memo bằng code
│   │   └── pipeline.py     #   nối các bước
│   ├── api/                # FastAPI: lượt chạy, duyệt, nghiên cứu tiếp, viết lại memo, xuất Word, đăng nhập
│   ├── corpus/             # 36 tài liệu, sources.csv, origin_groups.csv
│   ├── scripts/            # chạy vòng kiểm thử thật, so sánh Mission 2 và Mission 3
│   ├── tests/              # pytest (mô hình giả), run_eval.py, reports/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/               # Next.js + Tailwind, tiếng Việt
│   ├── app/                #   trang: câu hỏi, lượt chạy (brief, bằng chứng, đối soát, memo), đăng nhập
│   ├── components/
│   └── tests/mock_api.py   #   backend giả để thử giao diện không tốn hạn mức
├── .github/workflows/      # CI: test backend và build frontend
├── docker-compose.yml      # PostgreSQL cục bộ (cổng 5434)
├── render.yaml             # Render Blueprint (API + PostgreSQL)
└── .env.example
```

Công nghệ: Python 3.12, FastAPI, PostgreSQL, BM25 (rank-bm25); Next.js, Tailwind; mô hình NVIDIA Nemotron 3 Ultra qua OpenRouter (đổi bằng `LLM_MODEL`).

## Chạy cục bộ

```
docker compose up -d                                  # PostgreSQL, cổng 5434
python -m venv .venv && .venv\Scripts\pip install -r backend/requirements.txt
cd backend
..\.venv\Scripts\python -m app.ingest                 # nạp kho tài liệu (lần đầu; API cũng tự nạp khi khởi động)
..\.venv\Scripts\python -m uvicorn api.main:app --port 8000
cd ../frontend && npm install && npm run dev          # http://localhost:3000
```

Sao chép `.env.example` thành `.env` ở thư mục gốc và điền giá trị. Không bao giờ commit `.env`.

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `OPENROUTER_API_KEY` | Có | Key OpenRouter |
| `OPENROUTER_API_KEYS` | Không | Key dự phòng, cách nhau bằng dấu phẩy; dùng lần lượt khi key trước hết hạn mức ngày |
| `OPENROUTER_BASE_URL`, `LLM_MODEL`, `LLM_TEMPERATURE` | Không | Địa chỉ API, mô hình, nhiệt độ (mặc định 0) |
| `LLM_CONCURRENCY` | Không | Số lượt gọi mô hình song song (mặc định 4; 1 = tuần tự) |
| `DATABASE_URL` | Có | Chuỗi kết nối PostgreSQL |
| `APP_USERS`, `AUTH_SECRET` | Không | Bật đăng nhập: danh sách tài khoản và khóa ký phiên. Không đặt `APP_USERS` thì sản phẩm mở cho mọi người |
| `CORS_ORIGINS`, `CORS_ORIGIN_REGEX` | Không | Địa chỉ giao diện được phép gọi API |
| `NEXT_PUBLIC_API_URL` | Frontend | Địa chỉ API cho giao diện (mặc định `http://localhost:8000`) |

Kiểm thử backend: `cd backend && ..\.venv\Scripts\python -m pytest tests -q` (mô hình giả, không tốn hạn mức, cần PostgreSQL đang chạy).

Thử giao diện không cần mô hình: `.venv\Scripts\python frontend\tests\mock_api.py` (cổng 8001), rồi chạy frontend với `NEXT_PUBLIC_API_URL=http://127.0.0.1:8001`.

## Triển khai

- **Giao diện:** Vercel, thư mục gốc `frontend`, tự deploy khi đẩy lên `main`.
- **API và PostgreSQL:** Render (Blueprint `render.yaml`), tự deploy khi đẩy lên `main`.
- Đổi mô hình, key hay tài khoản bằng biến môi trường trên Render, không cần sửa mã.

**Hạn mức:** bản deploy dùng endpoint miễn phí `:free`, 50 lượt gọi mỗi key mỗi ngày (reset 00:00 UTC, tức 07:00 giờ Việt Nam). Mỗi câu hỏi tốn khoảng 6-12 lượt, nên mỗi key chạy được khoảng 4-8 câu một ngày. Khi hết hạn mức, lượt chạy báo lỗi 429 thay vì trả kết quả sai.

## Giới hạn đã biết

- Đây là prototype: phải mở đoạn gốc của từng claim trước khi dùng kết quả.
- Kho chỉ có 36 tài liệu cố định; câu hỏi ngoài phạm vi sẽ nhận "Chưa đủ căn cứ". Với tài liệu thật, hệ thống hiện còn từ chối nhiều hơn mong muốn.
- Tìm kiếm chỉ dùng từ khóa nên có thể bỏ sót nguồn có trong kho; số trong bảng hoặc biểu đồ PDF có thể bị đọc sai.
- Phạm vi, năm và chủ thể trong claim do mô hình điền; nhãn mức liên quan do mô hình gán và chưa ổn định giữa các lần chạy.
- Kết quả ở chế độ thử (có tài liệu SYNTHETIC) chưa hiện trên trang memo; muốn xem cách hệ thống xử lý các bẫy thì mở bước Đối soát.
- Mỗi câu hỏi mất vài phút; hạn mức miễn phí giới hạn số câu mỗi ngày.
- Đăng nhập đơn giản: không có đăng ký, quên mật khẩu hay phân quyền, mọi người dùng chung một lịch sử. Đủ để chặn người lạ dùng hạn mức mô hình, không phải bảo mật cho dữ liệu thật.
- Endpoint miễn phí `:free` có ghi log sử dụng: chỉ gửi tài liệu công khai và SYNTHETIC, không nhập dữ liệu thật của Gamota hoặc dữ liệu cá nhân.

Giới hạn cũng được in kèm khi lưu memo thành PDF và ghi trong tệp Word xuất ra.
