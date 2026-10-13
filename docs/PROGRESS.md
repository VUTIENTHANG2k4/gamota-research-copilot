# Progress

## P0 - Init and model check (2026-10-13)

**Done**
- Scaffold: `requirements.txt`, `docker-compose.yml` (pgvector/pgvector:pg16), `app/llm.py` (only model caller, temp 0, saves every response to `runs/`), `scripts/p0_check.py`, `.venv/` (gitignored).
- `.env` exists with a key set (value never printed).

**Measured (3 checks, 1 run each, tiny samples)**
| Check | Result |
|---|---|
| Plain call, Vietnamese prompt | OK, 1.74 s, answer "Hà Nội." (reasoning tokens used: 17) |
| `response_format` json_schema strict | OK, 2.39 s, output validated by Pydantic; Vietnamese number "1,2 tỷ USD" -> value 1.2 |
| Prompt-only JSON + Pydantic parse | 3/3 valid without retry |
| Cost | about 6.7e-05 USD for the plain call |

**Limitations observed / not checked**
- Docker verified after user started Docker Desktop: `docker compose up -d` OK, pgvector 0.8.7 enabled, vector distance query works. Container left running (later moved to host port 5434).
- Sample is only 3 calls on a trivial passage: it does not show schema reliability on long passages, many claims, or hard Vietnamese text. Re-measure in P2.
- Model is the paid slug (no `:free`); data-privacy rule still applies (public + SYNTHETIC only).
- Model returns reasoning tokens; `max_tokens` must leave room (2000 used) or content may be cut/empty.
- Windows console needs `PYTHONUTF8=1` to print Vietnamese.
- Latency measured from one location, 1 sample each.

**Open defects**: none known for P0. Embedding model and keyword-vs-vector choice are still undecided (P2).
