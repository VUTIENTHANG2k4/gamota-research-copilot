# Báo cáo chấm độc lập Mission 3 (evaluator, chấm mù X/Y) - gamota-research-copilot MVP

Ngày chấm: 2026-10-21. Người chấm: evaluator (không sửa code/dữ liệu, không gọi model). Kỳ vọng và ngưỡng lấy nguyên văn từ `docs/spec/09-mission3.md` (mục 5, 7), không đổi, không diễn giải nới.
Dữ liệu: `backend/runs/m3/blind/X|Y/<key>/`, `runs/m3/round_1/T15`, `runs/m3/round_1_pre_fix/X1`, `runs/m3/round_1/compare.md`, `runs/m3/layer_a/compare.md`, kho `backend/corpus/`. Tài liệu SYNTHETIC là tài liệu tự viết để thử bẫy; mọi kết quả trên SYNTHETIC chỉ chứng minh cơ chế, **không** nói gì về thị trường thật hay Gamota thật.

## 0. Tóm tắt trung thực

- **Tốt hơn ở Y (so với X):** từ chối tổng thể đúng cho Q4, Q5, X3 (3/3 so với 2/3); không còn hạ nhầm câu đúng thành "[suy luận]" (0 lần so với 5/6 lần hạ của X là hạ nhầm); xử lý đúng ba bẫy thời gian/độ tin cậy mới trên SYNTHETIC: nguồn yếu mới hơn (T11, sau một lần sửa code), số đã được cập nhật cùng gốc (T12), mọi số đều cũ (T13); follow-up giữ được bối cảnh và quyết định loại claim của chuyên viên (T14); câu không liên quan không kế thừa gì (T15).
- **Tệ hơn ở Y:** Y **từ chối tổng thể cả 11/11 câu ở cả hai chế độ**. Ở chế độ thật chỉ còn 1/55 câu hỏi con có kết luận (Q3 sq3, mức "Chưa chắc chắn"); tầng "Có thể tin" **trống ở mọi memo**. Một số lần từ chối tổng thể là sai về mặt sử dụng: Q2 (chế độ thử), X1, X2 có câu trả lời trực tiếp ở sq1 nhưng bị kéo xuống "Chưa đủ căn cứ" vì brief đánh dấu một câu hỏi con phụ (tăng trưởng, xu hướng, cơ cấu IAP/quảng cáo) là "core". Đây là nguyên nhân của hồi quy T2 (Pass -> Fail), do luật, không do dao động của model (Layer A cho cùng kết quả).
- **Câu sai/gây hiểu nhầm mới:** memo Y viết "dự báo đạt 12 triệu lượt tải" (nguồn nói số thực tế đã đạt) và "ước tính đạt 26 triệu USD" (nguồn nói số cập nhật đủ 12 tháng); hiển thị doanh thu game đua xe 15 triệu USD như "lịch sử" của tổng doanh thu thị trường (Q2); gợi ý "Cần dữ liệu nội bộ của Gamota" cho các câu hỏi cấp thị trường.
- **Chỉ số mục 7:** đạt 4 mục (từ chối đúng 100%; 0 số cũ trong "Có thể tin" (đạt một cách hiển nhiên vì tầng này trống); 0 hạ nhầm; đồng thuận nhãn liên quan 85,5%); **không đạt** 2 mục (câu bằng chứng chính đúng và liên quan: 8/11 = 72,7% theo cách chấm nới, 4/11 = 36,4% theo cách chấm chặt, mục tiêu ≥90%; hồi quy T1-T9: 1 hồi quy do luật (T2) và 1 Pass -> "Không kiểm được" (D4)).
- **Chưa biết:** độ ổn định (mỗi hệ thống chỉ 1 vòng; không đo được). Tôi không truy vấn được PostgreSQL (kết nối `localhost:5434` hết thời gian chờ), nên phần đối chiếu kho dùng tệp gốc trong `corpus/raw` và `corpus/synthetic`, không dùng bảng `chunks`.
- **Ánh xạ:** tôi tin Y là hệ thống mới (M3), X là M2 (lý do ở mục 9). Việc che mù rất yếu: tôi nhận ra được qua các trường dữ liệu và qua so khớp hash tệp.

## 1. Bảng tổng hợp

### 1.1 T11-T15 (kỳ vọng đăng ký trước, spec 09 mục 5)

| Kịch bản | X | Y | Bằng chứng chính |
|---|---|---|---|
| T11 nguồn yếu mới hơn mâu thuẫn nguồn mạnh cũ hơn (X1) | **Không đạt** | Lần đầu (pre-fix): **Không đạt**; sau sửa: **Đạt có điều kiện** | X: `X/X1/p3.json` không có cặp mâu thuẫn (`pairs_found`=0), câu 12 triệu bị hạ nhầm thành suy luận. Y pre-fix: `round_1_pre_fix/X1` C-02041109 bị gắn `older_period`, sq1 bị từ chối. Y: C-02041109 là bằng chứng chính, C-6b6ca981 là `weak_dissent` |
| T12 số được cập nhật cùng gốc (X2) | **Không đạt** | **Đạt có điều kiện** | X: C-846d660c và C-010404be nêu ngang nhau ("hai mức"). Y: C-099eebca (26) là bằng chứng chính, C-5ff63601 (20) có nhãn `superseded` |
| T13 mọi nguồn đều cũ (X3) | **Không đạt** (từ chối đúng nhưng lý do chung chung) | **Đạt** (có lưu ý nhỏ) | Y sq1: "Chỉ có số liệu cũ hoặc đã được thay thế (dữ liệu 2021, 2022)" |
| T14 follow-up giữ bối cảnh | **Không đạt** (bị chặn bởi cổng hỏi lại) | **Đạt có điều kiện** | X: `X/T14/p2.json` `needs_clarification=true`. Y: `context.json`, `reviews.json` |
| T15 follow-up không liên quan | **Không kiểm được** (không có chức năng/không có lần chạy) | **Đạt có điều kiện** | `round_1/T15`: `related=false`, `inherited=0` |

