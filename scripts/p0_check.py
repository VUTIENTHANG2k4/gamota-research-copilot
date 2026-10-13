"""P0 checks: plain call, Vietnamese, JSON schema, fallback parse. Prints a summary."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from pydantic import BaseModel, ValidationError

from app import llm


class Claim(BaseModel):
    text: str
    value: float
    unit: str


SCHEMA = {
    "type": "object",
    "properties": {"text": {"type": "string"}, "value": {"type": "number"}, "unit": {"type": "string"}},
    "required": ["text", "value", "unit"], "additionalProperties": False,
}
PASSAGE = "Theo báo cáo, doanh thu game di động Việt Nam năm 2023 đạt khoảng 1,2 tỷ USD."


def step(name, fn):
    try:
        out = fn()
        print(f"[OK ] {name}: {out}")
    except Exception as e:
        print(f"[FAIL] {name}: {e}")


def plain():
    r = llm.chat([{"role": "user", "content": "Trả lời ngắn bằng tiếng Việt: thủ đô của Việt Nam là gì?"}],
                 tag="p0_plain", max_tokens=2000)
    return f"{r['latency_s']}s usage={r['usage']} content={r['content']!r}"


def schema_mode():
    r = llm.chat([{"role": "user", "content": f"Trích claim số liệu từ đoạn sau.\n{PASSAGE}"}],
                 schema=SCHEMA, tag="p0_schema", max_tokens=2000)
    c = Claim.model_validate_json(r["content"])
    return f"{r['latency_s']}s valid={c}"


def fallback():
    ok = 0
    for i in range(3):
        r = llm.chat([{"role": "user", "content":
                       f"Chỉ trả về JSON với khóa text,value,unit (không giải thích).\n{PASSAGE}"}],
                     tag="p0_fallback", max_tokens=2000)
        try:
            Claim.model_validate_json((r["content"] or "").strip().removeprefix("```json").removesuffix("```").strip())
            ok += 1
        except (ValidationError, ValueError):
            pass
    return f"{ok}/3 parsed+validated without retry"


for n, f in [("plain call (vi)", plain), ("json_schema strict", schema_mode), ("prompt-only JSON fallback", fallback)]:
    step(n, f)
