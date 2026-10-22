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
6. [Bộ kiểm thử và kết quả](#bộ-kiểm-thử-và-kết-quả)
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

## Bộ kiểm thử và kết quả

Kỳ vọng của mỗi kịch bản được chốt **trước khi** viết mã và không sửa sau khi thấy kết quả. Kịch bản không đạt được báo cáo nguyên trạng.

Kết quả Mission 3 dưới đây lấy từ báo cáo chấm độc lập vòng chạy thật 2 (`backend/tests/reports/20261021-m3-round2-evaluator.md`). Người chấm biết bản nào là Mission 2, bản nào là Mission 3, nên đây **không phải chấm mù**. "Chế độ thử" nghĩa là có tài liệu tự soạn `SYNTHETIC`; kết quả ở chế độ này chỉ chứng minh cơ chế, không nói gì về thị trường thật.

### Đối chiếu với yêu cầu bộ kiểm thử Mission 3

| Yêu cầu | Dự án đáp ứng bằng | Kết quả |
|---|---|---|
| Chạy lại các test quan trọng của Mission 2 để kiểm tra regression | **R1** (pytest) và **R2** (chạy lại T1-T9 và các bẫy D1-D5 bằng mã Mission 3) | R1 Đạt; **R2 Không đạt**: T1-T9 không có kịch bản nào tụt từ Đạt xuống Không đạt, nhưng bẫy D4 tụt từ Đạt xuống Không đạt |
| Bổ sung tối thiểu 03 test cho phần cải tiến | **T11-T16** (6 test) và **R3** | Xem bảng [Test cho phần cải tiến](#test-cho-phần-cải-tiến) |
| Trong đó có 01 test cho Change Request | **Chưa có.** Dự án không nhận Change Request; mã **T10** được giữ chỗ nhưng chưa viết kỳ vọng, chưa có mã, chưa chạy | Không có kết quả |
| Trong đó có 01 edge case / tình huống khó | **T11** (khó: nguồn yếu mới hơn mâu thuẫn nguồn mạnh); thêm **T12** (khó) và **T13**, **T15** (biên) | T11 Đạt (chế độ thử) |
| Trong đó có 01 regression test cho chức năng cũ | **R3**: câu Q4 phải được từ chối ở cấp tổng thể (chức năng "Chưa đủ căn cứ" của Mission 2) | Đạt có điều kiện |

### Câu hỏi kiểm thử và nơi lưu

| Mã | Câu hỏi | Dùng cho | Nơi lưu |
|---|---|---|---|
| Q1 | Có nên làm game idle RPG cho mobile Việt Nam năm sau không? | T8 | `backend/tests/questions.json` |
| Q2 | Quy mô doanh thu mobile game Việt Nam gần nhất là bao nhiêu? | T2, câu cha của T14 | `backend/tests/questions.json` |
| Q3 | Quy định hiện hành về phát hành game online tại Việt Nam là gì? | T1, T9, câu cha của T15 | `backend/tests/questions.json` |
| Q4 | Retention D7 của game X của Gamota quý gần nhất là bao nhiêu? | T5, R3 | `backend/tests/questions.json` |
| Q5 | Người chơi phàn nàn gì nhiều nhất về game đối thủ Y? | T8, từ chối tổng thể | `backend/tests/questions.json` |
| A | Doanh thu nhóm game idle RPG tăng bao nhiêu trong quý II/2026? | T3 (trùng nguồn) | `backend/tests/run_eval.py` |
| B | Thể loại idle RPG chiếm bao nhiêu phần trăm lượt tải mobile game Việt Nam năm 2025? | bẫy D4 | `backend/tests/run_eval.py` |
| AMB | Thị trường game casual thế nào? | T6 (câu mơ hồ) | `backend/tests/run_eval.py` |
| T7 | 3 truy vấn vào hai báo cáo PDF có bảng (S005, S006) | T7 | `backend/tests/run_eval.py` |
| X1 | Thị trường game nông trại trên mobile tại Việt Nam năm 2025 có bao nhiêu lượt tải? | T11 | `backend/scripts/m3_live.py` |
| X2 | Doanh thu game cờ tướng trên mobile tại Việt Nam năm 2025 là bao nhiêu? | T12 | `backend/scripts/m3_live.py` |
| X3 | Doanh thu game đua xe trên mobile tại Việt Nam là bao nhiêu? | T13 | `backend/scripts/m3_live.py` |
| T14 | (hỏi tiếp từ Q2, sau khi loại nguồn S017) Riêng nhóm game nhập vai thì chiếm bao nhiêu trong đó? | T14 | `backend/scripts/m3_live.py` |
| T15 | (hỏi tiếp từ Q3) Giá cà phê Robusta Tây Nguyên tháng 9/2026 thế nào? | T15 | `backend/scripts/m3_live.py` |

Ngoài ra: `backend/tests/retrieval_gold.json` (14 câu có đáp án chuẩn để đo khâu tìm kiếm) và 64 test tự động trong `backend/tests/test_*.py` (mô hình giả, không tốn hạn mức).

### Regression: chạy lại test của Mission 2

| Test | Kiểm tra gì | Mission 2 | Mission 3 (vòng 2) |
|---|---|---|---|
| T1 | Q3, nhiều nguồn rõ ràng: kết luận phải có quy tắc giờ chơi 60/180 phút | Không đạt | Không đạt (đoạn chứa quy tắc không được tìm thấy) |
| T2 | Q2, hai nguồn mạnh cho hai con số do khác định nghĩa | Đạt (chỉ ở chế độ thử) | **Đạt có điều kiện** (lời giải thích dùng kiến thức ngoài claim) |
| T3 | Nhiều bài đăng lại cùng một thông cáo chỉ tính là một nguồn | Đạt | Đạt |
| T4 | Số liệu cũ không được dùng làm kết luận | Đạt | Đạt |
| T5 | Q4, thiếu dữ liệu: phải từ chối | Không đạt | Đạt có điều kiện (xem R3) |
| T6 | Câu hỏi mơ hồ: hỏi lại 1-3 câu trước khi nghiên cứu | Đạt | Đạt |
| T7 | Đọc đúng số trong bảng, biểu đồ PDF | Không đạt | Không đạt (biểu đồ tròn vẫn đọc sai) |
| T8 | So với AI trả lời thẳng: không có con số thiếu căn cứ | Không đạt | Đạt, nhưng hiển nhiên: ở chế độ thật không có câu kết luận nào |
| T9 | Phân biệt dự thảo với văn bản đang có hiệu lực (Q3) | Không đạt | Không đạt |
| D1-D3 | Các bẫy trong tài liệu tự soạn | Đạt | Đạt |
| D4 | Mâu thuẫn thật giữa hai tài liệu tự soạn (SYN07, SYN08) | Đạt | **Không đạt**: mô hình chép sai dấu câu, bước kiểm trích dẫn loại cả hai claim; không phải do luật mới |
| D5 | Tài liệu không liên quan (SYN09) | Không kiểm được | Không kiểm được |
| R1 | pytest | 36 đạt | 58 đạt khi chấm; 64 đạt ở lần chạy gần nhất (tự chạy, chưa qua người chấm) |

### Test cho phần cải tiến

| Test | Loại | Tình huống | Kỳ vọng | Mission 2 | Mission 3 (vòng 2) |
|---|---|---|---|---|---|
| T10 | Change Request | Không có Change Request | Chưa viết | – | **Chưa có** |
| T11 | Khó, chế độ thử | X1: nguồn hạng A nói 12 triệu lượt tải, diễn đàn hạng C mới hơn nói 30 triệu | 12 triệu là căn cứ chính; 30 triệu ghi "nguồn yếu bất đồng", không kéo mức xuống | Không đạt (không thấy mâu thuẫn, hạ nhầm câu 12 triệu) | Đạt. Vòng 1 lần đầu không đạt, đạt sau một lần sửa mã |
| T12 | Khó, chế độ thử | X2: cùng một viện sửa số từ 20 thành 26 triệu USD | Dùng 26 triệu; 20 triệu ghi "đã được cập nhật" | Không đạt | Đạt, có lưu ý về phạm vi |
| T13 | Biên, chế độ thử | X3: chỉ có số liệu năm 2021, 2022 | Từ chối, nêu ngày dữ liệu; số cũ chỉ ở mục lịch sử | Không đạt | Đạt có điều kiện (lý do chỉ nêu năm 2022) |
| T14 | Cải tiến | Hỏi tiếp từ Q2 sau khi loại nguồn S017 | Giữ phạm vi Việt Nam, mobile, doanh thu; không dùng lại S017; không hỏi lại | Hỏi lại để làm rõ | Đạt |
| T15 | Biên | Hỏi tiếp từ Q3 một câu không liên quan | Không kế thừa gì, không kết luận | Không có tính năng | Đạt có điều kiện |
| T16 | Kiểm chứng | Câu "Có thể tin" truy vết được về nguồn | Có mã claim, số có trong đoạn gốc | Không đo | **Không kiểm được đầy đủ**: không câu hỏi con nào được xếp "Có thể tin" |
| R3 | Regression | Q4: Retention D7 nội bộ | Tổng thể "Chưa đủ căn cứ"; gợi ý cần dữ liệu nội bộ của game X | Không đạt (vẫn ghi "Trung bình") | Đạt có điều kiện (gợi ý dữ liệu nội bộ lặp cả ở câu hỏi về mức trung bình ngành) |

### Chỉ số (mục tiêu chốt trước)

| Chỉ số | Mục tiêu | Mission 2 | Mission 3 (vòng 2) | Trạng thái |
|---|---|---|---|---|
| Từ chối đúng ở cấp tổng thể (Q4, Q5, X3) | 100% | 2/3 | 3/3 | Đạt |
| Số liệu cũ hoặc đã thay thế nằm trong "Có thể tin" | 0 | – | 0 | Đạt, nhưng hiển nhiên vì mức này trống |
| Căn cứ chính đúng và liên quan (chấm chặt) | ≥ 90% | 20% | 80% (mẫu 5 câu, đều tự soạn; chế độ thật 0 câu) | Không đạt |
| Câu bị hạ nhầm thành "suy luận" | 0 | 4/5 lần hạ là nhầm | 0 (mẫu 4 câu) | Đạt, mẫu nhỏ |
| Nhãn mức liên quan khớp với người chấm | ≥ 80% | – | 71,6% | Không đạt |
| Regression (Đạt tụt xuống Không đạt) | 0 | – | 1 (D4) | Không đạt |
| Độ ổn định giữa hai lần chạy | đo và báo cáo | không đo | chỉ so được ở T7, và kết quả khác nhau | Chưa đo đầy đủ |

### Hạn chế chính rút ra từ kiểm thử

- Với tài liệu thật, vòng 2 không có câu hỏi con nào có kết luận (0/60; Mission 2: 6/50). Vòng 3 (nhóm tự đo, chưa chấm độc lập) tách chỗ tìm kiếm riêng cho tài liệu thật và có lại câu hỏi con trả lời được ở Q1 và Q3.
- Nguyên nhân chính: tìm kiếm từ khóa bỏ sót số liệu có trong kho, bước kiểm trích dẫn khớp nguyên văn quá chặt (vòng 2 chỉ 59,5% claim qua được), bảng trong PDF bị đọc sai.

### Báo cáo đầy đủ (tiếng Việt) trong `backend/tests/reports/`

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
| `RETRIEVE_SYNTHETIC` | Không | `0` = không tìm tài liệu SYNTHETIC ở lượt chạy thường, tiết kiệm hạn mức; câu hỏi bẫy X1-X3 khi đó không còn gì để xem (mặc định `1`) |
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

Trong sản phẩm, danh sách giới hạn chỉ còn được in kèm khi lưu memo thành PDF và ghi trong tệp Word xuất ra; giao diện web không còn trang riêng cho giới hạn.
