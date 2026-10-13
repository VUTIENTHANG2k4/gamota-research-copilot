# Architecture and tech stack

Part of the gamota-research-copilot spec; see `docs/SPEC.md` for the index.

## 9. MVP architecture and tech stack

| Layer | Choice | Reason |
|---|---|---|
| UI | Next.js + Tailwind, fully in Vietnamese | 4 screens (brief, claim store, reconciliation, memo) plus a test-results page and a Known limitations page; built last (P5) |
| Backend | Python (FastAPI) | Close to the AI ecosystem |
| LLM | NVIDIA Nemotron 3 Ultra via OpenRouter (nvidia/nemotron-3-ultra-550b-a55b), temperature 0, JSON-schema output if supported | Stable, easy to verify |
| Retrieval | PostgreSQL + pgvector, combined with keyword search | One database for claims and vectors |
| Document processing | PDF/HTML reader, chunking that keeps page numbers | Needed to point back to the original passage |
| Document export | Word/PDF generation library | Memo export |
| Testing | pytest + a script that runs the scenario suite | Re-run after every prompt or model change |

**Four quality guardrails, the core of the MVP:**

1. The LLM may only extract claims from retrieved passages, returned in a fixed schema.
2. **Code verifies** that the claim's numbers and entities appear in the source passage; otherwise the claim is rejected.
3. The memo may only use approved claims, written with claim IDs; a sentence without an ID is labelled "inference" or deleted.
4. Grading and confidence are computed by **rules in code**; the LLM never scores itself.

**Model and data:** every LLM call goes through a single file `app/llm.py`, and the model ID is set by the environment variable `LLM_MODEL`. The free Nemotron endpoint logs sessions to improve NVIDIA's products, so send only public and SYNTHETIC documents. It is not verified how well OpenRouter supports forcing a JSON schema for this model; P0 checks it, and the fallback is to parse JSON, validate with Pydantic and retry at most 2 times. Embeddings run locally or are skipped in favour of keyword search, decided in P2 from measurements. The code guardrails do not depend on the model.
