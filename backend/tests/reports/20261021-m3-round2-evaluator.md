# Báo cáo chấm độc lập Mission 3, vòng chạy thật 2 (evaluator) - gamota-research-copilot MVP

Ngày chấm: 2026-10-21. Người chấm: evaluator (không sửa code/dữ liệu, không gọi model). Kỳ vọng và ngưỡng lấy nguyên văn từ `docs/spec/09-mission3.md` (mục 5, 7), không đổi, không diễn giải nới.
**Không chấm mù**: danh tính của M2, vòng 1 (R1) và vòng 2 (R2) đều biết trước.
Dữ liệu: `backend/runs/m3/round_2/` (R2, code và prompt của lần sửa thứ 2), `backend/runs/m3/round_1/` (R1), `backend/runs/p4/round_1/` và `backend/runs/m3/m2_on_new/` (M2). Kho: bảng `chunks` trong PostgreSQL (localhost:5434, chỉ đọc; 692 đoạn, 36 nguồn) và `backend/corpus/`. Tài liệu SYNTHETIC là tài liệu tự viết để thử bẫy. Mọi kết quả trên SYNTHETIC chỉ chứng minh cơ chế chạy, **không** nói gì về thị trường thật hay Gamota thật.

## 0. Tóm tắt trung thực

- **Tốt hơn R1:**
  - Brief chỉ đánh dấu 1 câu hỏi con chính (core) cho mỗi câu, 2 cho Q3. Câu core đó hỏi đúng đại lượng của câu hỏi gốc ở cả 12/12 câu (Q1 còn tranh luận được).
  - Nhờ vậy Q2 (chế độ thử), X1 và X2 có mức tổng thể Medium thay vì "Chưa đủ căn cứ". **T2 quay lại Pass** (R1: Fail).
  - Câu memo không còn đổi "đạt" thành "dự báo/ước tính". Câu 490 triệu USD giữ đúng phạm vi "nhà phát hành tại Việt Nam".
  - Điều khoản dự thảo được gắn nhãn "[DỰ THẢO, chưa có hiệu lực]" theo từng mục.
  - Lời giải thích mâu thuẫn không còn nêu tên nhà cung cấp ngoài kho (Sensor Tower, data.ai...).
  - T11, T12, T14 đạt đủ kỳ vọng trên một lần chạy mới. T11 là lần đầu đạt mà không phải sửa code sau khi xem kết quả.
- **Tệ hơn hoặc vẫn tệ:**
  - Ở **chế độ thật, 0/60 câu hỏi con có kết luận** (R1: 1/60; M2: 6/50). Tầng "Có thể tin" trống ở **24/24 memo**.
  - Q2 và Q3 bị từ chối dù kho **có** dữ liệu. Q2: S004 "USD 575 million (2025)". Q3: Nghị định 147/2024, Điều 39-40 về cấp phép G1, quy tắc 60/180 phút. Nguyên nhân là truy xuất, phần cố ý không đổi. Riêng câu hỏi con core của Q2, cả 8 đoạn truy xuất được đều là tài liệu SYNTHETIC, nên chế độ thật không có đoạn nào để dùng.
  - **D4 chuyển từ Pass (M2) sang Fail.** Nguyên nhân là trích xuất cộng verify, không phải luật (mục 3.2).
  - Đồng thuận nhãn liên quan giảm còn **53/74 = 71,6%**, dưới mục tiêu 80%.
  - Một claim **sai đơn vị** lọt qua verify: C-a1225826, S006 hạng B, đọc "48.3m" (phút) thành "48,3 triệu" người chơi.
- **Chỉ số mục 7 (R2):**
  - **Đạt:** từ chối tổng thể đúng 3/3; 0 hạ nhầm.
  - **Đạt nhưng hiển nhiên** (vì "Có thể tin" trống): 0 claim cũ/đã thay thế trong "Có thể tin".
  - **Không đạt:** câu bằng chứng chính chặt 4/5 = 80% (nới 5/5, nhưng cả 5 câu là SYNTHETIC; chế độ thật 0 câu); đồng thuận nhãn 71,6%; R2 vì D4.
- **Chưa biết:** độ ổn định. R1 và R2 khác code và prompt, và brief khác nhau ở cả 60/60 câu hỏi con. Chỉ T7 là so sánh cùng đầu vào, và T7 cho thấy đầu ra trích xuất khác nhau giữa hai lần chạy ở temperature 0 (mục 6).

## 1. Bảng tổng hợp

### 1.1 Kịch bản M3 (kỳ vọng đăng ký trước)

| Kịch bản | R1 (báo cáo trước) | R2 | Bằng chứng chính (R2) |
|---|---|---|---|
| R1 pytest | - | **Đạt**: 58 passed | chạy `pytest -q` lúc chấm; repo không đổi |
| R2 hồi quy T1-T9, D1-D4 | Không đạt (T2, D4) | **Không đạt** (D4 Pass -> Fail; T1-T9: 0 hồi quy) | `round_2/compare.md`; mục 3 |
| R3 (T5, Q4) | Đạt có điều kiện | **Đạt có điều kiện** | `Q4/memo_*.json` |
| T11 nguồn yếu mới hơn mâu thuẫn nguồn mạnh cũ hơn (X1) | Lần đầu Không đạt; sau sửa Đạt có điều kiện | **Đạt** | C-02041109 là bằng chứng chính; C-6b6ca981 có mã `weak_dissent` |
| T12 số cập nhật cùng gốc (X2) | Đạt có điều kiện | **Đạt** (có lưu ý về phạm vi) | C-010404be (26) chính; C-846d660c (20) `superseded` |
| T13 mọi nguồn đều cũ (X3) | Đạt | **Đạt có điều kiện** | lý do của sq1 (core) chỉ nêu "dữ liệu 2022" |
| T14 follow-up giữ bối cảnh | Đạt có điều kiện | **Đạt** | `T14/context.json`, `reviews.json` (5 claim S017 bị loại) |
| T15 follow-up không liên quan | Đạt có điều kiện | **Đạt có điều kiện** | `related=false`, `inherited=0`; `context.json` vẫn `inherit: true` |
| T16 kiểm chứng | Đạt hiển nhiên | **Không kiểm được đầy đủ** | "Có thể tin" trống; memo không liệt kê đoạn đã tìm |

