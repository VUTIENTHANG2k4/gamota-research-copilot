"""Conflict detection. Code decides whether two claims conflict; the LLM only labels the cause,
and code re-checks that label against the claims' metadata (spec FR7)."""
import re
from itertools import combinations

from pydantic import BaseModel

from app import dedupe
from app.grade import parse_data_date
from app.jsonllm import call_model

CAUSES = ("definition", "year", "scope", "method", "legal_status", "unknown")
THRESHOLD = 0.10
STOP = set("của và là có trong cho các một những được theo năm đạt khoảng với tại từ về này đã sẽ".split())


class CauseOut(BaseModel):
    cause: str  # one of CAUSES
    explanation: str
    usage_suggestion: str


MONEY = re.compile(r"(\d[\d.,]*)\s*(tỷ|triệu|billion|million|bn|mn|[BM])?\s*(?:USD|đô la Mỹ|đô la|\$)", re.I)
PCT = re.compile(r"(\d[\d.,]*)\s*%")


def _num(t: str) -> float:
    t = t.strip(".,")
    if re.fullmatch(r"\d+[.,]\d{3}([.,]\d{3})*", t):  # thousands separators
        return float(re.sub(r"[.,]", "", t))
    return float(t.replace(",", "."))


def value_from_text(content: str) -> tuple[float, str] | None:
    """Fallback when the model left value/unit empty: first money amount or percentage in the text."""
    m = MONEY.search(content)
    if m:
        return _num(m.group(1)), f"{(m.group(2) or '')} USD".strip()
    m = PCT.search(content)
    return (_num(m.group(1)), "%") if m else None


def comparable_value(claim: dict) -> tuple[str, float] | None:
    """Return (kind, value) with currency scaled to USD, or None when not comparable."""
    v, u = claim.get("value"), (claim.get("unit") or "").lower()
    if v is None or not u:
        fb = value_from_text(claim["content"])
        if fb is None:
            return None
        v, u = fb[0], fb[1].lower()
    if "%" in u or "phần trăm" in u or "percent" in u:
        return "pct", float(v)
    if "usd" in u or "đô" in u or "$" in u:
        scale = 1e9 if ("tỷ" in u or "billion" in u) else 1e6 if ("triệu" in u or "million" in u or u.strip() in ("m usd", "usd m", "musd")) else 1
        return "usd", float(v) * scale
    return None


def _words(text: str) -> set[str]:
    return {w for w in re.findall(r"\w+", text.lower()) if w not in STOP and len(w) > 1}


def similar(a: dict, b: dict) -> float:
    wa, wb = _words(a["content"]), _words(b["content"])
    return len(wa & wb) / max(1, len(wa | wb))


def find_candidates(claims: list[dict], min_similarity: float = 0.25) -> list[tuple[dict, dict, float]]:
    """Pairs on the same topic, same unit kind, different origin, values differing by more than 10%."""
    out = []
    for a, b in combinations(claims, 2):
        ca, cb = comparable_value(a), comparable_value(b)
        if not ca or not cb or ca[0] != cb[0]:
            continue
        if dedupe.origin_of(a["source_id"]) == dedupe.origin_of(b["source_id"]):
            continue
        diff = abs(ca[1] - cb[1]) / max(abs(ca[1]), abs(cb[1]), 1e-9)
        if diff <= THRESHOLD or similar(a, b) < min_similarity:
            continue
        out.append((a, b, diff))
    return sorted(out, key=lambda t: -t[2])


def _year(c: dict):
    d = parse_data_date(c.get("data_date"), c.get("scope")) or parse_data_date(c.get("src_data_date"))
    return d.year if d else None


def recheck_cause(cause: str, a: dict, b: dict) -> tuple[str, str]:
    """Downgrade a cause label to 'unknown' when the claims' metadata does not support it."""
    if cause not in CAUSES:
        return "unknown", f"label '{cause}' not allowed"
    ya, yb = _year(a), _year(b)
    if cause == "year":
        if ya is None or yb is None or ya == yb:
            return "unknown", "labelled 'year' but data years are equal or unknown"
    if cause in ("definition", "scope", "method"):
        if re.sub(r"\W+", "", (a.get("scope") or "").lower()) == re.sub(r"\W+", "", (b.get("scope") or "").lower()):
            return "unknown", f"labelled '{cause}' but the scope fields are identical"
    if cause == "legal_status":
        if not any(re.search(r"dự thảo|dự kiến|đề xuất|draft|proposed", (c["content"] + c.get("scope", "")).lower())
                   for c in (a, b)):
            return "unknown", "labelled 'legal_status' but neither claim mentions a draft/proposal"
    return cause, "label supported by metadata"


def classify(a: dict, b: dict, tag: str) -> dict:
    ctx = "\n".join(
        f"Claim {n}: {c['content']}\n  phạm vi: {c.get('scope')}; năm dữ liệu: {c.get('data_date')}; "
        f"nguồn: {c['source_id']} ({c.get('source_type')}, phương pháp: {c.get('has_methodology')})\n  trích: {c['passage']}"
        for n, c in (("A", a), ("B", b)))
    msgs = [{"role": "system", "content":
             "Hai claim có số liệu khác nhau về cùng chủ đề. Xác định NGUYÊN NHÂN khác biệt, chọn đúng một trong: "
             "definition (định nghĩa đo lường khác), year (năm/kỳ khác), scope (phạm vi khác: thị trường, nền tảng, "
             "nhóm đối tượng), method (phương pháp thu thập khác), legal_status (dự thảo so với đang hiệu lực), "
             "unknown (không đủ căn cứ để giải thích). Chỉ dựa vào thông tin được cung cấp; nếu không chắc, chọn unknown. "
             "Đưa gợi ý dùng con số nào cho mục đích nào. Viết bằng tiếng Việt."},
            {"role": "user", "content": ctx}]
    out, _ = call_model(CauseOut, msgs, tag, max_tokens=3000)
    cause, check = recheck_cause(out.cause.strip().lower(), a, b)
    return {"claim_a": a["claim_id"], "claim_b": b["claim_id"], "llm_cause": out.cause, "cause": cause,
            "recheck": check, "explanation": out.explanation, "usage_suggestion": out.usage_suggestion,
            "status": "explained" if cause != "unknown" else "unexplained"}
