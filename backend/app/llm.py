"""The only module that calls the model (via OpenRouter).

Temperature 0, optional JSON-schema output, every response saved under runs/.
"""
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv()

RUNS_DIR = Path(__file__).resolve().parent.parent / "runs"


_KEY_POS = 0  # index of the key currently in use; advanced when a key hits its daily free limit


def _keys() -> list[str]:
    """OPENROUTER_API_KEY first, then any comma-separated OPENROUTER_API_KEYS (extra accounts)."""
    extra = [k.strip() for k in os.getenv("OPENROUTER_API_KEYS", "").split(",") if k.strip()]
    return [os.environ["OPENROUTER_API_KEY"]] + [k for k in extra if k != os.environ["OPENROUTER_API_KEY"]]


def _cache_path(body: dict) -> Path:
    h = hashlib.sha256(json.dumps(body, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:24]
    return RUNS_DIR / "cache" / f"{h}.json"


def _config() -> dict:
    global _KEY_POS
    keys = _keys()
    return {
        "key": keys[min(_KEY_POS, len(keys) - 1)],
        "base_url": os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        "model": os.getenv("LLM_MODEL", "nvidia/nemotron-3-ultra-550b-a55b"),
        "temperature": float(os.getenv("LLM_TEMPERATURE", "0")),
    }


def chat(messages: list[dict], schema: dict | None = None, tag: str = "call",
         max_tokens: int = 1024, timeout: float = 300.0) -> dict:
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
    cp = _cache_path(body)
    if cp.exists():  # identical request already answered: reuse it (temperature 0, saves free-tier quota)
        payload = json.loads(cp.read_text(encoding="utf-8"))
        msg = payload["choices"][0]["message"]
        return {"content": msg.get("content"), "usage": payload.get("usage"), "latency_s": 0.0,
                "raw": payload, "run_file": str(cp), "cached": True}
    t0 = time.time()
    status, payload = None, None
    try:
        global _KEY_POS
        waits = [0, 15, 45, 90]  # free endpoint may rate-limit: retry 429/5xx with backoff
        while waits:
            time.sleep(waits.pop(0))
            try:
                r = httpx.post(
                    f"{cfg['base_url']}/chat/completions",
                    headers={"Authorization": f"Bearer {cfg['key']}"},
                    json=body, timeout=timeout,
                )
            except httpx.TimeoutException:
                status, payload = 504, {"error": {"message": "client timeout", "code": 504}}
                if waits:
                    continue
                break
            status = r.status_code
            payload = r.json()
            if status == 200 and "error" in payload and "choices" not in payload:
                status = int(payload["error"].get("code") or 502)  # upstream error delivered inside an HTTP 200
            if status == 429 and "free-models-per-day" in json.dumps(payload) and _KEY_POS < len(_keys()) - 1:
                _KEY_POS += 1  # this key's daily free quota is used up: switch to the next configured key
                cfg = _config()
                waits.insert(0, 0)
                continue
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
    cp.parent.mkdir(parents=True, exist_ok=True)
    cp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    msg = payload["choices"][0]["message"]
    return {"content": msg.get("content"), "usage": payload.get("usage"),
            "latency_s": round(latency, 2), "raw": payload, "run_file": str(run_file)}