### 1.2 Chỉ số mục 7 (R2)

| Chỉ số | Mục tiêu | M2 | R1 | R2 | Trạng thái R2 |
|---|---|---|---|---|---|
| Từ chối tổng thể đúng (Q4, Q5, X3) | 100% | 2/3 | 3/3 | **3/3** (cả hai chế độ) | Đạt |
| Claim cũ/đã thay thế trong "Có thể tin" | 0 | n/a | 0 (tầng trống) | **0** (tầng trống 24/24 memo); trong bằng chứng chính 0/5 | Đạt, nhưng hiển nhiên |
| Câu bằng chứng chính đúng và liên quan | ≥90% | nới 33,3%; chặt 20,0% | nới 72,7%; chặt 36,4% | **nới 5/5 = 100%; chặt 4/5 = 80%**; chế độ thật 0/0 | Không đạt (chặt). Mẫu 5 câu, toàn SYNTHETIC |
| Hạ nhầm bởi kiểm tra số trong memo | 0 | 4/5 | 0 | **0 lần hạ / 4 câu fact** | Đạt (mẫu rất nhỏ; kiểm tra từ trạng thái mới chưa từng kích hoạt) |
| Hồi quy T1-T9 (Pass -> Fail) | 0 | - | 1 (T2) | **0** ở T1-T9; **D4** Pass -> Fail | T1-T9 đạt; R2 (gồm D1-D4) không đạt |
| Đồng thuận nhãn liên quan | ≥80% | - | 53/62 = 85,5% | **53/74 = 71,6%** (tài liệu thật 20/26 = 76,9%) | Không đạt |
| Ổn định giữa hai lần chạy | đo và báo cáo | không đo | không đo | **chỉ đo được ở T7** (khác nhau) | Không đo được đầy đủ (mục 6) |
| Thời gian câu hỏi -> bản nháp memo thật | ghi nhận | 4,1-10,6 phút | 0,66-3,16 phút (TB 1,33) | **0,68-2,02 phút (TB 1,30)** | Ghi nhận. Memo thật không gọi model khi mọi câu hỏi con bị từ chối (memo_s = 0); memo thử thêm tối đa 24,6 s (Q2) |

## 2. Chi tiết T11-T16

### T11. Nguồn yếu mới hơn mâu thuẫn nguồn mạnh cũ hơn (X1, chế độ thử, SYNTHETIC)
- **Kỳ vọng:** SYN13 (12 triệu) là bằng chứng chính. SYN14 (30 triệu) nằm trong "Chưa chắc chắn" với mã `weak_dissent` và hạng của nó. Câu hỏi con ở mức Medium, không phải Low. Không câu nào nói 30 triệu là quy mô thị trường.
- **Kết quả thực tế (R2):**
  - sq1 (core duy nhất) mức Medium; `main` = C-02041109 (SYN13, hạng A).
  - Mã `single_origin` và `weak_dissent` có `claim_ids` = [C-6b6ca981]. 30 triệu chỉ nằm trong danh sách C/D, có ghi "SYN14, hạng C".
  - Câu memo duy nhất: "Năm 2025, game nông trại trên mobile tại Việt Nam đạt 12 triệu lượt tải." Đúng nguyên văn nguồn; không còn chữ "dự báo" như ở R1.
  - Tổng thể Medium (R1: "Chưa đủ căn cứ" do core sai).
  - Lưu ý nhỏ: dòng `weak_dissent` trong markdown vẫn không ghi mã claim (mã có ở danh sách C/D và ở bước tiếp theo "SYN14"). Model gắn SYN14 là `partial`, tức là trộn độ tin cậy với mức liên quan.
  - Chế độ thật từ chối toàn bộ (chỉ có tài liệu SYNTHETIC): đúng thiết kế.
- **Đạt/Không đạt:** **Đạt.** Đây là lần chạy thật đầu tiên với luật `data_date` đã sửa ở R1; không có sửa code nào sau khi xem kết quả R2.
- **Bài học:** luật "nguồn C/D không lật nguồn A/B" giờ chạy đúng trên một lần trích xuất mới, không chỉ trên đầu ra đã lưu.

### T12. Số được cập nhật từ cùng gốc (X2, chế độ thử)
- **Kỳ vọng:** 26 triệu USD là bằng chứng chính; 20 triệu USD có nhãn `superseded`, không phải mâu thuẫn chưa giải thích; số nguồn A/B độc lập = 1; mức Medium.
- **Kết quả thực tế:**
  - sq1 Medium, `main` = C-010404be (SYN16); C-846d660c (20, sơ bộ) hiện là "Lịch sử (superseded)"; cặp mã `revision`, do code quyết định, `explained`; `independent_ab` = 1; tổng thể Medium.
  - Lưu ý 1: câu memo viết "**Tổng doanh thu thị trường** game cờ tướng... đạt 26 triệu USD", trong khi SYN16 đo "doanh thu trong ứng dụng của 25 game cờ tướng". Phạm vi bị nói rộng hơn nguồn, dù prompt mới cấm đổi phạm vi.
  - Lưu ý 2: sq5 có lý do "Chỉ có số liệu cũ hoặc đã được thay thế (dữ liệu 2025)", trong khi claim mới C-f3285a50 (26) có mặt với nhãn `partial`.
  - Lưu ý 3: bước tiếp theo của sq5 (retention, ARPU) nay là "báo cáo ngành", không còn "dữ liệu nội bộ Gamota" (đã sửa).
- **Đạt/Không đạt:** **Đạt** (mọi điều kiện của kỳ vọng đều thỏa; các lưu ý nằm ngoài kỳ vọng).
- **Bài học:** luật "cùng gốc thì bản sau thay bản trước" ổn định qua hai vòng. Nó vẫn phụ thuộc vào `origin_groups.csv` do người khai báo.

