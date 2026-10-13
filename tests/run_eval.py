"""Test suite T1-T9 for gamota-research-copilot.

  python tests/run_eval.py --run N        run the pipeline for every scenario, save to runs/p4/round_N/
                                          (LLM calls; resumes: existing files are skipped)
  python tests/run_eval.py --score R1 [R2]  score saved rounds, no LLM calls -> runs/p4/scores.json

Expectations are quoted from docs/spec/06-evaluation.md and are fixed BEFORE results are seen.
A scenario whose trap/input never reached the pipeline is reported "KHÔNG KIỂM ĐƯỢC", never "Pass".
"""
import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

QS = json.load(open(ROOT / "tests/questions.json", encoding="utf-8"))
EXTRA = {  # declared in advance (approved by the user 2026-10-13); used only to exercise traps
    "A": "Doanh thu nhóm game idle RPG tăng bao nhiêu trong quý II/2026?",
    "B": "Thể loại idle RPG chiếm bao nhiêu phần trăm lượt tải mobile game Việt Nam năm 2025?",
}
AMBIGUOUS = "Thị trường game casual thế nào?"
T7_QUERIES = [  # restricted to the two PDF reports (S005 Adjust, S006 Funtap) that contain tables
    "chi phí cài đặt CPI retention D1 D7 Vietnam by genre",
    "IAP revenue share installs sessions Vietnam benchmark",
    "tỷ lệ giữ chân người chơi và doanh thu theo thể loại game",
]
PRIMARY = ["Q1", "Q2", "Q3", "Q4", "Q5"]