### 1.2 R2/R3: T1-T9 và bẫy D1-D5 (máy, sau đó chấm tay các mục thay đổi)

| Kịch bản | X (máy / tay) | Y (máy / tay) | Hồi quy? | Nguyên nhân |
|---|---|---|---|---|
| T1 | Fail / Fail | Fail / Fail | Không | Quy tắc 60/180 ở S001 vẫn không được truy xuất; chỉ có ở S009 hạng D |
| T2 | Pass / Pass có điều kiện | Fail / **Fail** | **Có (Pass -> Fail)** | **Luật** (mức tổng thể = mức yếu nhất trong các câu hỏi con core) cộng với lựa chọn core của brief (LLM). Layer A (không gọi model) cũng ra Fail -> không phải do dao động của model |
| T3 | Pass | Pass | Không | |
| T4 | Pass | Pass | Không | |
| T5 | Fail / Fail | Pass / **Đạt có điều kiện (R3)** | Cải thiện | Xem T5/R3. Layer A vẫn Fail -> cải thiện đến từ lần trích xuất mới (nhãn `partial`) chứ không chỉ từ luật |
| T6 | Pass | Pass (3 câu hỏi lại, 0 câu hỏi con) | Không | |
| T7 | Cần chấm tay / Fail | Cần chấm tay / **Fail** | Không | Biểu đồ tròn S006 trang 6 lại bị ghép sai (S006-p6-0); biểu đồ thời gian chơi S006-p5-0 nhiều khả năng gán sai số cho thể loại |
| T8 | Fail | Pass / **Pass** | Cải thiện | MVP chế độ thật 0 số không có căn cứ; Q4 bị từ chối toàn bộ. Baseline là cùng tệp (hash giống nhau) |
| T9 | Fail | Fail / Fail | Không | Không nêu tên Nghị định 147/2024 là căn cứ chính; điều khoản dự thảo trong danh sách C/D không có nhãn dự thảo theo từng mục |
| D1-D3 | Pass | Pass | Không | |
| D4 | Pass | Không kiểm được | **Pass -> Không kiểm được** | **Dao động trích xuất của model**: claim SYN08 bị verify loại ("passage is not a verbatim quote", "entity 'Việt' not in passage"); brief B không có câu hỏi con hỏi trực tiếp tỷ lệ. Layer A ra Pass -> luật M3 không gây ra |
| D5 | Không kiểm được | Không kiểm được (máy) | Không | SYN09 lần đầu được chạm tới trong T15 chế độ thử, chỉ ở dạng tín hiệu C/D (đúng) |

Kết luận R2: mục tiêu "0 hồi quy Pass -> Fail" **không đạt** (T2). Chỉ có một vòng chạy cho mỗi hệ thống, nên độ ổn định **không đo được**; tôi không thể tách hẳn phần dao động của model khỏi phần do luật, ngoài các trường hợp đã có Layer A làm đối chứng (T2, D4, T5).

### 1.3 Chỉ số mục 7

| Chỉ số | Mục tiêu M3 | X | Y | Trạng thái Y |
|---|---|---|---|---|
| Từ chối tổng thể đúng (Q4, Q5, X3) | 100% | 2/3 = 66,7% (Q4 Medium) | 3/3 = 100% | **Đạt**. Lưu ý: Y từ chối 11/11 câu, kể cả câu có câu trả lời (xem mục 6) |
| Claim cũ/đã thay thế trong "Có thể tin" (hoặc làm bằng chứng chính) | 0 | 1 (X2: C-846d660c, số sơ bộ 20 triệu, đứng ngang số cập nhật) | 0 | **Đạt, nhưng hiển nhiên**: "Có thể tin" trống ở 22/22 memo. Có một lỗi gần kề: SYN17 (đua xe 2022) hiện ở mục "Lịch sử" của Q2 sq1 |
| Câu bằng chứng chính đúng và liên quan (kiểm tay toàn bộ) | ≥90% | Nới: 5/15 = 33,3%; chặt: 3/15 = 20,0%; chế độ thật: 0/5 | Nới: 8/11 = 72,7%; chặt: 4/11 = 36,4%; chế độ thật: nới 2/3, chặt 1/3 | **Không đạt** |
| Hạ nhầm bởi kiểm tra số trong memo | 0 | 5/6 lần hạ là hạ nhầm | 0 lần hạ / 10 câu fact | **Đạt** |
| Hồi quy T1-T9 | 0 | - | 1 (T2) + D4 thành "Không kiểm được" | **Không đạt** |
| Đồng thuận nhãn liên quan (`answers`) | ≥80% | (không có nhãn) | 53/62 = 85,5% (tài liệu thật: 23/27 = 85,2%) | **Đạt**, mẫu nghiêng về trường hợp dễ |
| T16: câu fact có claim ID và số có trong đoạn trích | ≥95% (tay) | - | 10/10 câu fact | **Đạt** cho câu fact; "Có thể tin" trống nên điều kiện gốc của T16 chỉ đạt hiển nhiên |
| Ổn định giữa hai lần chạy | đo và báo cáo | Không đo | Không đo (1 vòng) | **Không đo được** |
| Thời gian câu hỏi -> bản nháp memo (brief + trích xuất + chấm + memo thật) | ghi nhận | 4,1-10,6 phút (Q1-Q5, A, B; số của vòng M2) | 0,7-3,2 phút (trung bình khoảng 1,4 phút) | Ghi nhận. Không so sánh trực tiếp được: Y gọi model song song (commit 13c1d72), quota và cache khác nhau |