### T13. Mọi nguồn đều cũ (X3)
- **Kỳ vọng:** "Chưa đủ căn cứ" với lý do nêu tính cũ và ngày dữ liệu (2021, 2022); không có số trong kết luận; số cũ chỉ hiện kèm ngày; bước tiếp theo yêu cầu báo cáo có phương pháp và dữ liệu trong 18 tháng.
- **Kết quả thực tế:**
  - Tổng thể "Chưa đủ căn cứ" ở cả hai chế độ; không có câu kết luận nào.
  - sq1 (core): lý do "Chỉ có số liệu cũ hoặc đã được thay thế (**dữ liệu 2022**)". SYN18 (2021) được model gắn `context` nên không vào lý do; nó chỉ hiện trong danh sách C/D có "dữ liệu 2021". sq2 nêu đủ "(dữ liệu 2021, 2022)".
  - Bước tiếp theo đúng yêu cầu: "Cần báo cáo ngành có nêu phương pháp và dữ liệu trong 18 tháng gần nhất... Các số liệu tìm được đã quá cũ".
  - Dòng tổng thể chỉ nói "1/1 câu hỏi con chính chưa đủ căn cứ", không nói vì số liệu cũ.
  - sq3: lý do "chỉ có số liệu cũ (2021, 2022)" trong khi có claim SYN06 (490 triệu, 2025, hạng A, `partial`). Code còn ghép cặp `stale` giữa doanh thu đua xe và tổng doanh thu thị trường (C-18fbc5f3/C-70318b8c); cặp này không hiện trong markdown.
- **Đạt/Không đạt:** **Đạt có điều kiện** (R1: Đạt). Theo chữ của kỳ vọng, lý do ở câu hỏi con core chỉ nêu một trong hai năm.
- **Bài học:** lý do từ chối lấy năm từ các claim mà model gắn là liên quan, nên nhãn `context` của model có thể làm mất thông tin ngày ở dòng lý do.

### T14. Follow-up giữ bối cảnh (cha = Q2, chuyên viên loại mọi claim S017 ở run cha)
- **Kỳ vọng:** phạm vi brief follow-up chứa Việt Nam, mobile và doanh thu; không claim S017 nào làm bằng chứng; memo hiện run cha; không có cổng hỏi lại.
- **Kết quả thực tế:**
  - `needs_clarification=false`. Scope = nguyên văn scope của Q2 ("Thị trường game di động (mobile game) tại Việt Nam... doanh thu..."), nên có đủ cả ba từ. R1 thiếu chữ "doanh thu" trong scope.
  - `context.json`: `rejected_sources=["S017"]`. `reviews.json`: cả 5 claim S017 của follow-up (C-22b56986, C-9e919b81, C-f7469705, C-7afebe00, C-b803f0c8) bị loại với ghi chú "kế thừa từ Q2". Không mã S017 nào xuất hiện trong markdown thật hoặc thử.
  - Memo ghi "Nghiên cứu tiếp từ: ... (Q2)".
  - Lưu ý:
    - (a) Scope sao chép nguyên scope cha, không nhắc nhóm nhập vai; trọng tâm RPG chỉ có trong câu hỏi con.
    - (b) Memo viết "Kế thừa phạm vi và **5** quyết định duyệt", nhưng run cha có 2 quyết định loại claim; 5 là số claim của follow-up bị loại theo nguồn. Con số đúng về máy móc nhưng dễ hiểu nhầm.
    - (c) `p3.json` vẫn đếm claim đã bị loại trong lý do (sq2 thật: "Chỉ có 1 claim hạng C/D"); memo ghi đúng "Không có claim hợp lệ".
    - (d) Tổng thể "Chưa đủ căn cứ": đúng, vì kho không có tỷ trọng doanh thu RPG tại Việt Nam (đã kiểm ở R1; sq1 R2 không trích được claim nào).
- **Đạt/Không đạt:** **Đạt.**
- **Bài học:** kế thừa quyết định loại nguồn chạy ổn qua hai vòng với hai brief khác nhau.

### T15. Follow-up không liên quan (cha = Q3, câu về giá cà phê)
- **Kỳ vọng:** bị đánh dấu không liên quan, không kế thừa gì, không có kết luận về thị trường game.
- **Kết quả thực tế:**
  - `followup.related=false`, `inherited=0`; scope là cà phê Robusta Tây Nguyên; memo thật từ chối 5/5; memo thử chỉ hiện SYN09 (120.000 đồng/kg) ở danh sách C/D.
  - Còn tồn tại như R1:
    - `context.json` vẫn ghi `inherit: true` và giữ 5 gaps của Q3.
    - Bước tiếp theo cho giá cà phê là mẫu câu "báo cáo ngành... 18 tháng".
  - Mới:
    - Brief đặt sq1 là "giá... **dự báo** tháng 9/2026", trong khi tháng 9/2026 đã qua so với ngày tham chiếu 2026-10-13.
    - Dòng "Không kế thừa bối cảnh (người dùng bỏ, hoặc câu hỏi mới không liên quan)" không nói rõ là trường hợp nào.
- **Đạt/Không đạt:** **Đạt có điều kiện.**
- **Bài học:** cơ chế ngắt kế thừa ổn định. Dữ liệu `context.json` không nhất quán, và đến nay chưa gây hại.

### T16. Kiểm chứng
- **Kỳ vọng:** mọi câu trong "Có thể tin" có ≥1 claim ID và mọi số có trong đoạn trích (code); chấm tay ≥95% đúng; mọi câu hỏi con bị từ chối liệt kê những gì đã tìm.
- **Kết quả thực tế:**
  - "Có thể tin" trống ở 24/24 memo, nên hai điều kiện đầu chỉ đạt hiển nhiên.
  - Mở rộng sang tầng "Chưa chắc chắn": 5/5 câu (4 fact, 1 "[suy luận]") có claim ID, và mọi số (700, 490, 12, 26, 2025) có trong đoạn trích.
  - Chấm tay: nới 5/5, chặt 4/5 (X2 nói rộng phạm vi).
  - Liệt kê những gì đã tìm: **0/117** câu hỏi con bị từ chối (60 thật, 57 thử) có danh sách đoạn đã tìm trong markdown hoặc trong `memo_*.json`. Dữ liệu `retrieved` (8 đoạn/câu hỏi con) có trong `p2.json` cho 60/60 câu hỏi con. Giao diện (`Evidence.tsx`) được cho là hiển thị phần này, nhưng **chưa kiểm trên giao diện chạy thật**.
