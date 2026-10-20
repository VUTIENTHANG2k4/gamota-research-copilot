"""Mission 3, proof layer A (docs/spec/09-mission3.md section 6): run the M3 decision code on the saved M2 model
outputs of runs/p4/round_1, with NO model call. Conflict cause labels and memo sentences are taken from the
saved M2 responses; any difference from M2 therefore comes from code only.

    cd backend && python scripts/m3_layer_a.py      -> runs/m3/layer_a/<key>/{p3,memo_real,memo_test}.json
"""
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import llm, memo, pipeline  # noqa: E402
from app.memo import MemoOut  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "runs" / "p4" / "round_1"
OUT = ROOT / "runs" / "m3" / "layer_a"
KEYS = ["Q1", "Q2", "Q3", "Q4", "Q5", "A", "B"]
MISSES = {"conflict_labels": 0, "memo": 0}


def no_model(*a, **k):
    raise RuntimeError("layer A must not call the model")


def saved_memo(key: str, mode: str):
    files = sorted((ROOT / "runs").glob(f"*_r1_{key}_{mode}_memo_a*.json"))
    for f in reversed(files):
        d = json.load(open(f, encoding="utf-8"))
        if d.get("http_status") == 200:
            text = d["response"]["choices"][0]["message"]["content"].strip()
            text = text.removeprefix("```json").removesuffix("```").strip()
            try:
                return MemoOut.model_validate_json(text)
            except ValueError:
                continue
    return None


def main():
    llm.chat = no_model  # hard guarantee: no request leaves this process
    for key in KEYS:
        d = SRC / key
        p2 = json.load(open(d / "p2.json", encoding="utf-8"))
        p3_m2 = json.load(open(d / "p3.json", encoding="utf-8"))
        saved = {frozenset((x["claim_a"], x["claim_b"])): x for s in p3_m2["subs"] for x in s["conflicts"]}

        def classify(a, b, tag):
            x = saved.get(frozenset((a["claim_id"], b["claim_id"])))
            if x is None:
                MISSES["conflict_labels"] += 1
                return {"claim_a": a["claim_id"], "claim_b": b["claim_id"], "cause": "unknown", "status": "unexplained",
                        "explanation": "Không có nhãn đã lưu từ lần chạy M2 (lớp A không gọi model).",
                        "usage_suggestion": "", "llm_cause": None}
            return {k: x[k] for k in ("claim_a", "claim_b", "cause", "status", "explanation", "usage_suggestion")
                    if k in x}

        pipeline.classify = classify
        p3 = pipeline.grade_and_decide(p2, f"layerA_{key}")
        out = OUT / key
        out.mkdir(parents=True, exist_ok=True)
        (out / "p3.json").write_text(json.dumps(p3, ensure_ascii=False, indent=2), encoding="utf-8")
        for mode in ("real", "test"):
            pts = saved_memo(key, mode)

            def call_model(cls, msgs, tag, max_tokens=6000, _pts=pts):
                if _pts is None:
                    MISSES["memo"] += 1
                    return MemoOut(points=[]), 0
                return _pts, 0

            memo.call_model = call_model
            m = memo.build(p3, mode, f"layerA_{key}_{mode}")
            (out / f"memo_{mode}.json").write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding="utf-8")
        for f in ("baseline.json",):
            if (d / f).exists():
                shutil.copy(d / f, out / f)
        print(key, "done")
    for extra in ("AMB", "T7"):  # unchanged by M3 code; copied so the M2 scorer can run on this folder
        shutil.copytree(SRC / extra, OUT / extra, dirs_exist_ok=True)
    print("missing saved labels:", MISSES)


if __name__ == "__main__":
    main()
