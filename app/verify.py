"""Guardrail 1 (code, not LLM): a claim is valid only if its passage is a verbatim quote from a
retrieved chunk and every number and proper name in the claim appears in that passage."""
import re

from app.retrieve import strip_accents

NUM = re.compile(r"\d[\d.,]*\d|\d")


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", strip_accents(s).lower()).strip()


def number_forms(token: str) -> set[str]:
    """Canonical string forms a numeric token could mean (decimal vs thousands separator)."""
    t = token.strip(".,")
    forms = {re.sub(r"[.,]", "", t)}  # 1.200 / 1,200 -> 1200
    if re.fullmatch(r"\d+[.,]\d+", t):
        forms.add(t.replace(",", ".").rstrip("0").rstrip(".") or "0")  # 1,2 -> 1.2
    return forms


def numbers_in(text: str) -> list[set[str]]:
    return [number_forms(m) for m in NUM.findall(text)]


def entities_in(content: str) -> list[str]:
    """Capitalised words (not the first word) and ALLCAPS/mixed tokens such as USD, D7, GameGeek."""
    out = []
    for i, w in enumerate(re.findall(r"[^\W_]+(?:[-/][^\W_]+)*", content)):
        if i == 0 and not w.isupper():
            continue
        if w[0].isupper() and not w.isdigit() and len(w) > 1:
            out.append(w)
    return out


def verify_claim(claim: dict, chunks: list[dict]) -> dict:
    """Return {valid, reason, chunk_id}. `claim` has content, value, passage."""
    # Compare with ALL whitespace removed: the Official Gazette PDFs have stray spaces inside words
    # ("p hút"), and the model repairs them when quoting. Characters must still match exactly.
    passage = _norm(claim["passage"]).replace(" ", "")
    if len(passage) < 12:
        return {"valid": False, "reason": "passage too short", "chunk_id": None}
    chunk = next((c for c in chunks if passage in _norm(c["text"]).replace(" ", "")), None)
    if chunk is None:
        return {"valid": False, "reason": "passage is not a verbatim quote of any retrieved chunk",
                "chunk_id": None}
    p_nums = [f for s in numbers_in(claim["passage"]) for f in s]
    claim_text = claim["content"] + (f" {claim['value']:g}" if claim.get("value") is not None else "")
    for forms in numbers_in(claim_text):
        if not forms & set(p_nums):
            return {"valid": False, "reason": f"number {sorted(forms)} not in passage",
                    "chunk_id": chunk["chunk_id"]}
    p_flat = _norm(claim["passage"]).replace(" ", "")
    for e in entities_in(claim["content"]):
        if _norm(e).replace(" ", "") not in p_flat:
            return {"valid": False, "reason": f"entity '{e}' not in passage", "chunk_id": chunk["chunk_id"]}
    return {"valid": True, "reason": "ok", "chunk_id": chunk["chunk_id"]}