- **Đạt/Không đạt:** **Không kiểm được đầy đủ** (không có câu "Có thể tin" nào để chấm; phần minh bạch tìm kiếm không có trong memo).
- **Bài học:** bộ thử không có kịch bản nào mà tầng "Có thể tin" phải có nội dung. Vì vậy T16 và chỉ số "claim cũ trong Có thể tin" không thể thất bại với kho hiện tại. Đây là phát hiện về chính bộ thử; tôi không đổi kỳ vọng.

## 3. R2/R3: T1-T9 và D1-D5

### 3.1 Bảng máy (scorer M2 không đổi, chạy lại lúc chấm, khớp `round_2/compare.md`) và chấm tay

| Kịch bản | M2 | R1 | R2 máy | R2 tay | Ghi chú |
|---|---|---|---|---|---|
| T1 | Fail | Fail | Fail | Fail | Quy tắc 60/180 nằm ở S001-p74-0, S001-p85-1 nhưng không được truy xuất cho Q3 |
| T2 | Pass | **Fail** | Pass | **Đạt có điều kiện** | Đủ 700/490, `definition`, có "Gợi ý dùng", Medium. Lời giải thích dùng kiến thức ngoài claim ("~30%", "Apple/Google (30%)") |
| T3 | Pass | Pass | Pass | Pass | 3 thông cáo = 1 nguồn độc lập, hạng C |
| T4 | Pass | Pass | Pass | Pass | SYN01 (2021, hạng D) chỉ là "Lịch sử (stale, dữ liệu 2021)" |
| T5 | Fail | Pass | Pass | Đạt có điều kiện | Xem R3 |
| T6 | Pass | Pass | Pass | Pass | AMB: 3 câu hỏi lại, 0 câu hỏi con |
| T7 | Fail (tay) | Fail (tay) | cần chấm tay | **Fail** | Mục 3.3 |
| T8 | Fail | Pass | Pass | **Pass, hiển nhiên** | MVP chế độ thật có 0 câu kết luận ở Q1-Q5, nên 0 số không căn cứ. Baseline là cùng một tệp ở M2/R1/R2 (md5 trùng) |
| T9 | Fail | Fail | Fail | Fail | Không có câu nào dựa vào S001-S003. Phần nhãn dự thảo theo từng mục nay đã có (Q3 sq3) |
| D1-D3 | Pass | Pass | Pass | Pass | |
| D4 | Pass | Không kiểm được | **Fail** | **Fail** | Mục 3.2 |
| D5 | Không kiểm được | Không kiểm được | Không kiểm được | Không kiểm được (máy); tay: SYN09 chỉ chạm ở T15 dạng tín hiệu C/D | |

### 3.2 D4: do luật hay do trích xuất?
- **Kỳ vọng:** mâu thuẫn thật SYN07 (18%) / SYN08 (9%) được phát hiện, không giải thích được, mức Low.
- **Kết quả thực tế:**
  - B sq1 (core, hỏi đúng tỷ trọng): SYN07 và SYN08 là hai đoạn truy xuất đầu tiên và model trích được cả hai claim, nhưng **cả hai bị verify loại**: "passage is not a verbatim quote of any retrieved chunk".
  - Đối chiếu bảng `chunks`: đoạn gốc là "...Việt Nam 2025\nPhương pháp: ...", còn model trích "...Việt Nam 2025**.** Phương pháp: ..." (chèn dấu chấm khi nối tiêu đề với thân).
  - Ở sq3, sq5, các claim SYN07/SYN08 bị loại vì "entity 'Việt' not in passage": model chỉ trích dòng "Kết quả:..." không có chữ Việt Nam, trong khi nội dung claim có.
  - Mâu thuẫn **vẫn được phát hiện** ở B sq2 (C-3a1a0fc9 / C-3490e205, `unknown`, `unexplained`) và ở A sq5 (C-9967010d / C-7fd079d7). Nhưng ở đó cả hai claim được gắn `context`, nên code (đúng thiết kế) không đưa ra mức cho câu hỏi con đó.
  - `trust.py` dòng 262-264: nếu có mâu thuẫn A/B chưa giải thích giữa các claim còn hợp lệ thì mức là Low. Vậy nếu hai claim ở sq1 qua được verify, luật sẽ cho Low.
- **Đạt/Không đạt:** **Fail** (đồng ý với máy).
- **Nguyên nhân:** **trích xuất (model chép sai dấu câu) cộng verify khớp nguyên văn chặt**; không phải luật M3. Lần sửa thứ 2 không động vào extract/verify/retrieve (git diff 6ca2702..23b3de0 chỉ đổi brief, conflict, memo, trust).
- **Bài học:** độ nghiêm của verify vẫn là nguồn mất bẫy lớn nhất. Ở R2, chỉ 91/153 claim (59,5%) qua verify (R1: 93/160 = 58,1%). Verify đúng khi loại claim không có căn cứ, nhưng khớp nguyên văn không chuẩn hóa dấu câu và xuống dòng thì loại cả claim đúng.

### 3.3 T7 (bảng/biểu đồ PDF), chấm tay ngắn
- 8 claim, 6 hợp lệ.
- S006-p6-0 (biểu đồ tròn D1/D7): model ghép 6 số thành 6 nhóm có nhãn lặp ("D1 40-50% D7 10-20% chiếm 27.9%" rồi lại "... chiếm 42.3%"). Sai và không có cờ cảnh báo; R1 ghép thành 3 nhóm, cách khác nhưng cũng sai.
- S006-p5-0: model gán sáu số đầu theo thứ tự đọc cho sáu thể loại; như R1 đã phân tích, nhiều khả năng sai.
- S006-p9-0 (bảng 4X): đúng.
- Ba claim S005 là ứng dụng ngoài game.
- Một câu nguyên văn của S005 ("In Q1 2026, Vietnam's gaming app sessions climbed 15%...") bị loại ở cả hai vòng vì "not a verbatim quote". Tôi không kiểm đoạn gốc của câu này.
- **Fail**, không phải hồi quy.