## 2. Chi tiết T11-T15

### T11. Nguồn yếu mới hơn mâu thuẫn nguồn mạnh cũ hơn (X1, chế độ thử, SYNTHETIC)
- **Kỳ vọng:** SYN13 (12 triệu) là bằng chứng chính; SYN14 (30 triệu) nằm trong "Chưa chắc chắn" với mã `weak_dissent` và hạng của nó; câu hỏi con ở mức Medium (một nguồn gốc A), không phải Low; không câu nào nói 30 triệu là quy mô thị trường.
- **Kết quả thực tế:**
  - **X:** sq1 mức Medium, 30 triệu chỉ nằm trong "Tín hiệu tham khảo hạng C/D" có ghi hạng C. Nhưng không phát hiện mâu thuẫn nào (`pairs_found`=0 ở mọi câu hỏi con), không có `weak_dissent`, và câu duy nhất nêu 12 triệu bị code **hạ nhầm** thành "[suy luận]" (chữ số trong "C-75d65e98"). Dự đoán trước "Low hoặc mâu thuẫn do LLM gắn nhãn" là **sai**: thực tế M2 không thấy mâu thuẫn nào. Tổng thể Medium.
  - **Y lần đầu (`round_1_pre_fix/X1`, cùng `p2.json`):** code gắn cặp SYN13/SYN14 nguyên nhân `year`, dù cả hai đều là dữ liệu 2025 (khác nhau ở ngày phát hành), rồi biến C-02041109 (12 triệu, hạng A) thành "Lịch sử (older_period)". sq1 bị từ chối, tức là nguồn diễn đàn hạng C đã thực chất **lật** nguồn hạng A. Đây chính là kịch bản bẫy, và lần đầu đã **thất bại**.
  - **Y sau sửa code (`p3`/memo tính lại trên cùng đầu ra model):** sq1 Medium, `main` = C-02041109; C-6b6ca981 có mã `weak_dissent` ("Một nguồn yếu hơn (hạng C/D) đưa ra con số khác"), 30 triệu chỉ ở danh sách C/D có ghi "hạng C". Không câu nào nói 30 triệu là quy mô thị trường. Nhưng: (a) câu trong memo viết "**dự báo** đạt 12 triệu lượt tải", trong khi SYN13 nói "đạt 12 triệu", là số thực tế cả năm 2025 (sai cách diễn đạt, lấy từ chữ "dự báo" trong câu hỏi con); (b) tổng thể "Chưa đủ căn cứ" vì brief đánh dấu sq2 "xu hướng 2023-2025" là core, nên người đọc thấy dòng đầu memo nói câu hỏi gốc chưa có kết luận dù sq1 trả lời đúng câu hỏi gốc; (c) dòng `weak_dissent` trong markdown không ghi mã claim (chỉ danh sách C/D bên dưới có).
- **Đạt/Không đạt:** X **Không đạt**. Y: lần đầu **Không đạt**; sau sửa **Đạt có điều kiện** (các điều kiện của kỳ vọng đạt; cách diễn đạt "dự báo" và mức tổng thể làm giảm giá trị). Theo yêu cầu, kết quả lần đầu được tính: lần sửa được làm **sau khi thấy kết quả**, trên cùng một đầu ra của model.
- **Bài học:** luật thời gian phải so `data_date` chứ không phải ngày phát hành, và không được để nguồn C/D thay thế nguồn A/B. Phép thử này đã bắt được đúng lỗi ở lần chạy đầu, tức là nó có giá trị. Memo vẫn cần kiểm tra từ ngữ "dự báo/ước tính" so với nguồn.

### T12. Số được cập nhật từ cùng gốc (X2, chế độ thử)
- **Kỳ vọng:** 26 triệu USD là bằng chứng chính; 20 triệu USD có nhãn "đã được cập nhật" (`superseded`), không phải mâu thuẫn chưa giải thích; số nguồn A/B độc lập = 1; mức Medium.
- **Kết quả thực tế:**
  - **X:** sq1 Medium, `independent_ab`=1, không có cặp mâu thuẫn (dự đoán "cặp mâu thuẫn có nhãn LLM" là **sai**). Câu fact nêu "hai mức: 20 triệu USD (số liệu sơ bộ) và 26 triệu USD (số liệu cập nhật)", hai số ngang nhau, không chọn số chính, không có nhãn "đã cập nhật" do code. Không gây hiểu nhầm nặng vì chữ "sơ bộ/cập nhật" lấy từ nguồn.
  - **Y:** sq1 Medium, `main` = C-099eebca (26), cặp nhãn `revision` do code quyết định, C-5ff63601 (20) hiện là "Lịch sử (superseded)", `independent_ab`=1. Lưu ý: (a) câu memo viết "ước tính đạt 26 triệu USD", trong khi SYN16 nói "Kết quả cập nhật... đạt 26 triệu USD" với đủ 12 tháng dữ liệu; (b) ở sq3 và sq4, chỉ số cũ 20 triệu hiện ở mục "Lịch sử", không có số 26 đi kèm, và lý do từ chối ghi "Chỉ có số liệu cũ hoặc đã được thay thế" dù claim mới (C-f2e60adb) có mặt với nhãn `context`; (c) sq4 (DAU/MAU, ARPU thị trường) và sq5 (CPI, retention trung bình) có bước tiếp theo "Cần dữ liệu nội bộ của Gamota (dashboard/BI vận hành của chính game đó)": **sai loại dữ liệu**, vì đây là số liệu cấp thị trường; (d) tổng thể "Chưa đủ căn cứ" vì sq2 (phân bổ IAP so với quảng cáo) bị đánh dấu core.
