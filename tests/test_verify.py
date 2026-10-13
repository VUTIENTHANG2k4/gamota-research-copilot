from app.verify import verify_claim

CH = [{"chunk_id": "c1", "text": "Theo báo cáo, doanh thu game di động Việt Nam năm 2023 đạt khoảng 1,2 tỷ USD.\nGamota công bố."}]
P = "doanh thu game di động Việt Nam năm 2023 đạt khoảng 1,2 tỷ USD"


def c(content, passage=P, value=None):
    return {"content": content, "passage": passage, "value": value}


def test_valid():
    assert verify_claim(c("Doanh thu game Việt Nam năm 2023 là 1,2 tỷ USD", value=1.2), CH)["valid"]


def test_wrong_number():
    r = verify_claim(c("Doanh thu game Việt Nam năm 2023 là 2,1 tỷ USD"), CH)
    assert not r["valid"] and "number" in r["reason"]


def test_wrong_year():
    assert not verify_claim(c("Doanh thu game Việt Nam năm 2024 là 1,2 tỷ USD"), CH)["valid"]


def test_invented_entity():
    r = verify_claim(c("Doanh thu của Garena năm 2023 là 1,2 tỷ USD"), CH)
    assert not r["valid"] and "entity" in r["reason"]


def test_passage_not_verbatim():
    assert not verify_claim(c("Doanh thu 1,2 tỷ USD", passage="doanh thu đạt 1,2 tỷ USD theo báo cáo khác"), CH)["valid"]


def test_decimal_separator_variants():
    ch = [{"chunk_id": "c2", "text": "Revenue reached USD 1.2 billion in the year 2023 according to the report."}]
    assert verify_claim(c("Doanh thu đạt 1,2 tỷ USD", passage="Revenue reached USD 1.2 billion in the year 2023"), ch)["valid"]


def test_stray_spaces_in_pdf_text():
    ch = [{"chunk_id": "c3", "text": "không quá 60 p hút đối với từng trò c hơi, không quá 180 phút một ngày"}]
    assert verify_claim(c("Không quá 60 phút mỗi trò chơi và 180 phút mỗi ngày",
                          passage="không quá 60 phút đối với từng trò chơi, không quá 180 phút một ngày"), ch)["valid"]
    assert not verify_claim(c("Không quá 90 phút mỗi trò chơi",
                              passage="không quá 90 phút đối với từng trò chơi, không quá 180 phút một ngày"), ch)["valid"]