### 3.4 R3 (Q4, thiếu dữ liệu)
- **Kỳ vọng:** tổng thể "Chưa đủ căn cứ" ở cả hai chế độ; câu hỏi con D7 thực tế bị từ chối; số benchmark nếu hiện phải ghi "không trả lời câu hỏi gốc"; bước tiếp theo nêu loại dữ liệu cần (dashboard retention nội bộ của game X).
- **Kết quả thực tế:**
  - Tổng thể "Chưa đủ căn cứ" ở cả hai chế độ; sq1 (core) bị từ chối.
  - Không có số benchmark nào hiện ra, nên điều kiện thứ ba chỉ đạt hiển nhiên.
  - Bước tiếp theo của sq1 là "Cần dữ liệu nội bộ của Gamota (dashboard/BI vận hành của chính game đó); kho tài liệu công khai không thể có số này": đúng.
  - Nhưng câu này lặp cho cả 5 câu hỏi con, kể cả sq3 "so với trung bình ngành", nơi phần benchmark là dữ liệu công khai. Claim S005 về D7 bị verify loại ("entity 'Mobile' not in passage"). Regex mới vẫn khớp vì câu hỏi con có chữ "game X".
  - Lý do sq1 chế độ thật nay đúng chữ: "Không có claim hợp lệ nào".
- **Đạt/Không đạt:** **Đạt có điều kiện** (như R1).

## 4. Kiểm tay chỉ số mục 7

### 4.1 Câu bằng chứng chính (mọi câu dưới câu hỏi con có kết luận, R2)
Cách chấm như R1. **Nới:** câu đúng với đoạn nguồn và trả lời trực tiếp câu hỏi con. **Chặt:** thêm điều kiện không sai phạm vi và không sai từ ngữ trạng thái.

| # | Memo / câu hỏi con | Claim | Nới | Chặt | Ghi chú |
|---|---|---|---|---|---|
| 1 | Q2 thử sq1: 700 triệu USD, tổng chi tiêu, iOS+Android | C-d4af740f | Đạt | Đạt | |
| 2 | Q2 thử sq1: 490 triệu USD, thực nhận, chỉ nhà phát hành tại Việt Nam | C-ecb2ae60 | Đạt | Đạt | Đã sửa lỗi phạm vi của R1 |
| 3 | Q2 thử sq1: chênh lệch do phạm vi và phương pháp [suy luận] | 2 claim | Đạt | Đạt | |
| 4 | X1 thử sq1: "đạt 12 triệu lượt tải" | C-02041109 | Đạt | Đạt | Đã sửa "dự báo" của R1 |
| 5 | X2 thử sq1: "Tổng doanh thu thị trường... đạt 26 triệu USD" | C-010404be | Đạt | Không | Nguồn: doanh thu trong ứng dụng của 25 game |

**Nới 5/5 = 100%; chặt 4/5 = 80%.** Chế độ thật: **0 câu** (không đo được). Cả 5 câu đều dựa trên tài liệu SYNTHETIC. Mục tiêu ≥90%: **không đạt** theo cách chặt. Theo cách nới thì đạt, nhưng mẫu 5 câu SYNTHETIC không đủ để kết luận về tài liệu thật.

### 4.2 Hạ nhầm
- 0 lần hạ trong 24 memo; 4 câu fact.
- Kiểm tra mới về từ trạng thái ("dự báo/ước tính" không có trong claim) **chưa từng kích hoạt** (`demoted_status_words` không xuất hiện). Cải thiện về từ ngữ đến từ prompt memo, không chứng minh được hiệu lực của kiểm tra bằng code trong lần chạy thật.

### 4.3 Đồng thuận nhãn liên quan (`answers`)
- **Mẫu:** **mọi** claim hợp lệ trong `p3.json` của X1, X2, X3, Q2, Q3, B, Q1, A (74 cặp câu hỏi con-claim; không chọn lọc).
- **Quy tắc của tôi:** `direct` = trả lời đúng đại lượng, phạm vi, kỳ hỏi. `partial` = một phần câu trả lời (thành phần, kỳ/phạm vi khác của cùng đại lượng, một đầu vào của phép tính). `context` = liên quan nhưng không cung cấp phần nào của câu trả lời. Độ tin cậy và tính cũ **không** tính vào mức liên quan.
- **Kết quả:** khớp **53/74 = 71,6%**; tài liệu thật 20/26 = 76,9%; SYNTHETIC 33/48 = 68,8%. **Không đạt** (≥80%).
- **21 chỗ lệch** (mô hình -> tôi):
  - Trộn độ tin cậy/thời gian vào mức liên quan (3): C-6b6ca981 SYN14 partial->direct; C-846d660c SYN15 partial->direct; C-b15a040e SYN18 context->partial (X3 sq1).
  - Đầu vào tính tăng trưởng bị coi là bối cảnh (4): Q2 sq2 C-4ec2d6e1, C-3e83e09d, C-718450d7 context->partial; B sq2 C-db18f54c (S008, 2024, Google Play) context->partial.
  - Số không trả lời câu hỏi con nhưng gắn partial/direct (10): X2 sq5 C-e12a2547, C-f3285a50 (doanh thu cho câu retention/ARPU); A sq2 C-0d9dd969, C-7513a34c (tốc độ tăng cho câu "tổng doanh thu đạt bao nhiêu"); A sq4 C-4a8908b8, C-4eef42d1, C-73b2407c (con số tăng cho câu "yếu tố tác động"); A sq5 C-e0b317d4; Q2 sq3 C-4e40eb59 (tỷ trọng IAP Việt Nam/Đông Nam Á cho câu cơ cấu IAP/quảng cáo); Q3 sq5 C-1019d5ee.
  - Phạm vi hẹp hơn bị gắn direct (3): Q2 sq1 C-ecb2ae60 (SYN06 chỉ nhà phát hành Việt Nam); Q3 sq5 C-b8b2c0d2 (một Nghị định qua bài báo cho câu "các văn bản"); Q1 sq2 C-34ea6989 (một kỳ H1 2026, không có dự báo).
  - Claim sai đơn vị (1): Q1 sq1 C-a1225826 (xem 7.2): theo đúng đoạn nguồn là thời gian chơi, nên là `context` cho câu quy mô.