- **Đạt/Không đạt:** X **Không đạt** (không có bằng chứng chính, không có nhãn superseded). Y **Đạt có điều kiện**.
- **Bài học:** luật "cùng gốc, bản mới thay bản cũ" chạy đúng khi `origin_groups.csv` khai báo đúng; đây là tra bảng do người khai báo, không phải tự phát hiện. Gợi ý bước tiếp theo đang chọn mẫu câu theo từ khóa và chọn sai.

### T13. Mọi nguồn đều cũ (X3)
- **Kỳ vọng:** "Chưa đủ căn cứ" với lý do nêu tính cũ và ngày dữ liệu (2021, 2022); không con số nào trong kết luận; số cũ chỉ hiện kèm ngày; bước tiếp theo yêu cầu báo cáo có phương pháp và dữ liệu trong cửa sổ 18 tháng.
- **Kết quả thực tế:**
  - **X:** tổng thể "Chưa đủ căn cứ", không có số nào trong kết luận, 15 triệu/11 triệu chỉ ở danh sách C/D có "dữ liệu 2022/2021". Nhưng lý do là "Chỉ có 2 claim hạng C/D", không nói số liệu đã cũ; bước tiếp theo là câu mẫu "Bổ sung nguồn hạng A/B cho..."; mục "Giả định chính" lặp ba lần lời giải thích của LLM, trong đó có câu "chênh lệch 4 triệu USD chủ yếu phản ánh sự tăng trưởng doanh thu theo năm (YoY growth) của thị trường", tức là suy diễn tăng trưởng từ hai nguồn C/D khác nhau.
  - **Y:** sq1 và sq2: "Chỉ có số liệu cũ hoặc đã được thay thế (dữ liệu 2021, 2022)"; "Lịch sử (stale, dữ liệu 2022/2021)"; bước tiếp theo "Cần báo cáo ngành có nêu phương pháp và dữ liệu trong 18 tháng gần nhất... Các số liệu tìm được đã quá cũ". Không có số trong kết luận. Lưu ý nhỏ: mỗi số cũ hiện hai lần (mục "Lịch sử" và danh sách C/D).
- **Đạt/Không đạt:** X **Không đạt** (từ chối đúng, nhưng thiếu lý do về tính cũ và thiếu bước tiếp theo đúng yêu cầu). Y **Đạt**.
- **Bài học:** spec từng dự đoán phép thử này "có thể không thấy khác biệt". Thực tế có khác biệt ở lý do và bước tiếp theo, không phải ở kết luận.

### T14. Follow-up giữ bối cảnh
- **Kỳ vọng:** phạm vi của brief follow-up chứa Việt Nam, mobile và doanh thu; không claim nào của S017 xuất hiện làm bằng chứng; memo hiện run cha; không có cổng hỏi lại.
- **Kết quả thực tế:**
  - **X (hỏi như câu mới):** `needs_clarification=true`, 0 câu hỏi con, ba câu hỏi lại về thị trường, nền tảng, chỉ số. Dự đoán của spec được xác nhận.
  - **Y:** `context.json`: parent Q2, `rejected_sources=["S017"]`; `reviews.json`: C-a8da17bb, C-4df475dd (S017) bị loại với ghi chú "kế thừa từ Q2". Brief: `needs_clarification=false`; scope = "Toàn bộ thị trường mobile game Việt Nam (iOS + Android)..., tập trung vào phân khúc game nhập vai (RPG)". Chữ "doanh thu" **không có trong trường scope**, nhưng có trong cả hai câu hỏi con core (sq1 tỷ trọng doanh thu, sq2 doanh thu tuyệt đối). Memo hiện "Nghiên cứu tiếp từ: ... (Q2). Kế thừa phạm vi và 2 quyết định duyệt." Không claim S017 nào hiện trong memo thật hoặc memo thử. Tổng thể "Chưa đủ căn cứ" ở cả hai chế độ.
  - Lỗi phụ: (a) `p3.json` vẫn đếm claim S017 bị loại trong lý do ("Chỉ có 1 claim hạng C/D"), còn memo thì ghi đúng "Không có claim hợp lệ"; (b) sq3 (cơ cấu phân khúc RPG thị trường) có bước tiếp theo "Cần dữ liệu nội bộ của Gamota": sai loại dữ liệu; (c) memo thử hiện lời giải thích mâu thuẫn SYN07/SYN08 do LLM viết, có gợi ý "lấy trung bình (~13.5%)" và nêu tên nhà cung cấp không có trong `sources.csv` ("Sensor Tower, data.ai, AppMagic, Niko Partners"), dù cả hai claim chỉ được gắn nhãn `context` cho câu hỏi con đó.
- **Đạt/Không đạt:** X **Không đạt**. Y **Đạt có điều kiện**: nếu đọc theo chữ, trường scope không chứa "doanh thu"; tôi ghi nhận điểm này để người dùng quyết định, không tự nới kỳ vọng.
- **Bài học:** kế thừa quyết định duyệt hoạt động. Có kiểm chứng trong kho: kho không có tỷ trọng doanh thu RPG tại Việt Nam (S004 chỉ liệt kê "Role-Playing" là một phân khúc, không có số; S005 có D1 retention idle RPG; S006 có thời gian chơi; S017 có tăng trưởng idle RPG nhưng đã bị loại). Vì vậy "Chưa đủ căn cứ" ở đây là **đúng** (dữ liệu thật sự vắng).

