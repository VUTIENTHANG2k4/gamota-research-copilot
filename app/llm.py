"""The only module that calls the model (via OpenRouter).

Temperature 0, optional JSON-schema output, every response saved under runs/.
"""
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv()

RUNS_DIR = Path(__file__).resolve().parent.parent / "runs"


def _config() -> dict:
    return {
        "key": os.environ["OPENROUTER_API_KEY"],
        "base_url": os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        "model": os.getenv("LLM_MODEL", "nvidia/nemotron-3-ultra-550b-a55b"),
        "temperature": float(os.getenv("LLM_TEMPERATURE", "0")),
    }


def chat(messages: list[dict], schema: dict | None = None, tag: str = "call",
         max_tokens: int = 1024, timeout: float = 120.0) -> dict:
    """Call the model once. Returns {content, usage, latency_s, raw, run_file}.

    `schema` is a JSON schema dict; when given it is sent as response_format.
    Errors are saved too, never swallowed.
    """
    cfg = _config()
    body = {
        "model": cfg["model"],
        "messages": messages,
        "temperature": cfg["temperature"],
        "max_tokens": max_tokens,
    }
    if schema is not None:
        body["response_format"] = {
            "type": "json_schema",
            "json_schema": {"name": tag, "strict": True, "schema": schema},
        }
    t0 = time.time()
    status, payload = None, None
    try:
        for wait in (0, 10, 30):  # free endpoint may rate-limit: retry 429/5xx with backoff
            time.sleep(wait)
            r = httpx.post(
                f"{cfg['base_url']}/chat/completions",
                headers={"Authorization": f"Bearer {cfg['key']}"},
                json=body, timeout=timeout,
            )
            status = r.status_code
            payload = r.json()
            if status not in (429, 500, 502, 503, 504):
                break
    except Exception as e:  # saved below, then re-raised
        payload = {"exception": repr(e)}
        raise
    finally:
        latency = time.time() - t0
        RUNS_DIR.mkdir(exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
        run_file = RUNS_DIR / f"{stamp}_{tag}.json"
        run_file.write_text(json.dumps(
            {"request": body, "http_status": status, "latency_s": round(latency, 2),
             "response": payload}, ensure_ascii=False, indent=2), encoding="utf-8")
    if status != 200:
        raise RuntimeError(f"OpenRouter HTTP {status}: {json.dumps(payload)[:500]} (see {run_file})")
    msg = payload["choices"][0]["message"]
    return {"content": msg.get("content"), "usage": payload.get("usage"),
            "latency_s": round(latency, 2), "raw": payload, "run_file": str(run_file)}