- **Độ nhạy:** con số phụ thuộc vào cách chấm của tôi. Nếu chấp nhận nhãn của model ở 6 ca biên của câu A và 3 ca tăng trưởng Q2 sq2, kết quả là 62/74 = 83,8%. Nếu chỉ chấp nhận 6 ca của câu A, là 59/74 = 79,7%. Mẫu R1 (85,5%) khác cách lấy mẫu (R1 nghiêng về ca dễ) nên **không so trực tiếp được**.

## 5. Hữu ích cho người ra quyết định

### 5.1 Số câu hỏi con theo tầng (đếm lại từ tệp)

| Hệ thống | Chế độ | Số câu | Câu hỏi con có kết luận | "Có thể tin" | "Chưa chắc chắn" | Tổng thể bị từ chối |
|---|---|---|---|---|---|---|
| M2 | thật | 10 | 6/50 (Medium) | - | - | 7/10 |
| M2 | thử | 10 | 14/50 (13 Medium, 1 Low) | - | - | 3/10 |
| R1 | thật | 12 | 1/60 | 0 | 1 | 12/12 |
| R1 | thử | 12 | 4/60 | 0 | 4 | 12/12 |
| R2 | thật | 12 | **0/60** | 0 | 0 | **12/12** |
| R2 | thử | 12 | 3/60 | 0 | 3 (Q2, X1, X2) | 9/12 |

Ghi chú: báo cáo R1 ghi M2 "6/10" (thật) và "4/10" (thử) bị từ chối tổng thể. Đếm lại từ cùng tệp, tôi được 7/10 và 3/10. Tôi sửa lại ở đây.

**Trả lời thẳng:** R2 trả lời được nhiều hơn R1 ở chế độ thử (3 câu có mức tổng thể Medium thay vì 0). Ở **chế độ thật, R2 không trả lời được câu hỏi con nào**. Phần lớn mức Medium của M2 ở chế độ thật đã được R1 chấm là không liên quan, nên bỏ chúng là đúng. Nhưng hệ thống chưa thêm được câu trả lời đúng nào trên tài liệu thật.

### 5.2 Mỗi lần từ chối là đúng (dữ liệu vắng) hay bỏ sót (dữ liệu có trong kho)?
Đã đối chiếu bảng `chunks` (chỉ đọc).
- **Q2 (thật): bỏ sót.**
  - Kho có S004-p1-1 "Market Value: USD 575 million (2025)", S004-p1-2 (575 -> 997 triệu USD đến 2031), S004-p1-6 (bảng theo năm). Có thêm S014-p1-0 (Gamota, 825 triệu USD, thông cáo tự công bố, sẽ là hạng thấp).
  - Ở sq1 (core), **8/8 đoạn truy xuất là SYNTHETIC**, nên chế độ thật không còn đoạn nào. Brief còn dùng truy vấn "2023 2024" cho câu "gần nhất".
  - Nguyên nhân: truy xuất (BM25, không đổi theo chủ đích) cộng tài liệu SYNTHETIC chung chỉ mục. Trên toàn bộ câu hỏi thật (Q1-Q5, A, B, T14), 165/320 = 51,6% vị trí top-8 là SYNTHETIC.
  - Hạng của S004 nếu được truy xuất: chưa tính.
- **Q3: bỏ sót.**
  - S001-p73-1 (Điều 39, điều kiện cấp Giấy phép G1), S001-p75-0 (Điều 40, hồ sơ), S001-p74-0 và S001-p85-1 (60/180 phút), S002-p30-0 (Quyết định phê duyệt nội dung) đều có trong kho. sq1 truy xuất 8 đoạn tài liệu thật nhưng không đoạn nào trong số này.
  - Nguyên nhân: khác từ vựng ("phát hành game online" so với "cung cấp dịch vụ trò chơi điện tử G1"), và văn bản PDF bị tách chữ ("60 p hút", "trò c hơi") làm BM25 kém.
  - Kể cả khi tìm được, luật `single_origin` (S001-S003 là một Nghị định) chỉ cho phép tối đa "Chưa chắc chắn".
- **B:**
  - Chế độ thật từ chối là **đúng** (câu trả lời chỉ có trong SYNTHETIC).
  - Chế độ thử là **bỏ sót**: SYN07/SYN08 đứng đầu truy xuất, claim được trích nhưng bị verify loại (mục 3.2).
- **X1:** chế độ thật **đúng** (chỉ SYNTHETIC); chế độ thử trả lời Medium.
- **Q4, Q5, X3, T14, T15:** **đúng** (dữ liệu thật sự vắng, hoặc chỉ cũ, hoặc không liên quan). Q4 sq3 có benchmark công khai một phần (S005), bị verify loại.
- **A:** từ chối đúng theo luật (chỉ có claim C/D trả lời trực tiếp; đây là bẫy thông cáo).
- **Q1:** chưa kiểm đầy đủ. Kho chỉ có tín hiệu một phần (S017 tăng trưởng, S006 thời gian chơi); tôi không tìm thấy quy mô thị trường idle RPG Việt Nam.

### 5.3 Các sửa đổi của lần sửa thứ 2 có hiệu quả không?