### T15. Follow-up không liên quan (chỉ Y có)
- **Kỳ vọng:** bị đánh dấu không liên quan, không kế thừa gì, không có kết luận về thị trường game (chế độ thật từ chối vì SYN09 là SYNTHETIC).
- **Kết quả thực tế:** `followup.related=false`, `inherited=0`; brief không kế thừa scope game (scope: cà phê Robusta Tây Nguyên); memo thật từ chối 5/5 câu hỏi con; memo thử chỉ hiện SYN09 (120.000 đồng/kg) ở danh sách C/D. Lưu ý: `context.json` vẫn ghi `inherit: true` và giữ gaps của Q3, mâu thuẫn với `inherited=0` (dữ liệu không nhất quán, nhưng không bị dùng); memo vẫn ghi "Nghiên cứu tiếp từ: ... (Q3)" kèm "Không kế thừa bối cảnh"; bước tiếp theo cho giá cà phê là mẫu câu "báo cáo ngành... 18 tháng".
- **Đạt/Không đạt:** X **Không kiểm được**. Y **Đạt có điều kiện**.
- **Bài học:** cơ chế ngắt kế thừa chạy được. Đây là lần đầu bẫy D5 (SYN09) được chạm tới, và nó không lọt vào kết luận.

## 3. Chi tiết các mục thay đổi trong R2 và R3

### T2 (Q2, hai nguồn mạnh hai con số) - hồi quy
- **Kỳ vọng (spec 06, không đổi):** hiện khoảng giá trị, giải thích do định nghĩa đo khác nhau, gợi ý dùng số nào cho mục đích nào, mức Medium.
- **Kết quả thực tế (Y, chế độ thử):** sq1 làm đủ ba việc đầu (700 và 490, mâu thuẫn `definition`, có "Gợi ý dùng"), sq1 Medium. Nhưng mức tổng thể là "Chưa đủ căn cứ — 1/2 câu hỏi con chính chưa đủ căn cứ (sq2)", vì sq2 "tốc độ tăng trưởng doanh thu" bị brief đánh dấu core. Ngoài ra: câu memo gọi 490 triệu là "tổng doanh thu thị trường" (SYN06 chỉ tính game do nhà phát hành tại Việt Nam vận hành); claim doanh thu game đua xe (SYN17, 15 triệu USD, 2022) bị code ghép cặp `stale` với tổng thị trường và hiện là "Lịch sử (stale, dữ liệu 2022)" ngay dưới câu hỏi tổng doanh thu, dù LLM đã gắn nhãn `context`; lời giải thích của LLM vẫn dùng kiến thức ngoài kho ("khớp chính xác với tỷ lệ phí cửa hàng ứng dụng phổ biến"), như lỗi đã ghi ở M2.
- **Đạt/Không đạt:** **Fail** (đồng ý với điểm máy). Nguyên nhân: luật mức tổng thể theo core cộng với lựa chọn core của LLM; Layer A cho cùng kết quả Fail mà không gọi model.
- **Bài học:** luật "câu hỏi con core bị từ chối thì tổng thể bị từ chối" sửa đúng lỗi Q4 của M2, nhưng chất lượng của nó phụ thuộc hoàn toàn vào việc LLM chọn câu nào là core. Không có bước nào kiểm tra lựa chọn đó.

### D4 (B, mâu thuẫn thật SYN07/SYN08)
- **Kỳ vọng:** mâu thuẫn được phát hiện, không giải thích được, mức Low.
- **Kết quả thực tế (Y):** SYN07 và SYN08 được truy xuất ở cả 5 câu hỏi con, nhưng mọi claim SYN08 bị verify loại (đoạn trích không nguyên văn; "Việt" không có trong đoạn). Brief B không có câu hỏi con nào hỏi trực tiếp tỷ lệ idle RPG (sq1 tổng lượt tải, sq2 lượt tải idle RPG...). Trong T14 (cùng hệ thống), cặp SYN07/SYN08 vẫn được phát hiện là `unknown, unexplained`, nên cơ chế còn chạy.
- **Đạt/Không đạt:** **Không kiểm được** trong lần chạy này. Nguyên nhân: dao động trích xuất/verify của model, không do luật (Layer A: Pass).
- **Bài học:** độ nghiêm của verify (khớp nguyên văn, tên riêng) vẫn là nguồn gây mất bẫy lớn nhất.

### T5/R3 (Q4, thiếu dữ liệu)
- **Kỳ vọng R3:** tổng thể "Chưa đủ căn cứ" ở cả hai chế độ; câu hỏi con D7 thực tế bị từ chối; số benchmark nếu hiện phải ghi "không trả lời câu hỏi gốc"; bước tiếp theo nêu loại dữ liệu cần (dashboard retention nội bộ của game X), không phải câu mẫu.
- **Kết quả thực tế (Y):** tổng thể "Chưa đủ căn cứ" ở cả hai chế độ; sq1 (core duy nhất) bị từ chối; **không có số benchmark nào hiện ra** (nên điều kiện "đánh dấu không trả lời câu hỏi gốc" chỉ đạt hiển nhiên); bước tiếp theo "Cần dữ liệu nội bộ của Gamota (dashboard/BI vận hành của chính game đó); kho tài liệu công khai không thể có số này". Nhưng câu này lặp nguyên văn cho cả 5 câu hỏi con, kể cả sq3 (benchmark thị trường), nơi kho công khai **có** dữ liệu (S005: D7 Việt Nam 5%, APAC 7%, toàn cầu 14%, Q1 2026; claim C-05f6215b được trích nhưng gắn nhãn `partial` và không hiện nội dung trong memo). Lý do ở sq1 chế độ thật ghi "Chỉ có 1 claim hạng C/D", trong khi claim thật duy nhất là S006 hạng B (nhãn `context`): sai chữ.
- **Đạt/Không đạt:** **Đạt có điều kiện** (máy: Pass).
- **Bài học:** Layer A (luật M3 trên đầu ra M2) vẫn Fail T5, nên cải thiện này cần nhãn liên quan của lần trích xuất mới. Mẫu câu "dữ liệu nội bộ" đang được áp cho cả câu hỏi cấp thị trường.

