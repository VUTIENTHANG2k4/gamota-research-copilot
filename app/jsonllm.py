"""JSON-schema call with Pydantic validation; retry at most twice (spec fallback)."""
from pydantic import BaseModel, ValidationError

from app import llm


def call_model(model_cls: type[BaseModel], messages: list[dict], tag: str, max_tokens: int = 6000):
    schema = model_cls.model_json_schema()
    last = None
    for attempt in range(3):  # first try + at most 2 retries
        msgs = messages if attempt == 0 else messages + [
            {"role": "user", "content": f"Phản hồi trước không hợp lệ ({last}). Chỉ trả về JSON đúng schema."}]
        r = llm.chat(msgs, schema=schema, tag=f"{tag}_a{attempt}", max_tokens=max_tokens)
        try:
            text = (r["content"] or "").strip().removeprefix("```json").removesuffix("```").strip()
            return model_cls.model_validate_json(text), attempt
        except (ValidationError, ValueError) as e:
            last = str(e)[:200]
    raise RuntimeError(f"{tag}: invalid JSON after 3 attempts: {last}")