| Sửa đổi | Hiệu quả trong R2 | Bằng chứng |
|---|---|---|
| Brief chọn 1-2 câu hỏi con core cùng đại lượng | **Có** | 11/12 câu có đúng 1 core, Q3 có 2; Q2/X1/X2 thử tổng thể Medium; T2 Pass. Q1 (câu hỏi quyết định "có nên làm") chỉ lấy quy mô thị trường làm core: tranh luận được |
| Claim cũ gắn `context` là bối cảnh, không phải lịch sử | **Không kiểm được trên ca cũ** | Ca R1 (SYN17 dưới tổng doanh thu Q2) không lặp lại vì R2 không trích claim SYN17 ở Q2. Q2 sq2: các cặp `stale` của claim `context` không còn ở "Lịch sử". X3 sq3: cặp đua xe/tổng thị trường vẫn được code ghép (không hiện trong markdown) |
| Gợi ý "dữ liệu nội bộ Gamota" chỉ cho game của Gamota | **Phần lớn có** | X2 sq5, T14 sq3 nay là "báo cáo ngành". Q4 sq3 (benchmark ngành) vẫn bị gán "kho công khai không thể có số này" |
| Kiểm tra từ trạng thái (dự báo/ước tính) | **Câu memo đúng; kiểm tra code chưa kích hoạt** | X1 "đạt 12 triệu", X2 không có "ước tính"; `demoted`=0 |
| Lý do từ chối nêu claim A/B bối cảnh | **Có, chưa hết lỗi** | "Chỉ có 2 claim hạng A/B chỉ là thông tin bối cảnh..." (Q2 sq2, X2 sq2/sq3, B sq2, A sq5). Còn sai: X2 sq5 và X3 sq3 "chỉ có số liệu cũ" khi có claim mới; T14 `p3` đếm claim đã loại |
| Nhãn dự thảo theo từng mục (pháp lý) | **Có** | Q3 sq3: "[DỰ THẢO, chưa có hiệu lực]" cho C-c3443c0d (S009); lý do "Chỉ có nội dung dự thảo / đề xuất" |
| Lời giải thích mâu thuẫn không nêu tổ chức/số ngoài hai claim | **Một phần** | Không còn Sensor Tower/data.ai/AppMagic/Niko, không còn "lấy trung bình". Nhưng Q2 sq1 "mức phí cửa hàng phổ biến (~30%)" và Q2 sq2 "phí cửa hàng tiêu chuẩn của Apple/Google (30%)": tổ chức và số không có trong claim. Ca T14 của R1 không lặp lại nên không so được cùng ca |

## 6. Ổn định: kết luận được gì, không kết luận được gì

- **R1 -> R2 không phải phép đo ổn định thuần.** Prompt brief, prompt memo, prompt giải thích mâu thuẫn và `trust.py` đã đổi sau khi thấy R1. Hệ quả: **0/60 câu hỏi con có cùng nội dung** giữa hai vòng, và truy xuất của sq1 chỉ trùng 4-8/8 đoạn. Mọi khác biệt về claim, mức, tầng giữa hai vòng không thể quy cho dao động của model.
- **Cùng đầu vào duy nhất là T7.** Truy vấn cố định, BM25 tất định, code extract/verify không đổi. Ở temperature 0, đầu ra vẫn khác:
  - R1 có 9 claim (6 hợp lệ), R2 có 8 claim (6 hợp lệ), tập claim khác nhau.
  - Biểu đồ S006-p6 được đọc theo hai cách khác nhau, cả hai đều sai.
  - Câu "short drama apps ranked fifth..." bị loại ở R1, hợp lệ ở R2.
  - Đây là bằng chứng duy nhất về độ ổn định: **trích xuất không lặp lại được giữa hai lần chạy**, nên mọi kết quả phụ thuộc trích xuất (D4, T7, nhãn liên quan) có thể đổi giữa các lần chạy.
- **Ổn định về hành vi qua hai vòng** (khác brief, khác lần trích xuất), không phải ổn định về đầu ra:
  - Cơ chế `weak_dissent`, `revision`, `stale`, kế thừa loại nguồn và ngắt kế thừa chạy đúng ở cả hai vòng.
  - Q4, Q5, X3 bị từ chối ở cả hai vòng.
  - T1, T7, T9 thất bại ở cả hai vòng.
  - D4 không bắt được ở cả hai vòng, cùng một kiểu lỗi verify.
- **Không kết luận được:** các cải thiện của R2 (T2 Pass, X1/X2 Medium, câu memo đúng từ ngữ) có lặp lại hay không. Cần ít nhất 2 lần chạy với cùng code, cùng prompt.

## 7. Nội dung gây hiểu nhầm trong memo R2 (theo mức ảnh hưởng)

1. **Từ chối ở chế độ thật mà không nói lý do thật.** Q2 sq1: "Không có claim hợp lệ nào trả lời câu hỏi con", kèm "Cần báo cáo ngành..." khiến người đọc nghĩ kho không có số. Thực tế kho có S004 (575 triệu USD 2025); truy xuất trả về 8 đoạn SYNTHETIC rồi chế độ thật bỏ hết. Markdown không liệt kê đoạn đã tìm (giao diện có thể có; chưa kiểm).
2. **Claim sai đơn vị lọt qua verify.** C-a1225826 (S006, hạng B, Q1 sq1) viết "các mốc người chơi: 48,3 triệu; 31,9 triệu; 35,9 triệu; 33,3 triệu (đơn vị triệu)". Đoạn nguồn S006-p10-0 là biểu đồ có trục "0m 10m ... 50m", tức là **phút**. Claim C-d87f75dc trong cùng lần chạy (Q1 sq4) đọc đúng là phút. Claim sai này làm lý do của Q1 sq1 thành "Chỉ có claim hạng A/B trả lời một phần câu hỏi con". Nội dung không hiện trong markdown, nhưng có trong danh sách claim. Verify chỉ kiểm số có mặt, không kiểm đơn vị.
3. **Lời giải thích mâu thuẫn dùng kiến thức ngoài kho** (Q2 thử sq1, sq2): "~30%", "Apple/Google (30%)", và khẳng định gross/net là "yếu tố quyết định", hạ thấp khác biệt phạm vi. Đoạn này được chép vào "Giả định chính".
4. **Nói rộng phạm vi số liệu:** X2 "Tổng doanh thu thị trường game cờ tướng... 26 triệu USD" (nguồn: IAP của 25 game).
5. **Gợi ý dùng số cho mâu thuẫn chưa giải thích:** A sq5 "Dùng 18% khi cần... kịch bản lạc quan... 9% khi cần mức bảo thủ". Hai khảo sát cùng phương pháp cho kết quả gấp đôi nhau không phải là một khoảng lạc quan/bảo thủ (hiện dưới câu hỏi con bị từ chối, chế độ thử).
6. **Lý do từ chối sai chữ:**
   - X2 sq5 "Chỉ có số liệu cũ hoặc đã được thay thế (dữ liệu 2025)" khi có claim 26 triệu mới.
   - X3 sq3 "chỉ số liệu cũ (2021, 2022)" khi có claim 2025 hạng A.
   - T14 "Kế thừa... 5 quyết định duyệt" (run cha chỉ có 2).