### T8 (baseline)
- Baseline của hai vòng là **cùng một tệp** (hash giống nhau). MVP Y chế độ thật: 3 câu kết luận (Q3 sq3), tất cả có claim ID, 0 số không có căn cứ; Q4 bị từ chối toàn bộ. **Pass**, đồng ý với điểm máy. Lưu ý: baseline cũng từ chối Q4; điểm T8 đổi sang Pass vì MVP nay cũng từ chối, không phải vì baseline đổi.

### T7 (bảng/biểu đồ PDF) - vẫn Fail
- 6 claim hợp lệ. Claim từ S006-p6-0 lại ghép sáu số của hai biểu đồ tròn D1/D7 thành các nhóm "D1 ... D7 ..." (cùng lỗi M2), không có cờ cảnh báo. S006-p5-0 gán "MMORPG 76.06, Idle RPG 18.41, Squad RPG 108.09" theo thứ tự đọc; trong khi trang 10 cho thời gian chơi idle RPG nhóm retention cao là 48,3 phút, và trang 12 cho MMORPG 18,4/108,1 phút. Vì vậy cách gán gần như chắc chắn sai. Bảng 4X (S006-p9-0) đúng. Ba claim S005 thuộc ứng dụng ngoài game. **Fail**, không phải hồi quy.

## 4. Kiểm tay câu bằng chứng chính trong memo (cả hai hệ thống, mọi chế độ)

Tập chấm: mọi câu (points) dưới các câu hỏi con có kết luận. Câu chỉ nêu khoảng trống ("Danh sách claim không chứa ...") không tính vào mẫu số (X có 5 câu như vậy). Cách chấm **nới**: câu đúng với đoạn nguồn và trả lời trực tiếp câu hỏi con. Cách chấm **chặt**: thêm điều kiện không sai phạm vi, không sai từ ngữ (dự báo/thực tế), và nguồn là điều khoản chứ không phải mẫu cam kết.

**Y (11 câu):**

| # | Memo / câu hỏi con | Claim | Nới | Chặt | Ghi chú |
|---|---|---|---|---|---|
| 1 | Q2 thử sq1: 700 triệu USD (gộp) | C-49c9f092 | Đạt | Đạt | |
| 2 | Q2 thử sq1: 490 triệu USD | C-549e32a6 | Đạt | Không | Gọi là "tổng doanh thu thị trường"; nguồn chỉ tính game do nhà phát hành tại Việt Nam vận hành |
| 3 | Q2 thử sq1: chênh 210 triệu do định nghĩa [suy luận] | 2 claim | Đạt | Đạt | Có nêu "nhà phát hành địa phương" |
| 4 | Q3 thật sq3: phân loại 18+ | C-469348e0 | Đạt | Đạt | Bỏ mất "mô phỏng người thật" (nhỏ) |
| 5 | Q3 thật sq3: cấm lợi dụng để đánh bạc | C-a4fc5689 | Đạt | Không | Đoạn nguồn là mẫu cam kết trong tờ khai G2/G3/G4, memo viết như điều cấm |
| 6 | Q3 thật sq3: cam kết hồ sơ G1 + bản quyền | C-70a38890, C-916fe657 | Không | Không | Liên quan yếu tới "yêu cầu về nội dung game" (cùng lỗi M2) |
| 7 | Q3 thử sq3: 18+ | C-469348e0 | Đạt | Đạt | |
| 8 | Q3 thử sq3: đánh bạc | C-a4fc5689 | Đạt | Không | Như #5 |
| 9 | Q3 thử sq3: cam kết G1 | C-70a38890 | Không | Không | Như #6 |
| 10 | X1 thử sq1: "dự báo đạt 12 triệu" | C-02041109 | Không | Không | Nguồn: số thực tế đã đạt |
| 11 | X2 thử sq1: "ước tính đạt 26 triệu USD" | C-099eebca | Đạt | Không | Nguồn: số cập nhật đủ 12 tháng |