def save(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


# ----------------------------------------------------------------------------- run mode
def run_round(n: int):
    from app import baseline
    from app.memo import build
    from app.pipeline import grade_and_decide, index, retrieve_extract
    from app.brief import make_brief
    from app.extract import extract_claims
    from app.verify import verify_claim

    out = ROOT / "runs" / "p4" / f"round_{n}"
    items = {**{k: QS[k] for k in PRIMARY}, **EXTRA}
    for key, q in items.items():
        d = out / key
        tag = f"r{n}_{key}"
        if not (d / "p2.json").exists():
            t0 = time.time()
            p2 = retrieve_extract(q, tag)
            save(d / "p2.json", p2)
            print(key, "p2 done", round(time.time() - t0), "s", flush=True)
        else:
            p2 = json.load(open(d / "p2.json", encoding="utf-8"))
        if not (d / "p3.json").exists():
            p3 = grade_and_decide(p2, tag)
            save(d / "p3.json", p3)
        else:
            p3 = json.load(open(d / "p3.json", encoding="utf-8"))
        for mode in ("real", "test"):
            f = d / f"memo_{mode}.json"
            if not f.exists():
                t0 = time.time()
                m = build(p3, mode, f"{tag}_{mode}")
                m["memo_s"] = round(time.time() - t0, 1)
                save(f, m)
                print(key, "memo", mode, "done", flush=True)
        if key in PRIMARY and not (d / "baseline.json").exists():
            save(d / "baseline.json", baseline.answer(q, tag))
            print(key, "baseline done", flush=True)
    # T6: ambiguous question -> brief only
    f = out / "AMB" / "brief.json"
    if not f.exists():
        b, retries = make_brief(AMBIGUOUS, f"r{n}_AMB")
        save(f, {"question": AMBIGUOUS, "brief": b.model_dump(), "retries": retries})
    # T7: extraction restricted to PDF reports with tables
    f = out / "T7" / "claims.json"
    if not f.exists():
        res = []
        for query in T7_QUERIES:
            chunks = [c for c in index().search(query, 40) if c["source_id"] in ("S005", "S006")][:6]
            if not chunks:
                continue
            ex, retries = extract_claims(query, chunks, f"r{n}_T7")
            for cl in ex.claims:
                v = verify_claim(cl.model_dump(), chunks)
                chunk = next((c for c in chunks if c["chunk_id"] == v["chunk_id"]), None)
                res.append({"query": query, **cl.model_dump(), **v, "source_id": chunk["source_id"] if chunk else None,
                            "chunk_text": chunk["text"] if chunk else None})
        save(f, {"claims": res})
    print("round", n, "complete")


# ----------------------------------------------------------------------------- score mode
def load(round_dir: Path, key: str, name: str):
    f = round_dir / key / name
    return json.load(open(f, encoding="utf-8")) if f.exists() else None


def memo_text(m) -> str:
    return m["markdown"] if m else ""


def all_claims(p3):
    return [c for s in p3["subs"] for c in s["claims"]] if p3 else []


def grade_of_citation(cit: str) -> str:
    m = re.search(r"hạng ([ABCD])", cit)
    return m.group(1) if m else "?"


def result(status, expectation, actual, lesson=""):
    return {"status": status, "expectation": expectation, "actual": actual, "lesson_hint": lesson}


NOT_TESTABLE = "KHÔNG KIỂM ĐƯỢC"


def score_round(rd: Path) -> dict:
    R = {}
    q3, memo3 = load(rd, "Q3", "p3.json"), load(rd, "Q3", "memo_real.json")
    # T1
    if memo3:
        facts = [p for s in memo3["subs"] for p in s["points"] if p["is_fact"]]
        pts = [p for s in memo3["subs"] for p in s["points"]]
        no_id = [p["text"][:60] for p in facts if not p["claim_ids"]]
        has_rule = any(("60" in p["text"] and "180" in p["text"]) for p in pts)
        a_cited = any(grade_of_citation(c) == "A" for p in pts for c in p["citations"])
        level = memo3["overall"]["level"]
        ok = not no_id and has_rule and a_cited and level == "High"
        R["T1"] = result("Pass" if ok else "Fail",
                         "Memo nêu đúng quy định hiện hành (60 phút/trò chơi, 180 phút/ngày), mọi câu fact có claim ID, nguồn chính thức hạng A, mức chắc chắn High.",
                         f"60/180 trong memo={has_rule}; câu fact thiếu ID={len(no_id)}; có nguồn hạng A={a_cited}; mức tổng thể={level}.")
    else:
        R["T1"] = result("Fail", "xem spec", "Không có memo")
    # T9
    if memo3:
        pts = [p for s in memo3["subs"] for p in s["points"]]
        decree = [p for p in pts if any(re.search(r"S00[123]", c) for c in p["citations"])]
        cites_draft_unlabeled = [p["text"][:70] for p in pts if any("dự thảo" in c.lower() for c in p["citations"]) and not p["draft_flag"]]
        draft_labeled = [p for p in pts if p["draft_flag"]]
        rule_pts = [p for p in pts if "60" in p["text"] and "180" in p["text"]]
        rule_not_draft = bool(rule_pts) and all(not p["draft_flag"] for p in rule_pts)
        ok = bool(decree) and rule_not_draft and not cites_draft_unlabeled
        R["T9"] = result("Pass" if ok else "Fail",
                         "Memo dùng Nghị định 147/2024/NĐ-CP làm căn cứ chính; dự thảo sửa đổi được gắn nhãn 'dự thảo, chưa có hiệu lực', không trình bày như quy định đang áp dụng.",
                         f"luận điểm dựa vào S001-S003={len(decree)}; luận điểm gắn nhãn dự thảo={len(draft_labeled)}; "
                         f"câu quy tắc 60/180 không bị gắn nhãn dự thảo={rule_not_draft}; trích dẫn dự thảo thiếu nhãn={len(cites_draft_unlabeled)}.",
                         "Chỉ đo được nhãn dự thảo khi một claim dự thảo thật sự lọt vào kết luận hạng A/B; nguồn dự thảo hiện là hạng C/D nên bị loại khỏi kết luận.")
    # T2 (+ D3)
    q2, memo2t, memo2r = load(rd, "Q2", "p3.json"), load(rd, "Q2", "memo_test.json"), load(rd, "Q2", "memo_real.json")
    if memo2t:
        txt = memo_text(memo2t)
        both = "700" in txt and "490" in txt
        confl = [x for s in memo2t["subs"] for x in s["conflicts"]]
        defin = [x for x in confl if x["cause"] == "definition"]
        usage = any(x.get("usage_suggestion") for x in defin)
        level = memo2t["overall"]["level"]
        ok = both and bool(defin) and usage and level == "Medium"
        R["T2"] = result("Pass" if ok else "Fail",
                         "Hiện khoảng giá trị, giải thích do định nghĩa đo khác nhau, gợi ý dùng con số nào cho mục đích nào; mức Medium. (Chạy ở chế độ thử bẫy vì hai báo cáo là SYNTHETIC.)",
                         f"nêu cả 700 và 490={both}; mâu thuẫn nhãn 'definition'={len(defin)}; có gợi ý sử dụng={usage}; mức tổng thể thử bẫy={level}; "
                         f"memo CHẾ ĐỘ THẬT: mức={memo2r['overall']['level'] if memo2r else '?'}.",
                         "Với tài liệu thật, Q2 không có claim hợp lệ từ nguồn doanh thu (hạn chế P2).")
        R["D3"] = result("Pass" if defin else "Fail", "Hai định nghĩa khác nhau bị phát hiện và giải thích", f"{len(defin)} mâu thuẫn nhãn definition")
    else:
        R["T2"] = result("Fail", "xem spec", "Không có memo")
        R["D3"] = result("Fail", "", "Không có dữ liệu")
    # T3 + D2
    syn_pr = ("SYN02", "SYN03", "SYN04")
    found = {}
    for key in ("Q1", "A"):
        for c in all_claims(load(rd, key, "p3.json")):
            if c["source_id"] in syn_pr:
                found.setdefault(c["source_id"], []).append(c)
    if len(found) < 2:
        R["T3"] = result(NOT_TESTABLE, "3 bài trích một thông cáo tính là 1 nguồn độc lập; bài PR hạng C/D không nâng mức chắc chắn.",
                         f"Chỉ {len(found)}/3 bài (SYN02-04) tạo ra claim hợp lệ ({sorted(found)}), nên chưa thể kiểm tra gộp nguồn đầu-cuối.")
        R["D2"] = result(NOT_TESTABLE, "", f"{len(found)}/3 bài có claim")
    else:
        from app import dedupe
        n_ind = dedupe.independent_count(list(found))
        grades = {c["grade"] for cs in found.values() for c in cs}
        ok = n_ind == 1 and grades <= {"C", "D"}
        R["T3"] = result("Pass" if ok else "Fail", "3 bài trích một thông cáo tính là 1 nguồn độc lập; bài PR hạng C/D không nâng mức chắc chắn.",
                         f"{len(found)} bài có claim, số nguồn độc lập={n_ind}, hạng={sorted(grades)}")
        R["D2"] = result("Pass" if ok else "Fail", "", f"độc lập={n_ind}")
    # T4 + D1
    syn01 = [c for c in all_claims(q2) if c["source_id"] == "SYN01"]
    if not syn01:
        R["T4"] = result(NOT_TESTABLE, "Số liệu hết hạn mất điểm tươi, không làm bằng chứng chính, memo nêu ngày dữ liệu.", "Không có claim từ SYN01 trong lần chạy này.")
        R["D1"] = result(NOT_TESTABLE, "", "")
    else:
        ids = {c["claim_id"] for c in syn01}
        cited = any(i in ids for s in memo2t["subs"] for p in s["points"] for i in p["claim_ids"])
        fresh0 = all(c["grade_detail"]["components"]["freshness"] == 0 for c in syn01)
        dated = "dữ liệu 2021" in memo_text(memo2t) or "(C-" in memo_text(memo2t)
        ok = fresh0 and not cited
        R["T4"] = result("Pass" if ok else "Fail", "Số liệu hết hạn mất điểm tươi, không dùng làm bằng chứng chính, memo nêu ngày dữ liệu.",
                         f"điểm tươi=0: {fresh0}; hạng={sorted({c['grade'] for c in syn01})}; được trích trong kết luận: {cited}; memo nêu ngày dữ liệu: {dated}")
        R["D1"] = result("Pass" if ok else "Fail", "", "")
    # T5
    memo4 = [load(rd, "Q4", "memo_real.json"), load(rd, "Q4", "memo_test.json")]
    if all(memo4):
        refused = all(s["refused_text"] for m in memo4 for s in m["subs"])
        digits = any(re.search(r"\d", p["text"]) for m in memo4 for s in m["subs"] for p in s["points"])
        nei = all("Chưa đủ căn cứ" in m["markdown"] for m in memo4)
        steps = all(m["next_steps"] for m in memo4)
        ok = refused and not digits and nei and steps
        R["T5"] = result("Pass" if ok else "Fail", "Trả lời 'Chưa đủ căn cứ', không đưa con số, gợi ý nơi lấy dữ liệu.",
                         f"mọi câu hỏi con bị từ chối={refused}; có số trong kết luận={digits}; memo ghi 'Chưa đủ căn cứ'={nei}; có bước xác minh tiếp theo={steps}",
                         "Gợi ý nguồn dữ liệu hiện chỉ là câu mẫu 'Bổ sung nguồn hạng A/B', chưa nêu cụ thể (ví dụ dashboard nội bộ).")
    else:
        R["T5"] = result("Fail", "xem spec", "Không có memo")
    # T6
    amb = load(rd, "AMB", "brief.json")
    if amb:
        b = amb["brief"]
        ok = b["needs_clarification"] and 1 <= len(b["clarifying_questions"]) <= 3 and not b["sub_questions"]
        R["T6"] = result("Pass" if ok else "Fail", "Hỏi lại tối đa 3 câu về quyết định, phạm vi, khung thời gian thay vì viết báo cáo chung chung.",
                         f"needs_clarification={b['needs_clarification']}; số câu hỏi làm rõ={len(b['clarifying_questions'])}; số câu hỏi con={len(b['sub_questions'])}; câu hỏi: {b['clarifying_questions']}")
    # T7
    t7 = load(rd, "T7", "claims.json")
    if t7:
        cl = t7["claims"]
        valid = [c for c in cl if c["valid"]]
        R["T7"] = result("CẦN CHẤM TAY", "Trích đúng số kèm đơn vị; nếu không chắc thì gắn cờ, không suy diễn.",
                         f"{len(cl)} claim từ PDF S005/S006, hợp lệ theo verify={len(valid)}, bị loại={len(cl) - len(valid)}; evaluator phải đối chiếu từng claim với bảng gốc (đơn vị, đúng hàng/cột).",
                         "Verify bằng code chỉ biết số có trong đoạn, không biết số đó thuộc hàng/cột nào.")
    # T8 + metrics
    R["T8"] = score_baseline(rd)
    # D4
    syn78 = [c for c in all_claims(load(rd, "B", "p3.json")) if c["source_id"] in ("SYN07", "SYN08")]
    srcs = {c["source_id"] for c in syn78}
    if srcs != {"SYN07", "SYN08"}:
        R["D4"] = result(NOT_TESTABLE, "Hai nguồn mâu thuẫn thật: phát hiện, không giải thích được, mức chắc chắn Low.", f"Chỉ có claim từ {sorted(srcs)}")
    else:
        confl = [x for s in load(rd, "B", "p3.json")["subs"] for x in s["conflicts"]
                 if {x["claim_a"], x["claim_b"]} <= {c["claim_id"] for c in syn78}]
        levels = [s["verdict_with_synthetic"]["level"] for s in load(rd, "B", "p3.json")["subs"] if any(c["source_id"] in srcs for c in s["claims"])]
        unexpl = [x for x in confl if x["status"] == "unexplained"]
        ok = bool(confl) and "Low" in levels
        R["D4"] = result("Pass" if ok else "Fail", "Mâu thuẫn thật được phát hiện, không giải thích được, mức Low.",
                         f"mâu thuẫn={len(confl)} (chưa giải thích={len(unexpl)}); mức các câu hỏi con liên quan={levels}; nhãn nguyên nhân={[x['cause'] for x in confl]}")
    # D5
    used = []
    retrieved = 0
    for key in PRIMARY + ["A", "B"]:
        p2 = load(rd, key, "p2.json")
        for s in (p2 or {}).get("subs", []):
            retrieved += sum(1 for r in s["retrieved"] if r["source_id"] == "SYN09")
            used += [c for c in s["claims"] if c["valid"] and c["source_id"] == "SYN09"]
    if retrieved == 0:
        R["D5"] = result(NOT_TESTABLE, "Tài liệu không liên quan không lọt vào kết luận.", "SYN09 không bao giờ được truy xuất, nên bẫy không được chạm tới.")
    else:
        R["D5"] = result("Pass" if not used else "Fail", "Tài liệu không liên quan không lọt vào kết luận.", f"được truy xuất {retrieved} lần, claim hợp lệ={len(used)}")
    R["metrics"] = round_metrics(rd)
    return R


NUM_FIG = re.compile(r"\d[\d.,]*\s*(?:%|tỷ|triệu|nghìn|USD|đô|VND|đồng|lượt|phút)", re.I)


def corpus_numbers() -> set[str]:
    from app import db
    from app.verify import numbers_in
    with db.connect() as conn:
        texts = [r[0] for r in conn.execute("SELECT text FROM chunks")]
    pool = set()
    for t in texts:
        for s in numbers_in(t):
            pool |= s
    return pool


def figures(text: str):
    from app.verify import numbers_in
    return [numbers_in(m.group(0))[0] for m in NUM_FIG.finditer(text) if numbers_in(m.group(0))]


def score_baseline(rd: Path) -> dict:
    pool = corpus_numbers()
    rows = []
    for q in PRIMARY:
        b, m = load(rd, q, "baseline.json"), load(rd, q, "memo_real.json")
        if not b or not m:
            continue
        figs = figures(b["answer"])
        unsup = [f for f in figs if not (f & pool)]
        urls = re.findall(r"https?://\S+", b["answer"])
        refusal = bool(re.search(r"không có (dữ liệu|thông tin|số liệu)|không thể (cung cấp|biết)|chưa đủ căn cứ|không công bố", b["answer"].lower()))
        mpts = [p for s in m["subs"] for p in s["points"]]
        mfigs = [f for p in mpts for f in figures(p["text"])]
        cited_pool = set()
        mclaims = {c for p in mpts for c in p["claim_ids"]}
        # a memo figure is supported when it appears in the corpus pool AND the point has a claim id
        munsup = [f for p in mpts if not p["claim_ids"] for f in figures(p["text"])]
        rows.append({"q": q, "baseline_figures": len(figs), "baseline_unsupported_by_corpus": len(unsup),
                     "baseline_urls": len(urls), "baseline_refuses": refusal,
                     "mvp_figures": len(mfigs), "mvp_unsupported": len(munsup),
                     "mvp_fact_points": sum(p["is_fact"] for p in mpts),
                     "mvp_refused_subquestions": sum(1 for s in m["subs"] if s["refused_text"]),
                     "mvp_all_refused": all(s["refused_text"] for s in m["subs"])})
    q4 = next((r for r in rows if r["q"] == "Q4"), None)
    ok = bool(rows) and sum(r["mvp_unsupported"] for r in rows) < sum(r["baseline_unsupported_by_corpus"] for r in rows) and bool(q4 and q4["mvp_all_refused"])
    return result("Pass" if ok else "Fail",
                  "So sánh số câu có trích dẫn kiểm chứng được, số liệu không có căn cứ, và Q4 có bị từ chối đúng không (MVP rõ ràng ít số liệu không căn cứ hơn baseline).",
                  json.dumps(rows, ensure_ascii=False),
                  "Baseline không có tài liệu nên 'không có căn cứ' được đo bằng việc con số có xuất hiện trong kho tài liệu hay không: số đúng ngoài đời nhưng không có trong kho vẫn bị tính là không có căn cứ.")


def round_metrics(rd: Path) -> dict:
    tot = rej = retries0 = calls = 0
    facts = supported = demoted = 0
    times = []
    for key in PRIMARY + ["A", "B"]:
        p2 = load(rd, key, "p2.json")
        if not p2:
            continue
        calls += 1
        retries0 += p2["brief_retries"] == 0
        for s in p2["subs"]:
            calls += s["extract_retries"] is not None
            retries0 += s["extract_retries"] == 0
            for c in s["claims"]:
                tot += 1
                rej += not c["valid"]
        t = p2.get("timing", {})
        p3 = load(rd, key, "p3.json")
        mt = load(rd, key, "memo_real.json")
        times.append({"q": key, "brief_s": t.get("brief_s"), "extract_verify_s": t.get("extract_verify_s"),
                      "grade_conflict_s": (p3 or {}).get("timing", {}).get("grade_conflict_s"),
                      "memo_s": (mt or {}).get("memo_s")})
        for mode in ("memo_real", "memo_test"):
            m = load(rd, key, mode + ".json")
            if m:
                facts += m["stats"]["llm_fact"]
                supported += m["stats"]["llm_fact_supported"]
                demoted += m["stats"]["demoted"]
    return {"claims_total": tot, "claims_rejected_by_verify": rej,
            "share_rejected": round(rej / tot, 3) if tot else None,
            "json_calls": calls, "json_ok_without_retry": retries0,
            "memo_fact_sentences_from_llm": facts, "memo_fact_sentences_supported_before_repair": supported,
            "memo_fact_sentences_demoted_by_code": demoted,
            "share_supported_before_repair": round(supported / facts, 3) if facts else None,
            "timing_per_question": times}


def stability(r1: Path, r2: Path) -> dict:
    out = {}
    for key in PRIMARY + ["A", "B"]:
        a, b = load(r1, key, "p3.json"), load(r2, key, "p3.json")
        if not a or not b:
            continue
        va = [(s["verdict_real_only"]["level"], s["verdict_with_synthetic"]["level"]) for s in a["subs"]]
        vb = [(s["verdict_real_only"]["level"], s["verdict_with_synthetic"]["level"]) for s in b["subs"]]
        ma, mb = load(r1, key, "memo_real.json"), load(r2, key, "memo_real.json")
        out[key] = {"subq_count": [len(a["subs"]), len(b["subs"])],
                    "valid_claims": [len(all_claims(a)), len(all_claims(b))],
                    "same_verdicts_per_subquestion": va == vb,
                    "overall_real": [ma["overall"]["level"] if ma else None, mb["overall"]["level"] if mb else None]}
    return out


def score(rounds: list[str]):
    res = {"rounds": {}}
    dirs = [Path(r) if Path(r).is_absolute() else ROOT / r for r in rounds]
    for d in dirs:
        res["rounds"][d.name] = score_round(d)
    if len(dirs) == 2:
        res["stability"] = stability(*dirs)
    outp = ROOT / "runs" / "p4" / "scores.json"
    save(outp, res)
    for name, R in res["rounds"].items():
        print("==", name)
        for k in ("T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "D1", "D2", "D3", "D4", "D5"):
            if k in R:
                print(f"  {k}: {R[k]['status']}")
    print("saved", outp)


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) >= 2 and a[0] == "--run":
        run_round(int(a[1]))
    elif len(a) >= 2 and a[0] == "--score":
        score(a[1:])
    else:
        print(__doc__)