7. **Bước tiếp theo sai loại dữ liệu:** Q4 sq3 "kho tài liệu công khai không thể có số này" cho phần benchmark ngành.
8. **Dòng "Chưa chắc chắn (partial_relevance)" không nêu claim hay số nào** (Q1 sq1/sq4, Q3 sq1/sq2/sq4, X2 sq4/sq5, X3 sq3). Lỗi này còn tồn tại từ R1.
9. **Đếm trùng claim:** A sq1 có hai claim S016 gần như giống nhau ("idle RPG revenue grew 40.2%" và "while idle RPG revenue grew 40.2%"), nên lý do ghi "3 claim hạng C/D".
10. T15: brief gọi giá tháng 9/2026 (đã qua) là "dự báo".

## 8. Lỗi và giới hạn quan sát được (theo mức ảnh hưởng, kèm nguyên nhân nghi ngờ)

1. **Chế độ thật không trả lời được gì (0/60).** Nguyên nhân: truy xuất BM25 (cố ý không đổi), tài liệu SYNTHETIC chiếm 51,6% top-8 ở câu hỏi thật và bị bỏ sau truy xuất, khác từ vựng pháp lý, văn bản PDF bị tách chữ, truy vấn của brief chọn năm sai (Q2 "2023 2024").
2. **Verify khớp nguyên văn quá chặt so với cách model trích.** Chỉ 59,5% claim qua verify; mất D4 (dấu chấm chèn thêm), mất benchmark Q4 sq3 ("entity 'Mobile'"), mất claim SYN07/SYN08 ở Q1, B, T14 ("entity 'Việt'" khi model cắt ngắn đoạn trích). Nguyên nhân: verify (không chuẩn hóa dấu câu/xuống dòng) cộng model.
3. **Verify không bắt được sai đơn vị** (C-a1225826, phút đọc thành triệu). Nguyên nhân: đọc biểu đồ PDF dạng văn bản; kiểm số chỉ xét số có mặt.
4. **Tầng "Có thể tin" không bao giờ đạt được với kho hiện tại.** Nguyên nhân: thiết kế bộ thử. Không có câu nào có ≥2 nguồn gốc A/B độc lập trả lời trực tiếp mà không mâu thuẫn; văn bản pháp lý là một nguồn gốc. Hai chỉ số và T16 chỉ có thể đạt hiển nhiên. Tôi ghi đây là phát hiện để người dùng quyết định, không đổi kỳ vọng.
5. **Nhãn liên quan 71,6%.** Nguyên nhân: model trộn độ tin cậy/thời gian vào mức liên quan, gắn `partial` cho số không trả lời câu hỏi con, coi đầu vào tính tăng trưởng là bối cảnh.
6. **Lời giải thích mâu thuẫn vẫn dùng kiến thức ngoài claim** dù prompt đã cấm. Nguyên nhân: model; không có kiểm tra bằng code cho tên tổ chức/số trong phần giải thích.
7. **Đầu ra trích xuất không lặp lại được ở temperature 0** (T7). Nguyên nhân: model/nhà cung cấp. Hệ quả: kết quả bẫy (D4) và nhãn có thể đổi giữa các lần chạy.
8. **Mẫu câu bước tiếp theo theo regex** (Q4 sq3) và **mẫu lý do từ chối** (X2 sq5, X3 sq3). Nguyên nhân: luật trong `trust.py`/`memo.py`.
9. **T7 biểu đồ PDF vẫn sai.** Nguyên nhân: không có bộ trích bảng/biểu đồ (cố ý không làm).
10. **Giới hạn của chính bộ thử:**
    - Kho nhỏ (36 tài liệu, 18 SYNTHETIC), 12 câu, bẫy tự viết và tự mô tả dấu hiệu.
    - Mỗi phiên bản code chỉ có 1 lần chạy.
    - Kết quả cho thấy cơ chế chạy; **không** chứng minh độ chính xác trên thị trường thật.

## 9. Không kiểm được

- **Giao diện:** phần "Hệ thống đã tìm những gì" cho câu hỏi con bị từ chối, và việc giao diện có hiện nội dung claim `partial` (gồm C-a1225826) hay không: **chưa kiểm** trên giao diện chạy thật.
- **Độ ổn định của R2:** chỉ 1 lần chạy với code của lần sửa thứ 2: **không đo**.
- **Hạng của S004 nếu được truy xuất:** chưa tính bằng bảng điểm (spec 03).
- **Câu "Vietnam's gaming app sessions climbed 15%"** của S005 bị loại ở T7: chưa đối chiếu đoạn gốc.
- **Tính đúng của Nghị định 174/2026 do S011 (báo, hạng D) nêu:** nằm ngoài kho, **không kiểm**.
- **Q1:** chưa kiểm đầy đủ liệu kho có trả lời được câu hỏi con nào không.
- **Tính đúng của các lời giải thích mâu thuẫn do LLM viết**, ngoài các điểm đã nêu: không kiểm từng câu.
- **Thời gian:** đo từ trường `timing` trong tệp, không đo lại. Không so được với M2 (M2 chạy tuần tự, khác quota và cache).

## 10. Tệp liên quan

- Báo cáo này: `D:\gamota-research-copilot\backend\tests\reports\20261021-m3-round2-evaluator.md`
- Dữ liệu R2: `D:\gamota-research-copilot\backend\runs\m3\round_2\` (đặc biệt `B\p2.json`, `Q1\p3.json`, `Q2\memo_test.json`, `X2\memo_test.json`, `T14\context.json`, `T14\reviews.json`, `T7\claims.json`, `compare.md`)
- Báo cáo vòng 1: `D:\gamota-research-copilot\backend\tests\reports\20261021-m3-evaluator.md`
- Kỳ vọng: `D:\gamota-research-copilot\docs\spec\09-mission3.md`