Y: nới **8/11 = 72,7%**, chặt **4/11 = 36,4%**; chỉ chế độ thật (#4-6): nới 2/3, chặt 1/3.

**X (15 câu tính, 5 câu khoảng trống không tính):** Q1 sq3 (3 câu: nhận định thiết kế của Funtap C-817c374b viết như sự thật về người chơi, không trả lời ARPU/LTV): Không/Không. Q2 thử (700; 490; chênh lệch do phương pháp): nới 3/3, chặt 1/3 (490 thiếu phạm vi; câu chênh lệch bỏ phạm vi). Q3 sq1 thật và thử (mẫu cam kết G1 cho câu hỏi "căn cứ pháp lý nào"): 0/2. Q4 sq2 thật (2) và thử (3) (benchmark 4X Strategy cho Game X chưa rõ thể loại): số đúng nhưng chỉ liên quan một phần, 0/5. X1 thử (12 triệu làm mốc): Đạt/Đạt. X2 thử ("hai mức" 20/26): Đạt/Đạt. X: nới **5/15 = 33,3%**, chặt **3/15 = 20,0%**; chế độ thật **0/5**.

Kết luận: Y tốt hơn X rõ rệt về tỷ lệ, nhưng mẫu số rất nhỏ (11 câu), 8/11 câu là SYNTHETIC, và **mục tiêu ≥90% không đạt** theo cả hai cách chấm.

## 5. Đồng thuận nhãn liên quan (`answers`, chỉ Y có)

Mẫu: 62 nhãn claim của Y (X1 6, X2 6, X3 4, Q2 11, Q4 5, B 8, T14 13, Q3 9), tôi tự gắn nhãn rồi so sánh. **Khớp 53/62 = 85,5%**; riêng tài liệu thật **23/27 = 85,2%**. Mục tiêu ≥80%: **đạt**.

9 chỗ lệch: C-6b6ca981 (SYN14, model gắn `partial` vì nguồn yếu; về mức liên quan thì là `direct`, model trộn độ tin cậy với mức liên quan); C-7b0886cf, C-62b92cc6 (X3 sq2, hai mốc năm cho phép tính tăng trưởng: tôi gắn `partial`, model gắn `context`); C-7b6fd01e (SYN01 2021 cho câu hỏi kỳ mới nhất: `partial`, model `context`); C-549e32a6 (SYN06 chỉ tính nhà phát hành Việt Nam: `partial`, model `direct`); C-b1f83036 (S008 game do người Việt phát triển, toàn cầu: `context`, model `partial`); C-b74f12e4 (S017 tăng trưởng H1 2026 cho câu hỏi "so với 2024": `partial`, model `direct` và chính lý do của model ghi "giả định"); C-70a38890, C-916fe657 (mẫu cam kết G1/bản quyền cho câu hỏi yêu cầu nội dung: `partial`, model `direct`).

Giới hạn: khoảng 2/3 mẫu là trường hợp dễ (claim SYNTHETIC ngắn, nhãn `context` hiển nhiên). Không so trực tiếp được với 48 nhãn tay của M2 (khác lần chạy, khác claim ID), nên nhãn M2 chỉ dùng làm tham chiếu cách chấm.

## 6. Hữu ích cho người ra quyết định: trả lời nhiều hơn hay từ chối nhiều hơn?

| Hệ thống / chế độ | Câu có kết luận (X: Medium/Low; Y: "Có thể tin" / "Chưa chắc chắn") | Bị từ chối | Tổng thể bị từ chối |
|---|---|---|---|
| X thật (10 câu, T14 không có memo) | 6 Medium / 50 | 44 | 6/10 |
| Y thật (11 câu) | 0 / 1 (Q3 sq3) / 55 | 54 | **11/11** |
| X thử | 13 Medium + 1 Low / 50 | 36 | 4/10 |
| Y thử | 0 / 4 / 55 | 51 | **11/11** |

**Trả lời thẳng: hệ thống mới chủ yếu từ chối nhiều hơn, không trả lời nhiều hơn.** Phần lớn các mức Medium bị bỏ của X là những mức M2 đã chấm là không liên quan (Q4 sq2 4X, Q1 sq3 Funtap, Q3 sq3/sq4 không có câu nào). Bỏ chúng là đúng. Nhưng Y không thêm câu trả lời mới nào trên tài liệu thật.

"Chưa đủ căn cứ" đúng (dữ liệu thật sự vắng) hay do bỏ sót (dữ liệu có trong kho)? Đã kiểm trên tệp gốc:
- **Q2 (thật): bỏ sót.** `corpus/raw/S004.txt` dòng 19/26/171: "Market Value: USD 575 million (2025)" (toàn thị trường game, mọi nền tảng, định nghĩa khác). Truy xuất chỉ lấy `S004-p1-22`/`p1-21`/`p1-37` (bảng công ty), không lấy đoạn 575. S014 (Gamota, 825 triệu USD, press release, sẽ là hạng thấp) không bao giờ được truy xuất. Top-8 bị SYN01/05/06/07/08 chiếm như ở M2.
- **Q3: bỏ sót một phần.** sq1 "văn bản nào quy định" bị từ chối vì chỉ trích được mẫu cam kết, trong khi S001-S003 chính là Nghị định 147/2024 (tên có trong `sources.csv`); quy tắc 60/180 nằm trong S001 (đã xác nhận ở báo cáo M2) nhưng vẫn không được truy xuất.
- **X1: đúng một phần.** Số 2025 có trong kho và được trả lời ở sq1; "xu hướng 2023-2025" thật sự vắng (chỉ có năm 2025), nên từ chối sq2 là đúng. Nhưng từ chối **tổng thể** là do chọn core sai, không do thiếu dữ liệu.
- **T14: đúng.** Không có tỷ trọng doanh thu RPG tại Việt Nam trong kho (xem T14).
- **Q4: đúng ở sq1** (số của Game X không thể có trong kho công khai); sq3 có số liệu công khai liên quan một phần (S005 5%), nhưng memo không hiện ra.
- Q4, Q5, X3: từ chối tổng thể đúng.

## 7. Nội dung gây hiểu nhầm (xếp theo mức ảnh hưởng)

1. **Lựa chọn câu hỏi con core sai kéo mức tổng thể xuống "Chưa đủ căn cứ"** (luật + LLM brief): Q2 (tăng trưởng là core), X1 (xu hướng), X2 (IAP so với quảng cáo), X3 (thị phần top 10). Nhóm câu hỏi con trực tiếp trả lời câu hỏi gốc đã có câu trả lời ở Q2 thử, X1, X2. Gây ra hồi quy T2.
2. **Từ ngữ sai về bản chất số liệu trong câu memo** (LLM viết memo, không có kiểm tra): "dự báo đạt 12 triệu" (X1), "ước tính đạt 26 triệu" (X2), "tổng doanh thu thị trường" cho 490 (Q2).
3. **Ghép cặp thời gian bỏ qua mức liên quan** (luật): SYN17 (đua xe 2022) thành "Lịch sử" của tổng doanh thu thị trường (Q2 sq1); SYN01 (2021) ghép với cả 700, 490 và 15 triệu. Lần chạy pre-fix X1 cho thấy luật `year` từng chạy trên ngày phát hành.
4. **Bước tiếp theo sai loại dữ liệu** (mẫu câu theo từ khóa): "Cần dữ liệu nội bộ của Gamota (dashboard/BI...)" cho X2 sq4/sq5, T14 sq3, Q4 sq3 (đều là câu hỏi cấp thị trường). Không phát hiện URL bịa; tên tổ chức trong bước tiếp theo do code sinh đều lấy từ `sources.csv` (Viện Khảo sát Giả Lập N, Viện Nghiên cứu Giả Lập C, Chính phủ (Công báo)). Nhưng **lời giải thích mâu thuẫn do LLM viết** vẫn nêu nhà cung cấp không có trong kho (T14: Sensor Tower, data.ai, AppMagic, Niko Partners) và gợi ý lấy trung bình 13,5%.
5. **Điều khoản dự thảo hiện như quy định hiện hành** trong danh sách C/D của Q3 sq3: "Doanh nghiệp phải lưu trữ đầy đủ thông tin người chơi...", "Người chơi bắt buộc phải đăng ký, xác thực tài khoản..." (S009 ghi rõ "Dự thảo cũng quy định..."). Mã `draft` chỉ hiện thành một dòng chung, không gắn vào từng mục. LLM đã gắn đúng nội dung là dự thảo trong `answers_reason`, nhưng memo không dùng thông tin đó.
6. **Lý do từ chối sai chữ**: Q4 sq1 chế độ thật ghi "1 claim hạng C/D" cho một claim hạng B; X2 sq3/sq4 ghi "chỉ có số liệu cũ hoặc đã được thay thế" dù có claim mới; T14 `p3` đếm cả claim đã bị chuyên viên loại.
7. **Bằng chứng một phần bị giấu**: dòng "Chưa chắc chắn (partial_relevance)" trong markdown không nêu claim nào, số nào (Q4 sq3, Q3 sq1/sq2). Người đọc memo không biết có dữ liệu liên quan một phần (giao diện có thể hiện; chưa kiểm).
8. **Câu hỏi pháp lý không bao giờ đạt "Có thể tin"**: S001-S003 là một gốc (một Nghị định) nên luôn bị `single_origin`. Đây là cùng phát hiện về kỳ vọng như T1 ở M2; tôi không đổi kỳ vọng.

## 8. Không kiểm được / giới hạn

- **Độ ổn định: không đo được** (mỗi hệ thống 1 vòng). Mọi kết luận "do model" hay "do luật" chỉ chắc chắn ở chỗ có Layer A làm đối chứng (T2, T5, D4).
- **So sánh không cùng điều kiện:** X ở Q1-Q5, A, B là vòng M2 cũ (`runs/p4/round_1`, kho cũ chưa có SYN13-18; hash trùng khớp); X ở X1-X3, T14 chạy trên kho mới. Y chạy trên kho mới. Thống kê BM25 khác nhau giữa hai kho.
- **Không truy vấn được PostgreSQL** (hết thời gian chờ kết nối); đã đối chiếu bằng tệp gốc (`S004.txt`, `S009.html`, `S014.html`, `S017.html`, văn bản trích từ `S005.pdf`/`S006.pdf` bằng pypdf). Không xem ảnh trang PDF trong lần chấm này; nhận định T7 về biểu đồ dựa trên văn bản các trang 5, 10, 12.
- **Giao diện:** "Hệ thống đã tìm những gì" cho câu hỏi con bị từ chối có trong `frontend/components/screens/Evidence.tsx` và dữ liệu `retrieved` có trong `p2.json`, nhưng **chưa kiểm trên giao diện chạy thật**; markdown của memo không liệt kê đoạn đã tìm.
- **Không kiểm:** Y Q1, Q5, A ngoài mức tổng thể và các claim A/B (tất cả bị từ chối; Q1 có dữ liệu D1 idle RPG ở S005 trang 10 mà chưa đánh giá có trả lời được câu hỏi con nào không); độ đúng của mọi lời giải thích mâu thuẫn do LLM viết; quy mô bộ thử nhỏ (khoảng 36 tài liệu, 11 câu, bẫy tự viết và tự mô tả dấu hiệu). Kết quả cho thấy cơ chế chạy, **không** chứng minh độ chính xác trên thị trường thật.
- Bản sửa code giữa pre-fix và bản cuối của X1 được làm sau khi thấy kết quả. Tôi tính kết quả lần đầu là Không đạt và không xem bản sau như một lần chạy độc lập.

## 9. Câu hỏi ánh xạ: X hay Y là hệ thống mới?

**Y là hệ thống mới (M3), X là M2.** Lý do: (1) tệp của Y có các trường chỉ M3 mới có (`core`, `answers`/`answers_reason`, `tier`, `history`, `next_steps`, `decided_by`, `followup`, `context.json`/`reviews.json`); (2) X ở T14 dừng ở cổng hỏi lại, đúng dự đoán cho M2 không có follow-up; (3) X hạ nhầm câu vì chữ số trong mã claim (lỗi M2 số 4), Y không; (4) xác nhận thẳng, nên tôi nói rõ ở đây: hash tệp X/Q1-B trùng `runs/p4/round_1`, X/X1-X3,T14 trùng `runs/m3/m2_on_new`, còn Y trùng `runs/m3/round_1`. Việc che mù vì vậy **không có hiệu lực**. Tôi đã chấm theo kỳ vọng đăng ký trước và không cố ý ưu ái bên nào, nhưng người dùng nên coi đây là chấm có biết danh tính, không phải chấm mù.

## 10. Tệp liên quan

- Báo cáo này: `D:\gamota-research-copilot\backend\tests\reports\20261021-m3-evaluator.md`
- Dữ liệu chấm: `D:\gamota-research-copilot\backend\runs\m3\blind\`, `D:\gamota-research-copilot\backend\runs\m3\round_1_pre_fix\X1\`, `D:\gamota-research-copilot\backend\runs\m3\round_1\T15\`, `D:\gamota-research-copilot\backend\runs\m3\round_1\compare.md`, `D:\gamota-research-copilot\backend\runs\m3\layer_a\compare.md`
- Báo cáo M2 tham chiếu: `D:\gamota-research-copilot\backend\tests\reports\20261013-2115.md`
