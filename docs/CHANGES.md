# Changes from the original plan

- 2026-10-13 (P0): Added `.venv/` to `.gitignore` and a `requirements.txt` (not in the plan) to keep dependencies reproducible on Windows.
- 2026-10-13 (P1): Real corpus is 18 documents (user chose 16-18 instead of the agent's 12-16) to fit the 20-30 total in spec 05.
- 2026-10-13 (P1): Wrote 12 SYNTHETIC files instead of the 8 announced: the traps "3 reposts" (3 files), "2 definitions" (2) and "2 conflicts" (2) need multiple files each, so 5 trap scenarios became 9 files, plus 3 internal. Total 30 documents.
- 2026-10-13 (P1): Q5 competitor Y fixed as Liên Quân Mobile (chosen by the collector; spec did not name Y). Q5 coverage is thin and kept that way by user decision.
- 2026-10-13 (P2): Postgres host port changed 5432 -> 5434 because another local PostgreSQL occupies 5432.
- 2026-10-13 (P2): Retrieval = BM25 keyword only, from FR2 measurement (14/14); bge-m3/pgvector not used yet.
- 2026-10-13 (P2): Run 1 -> run 2 prompt change. Brief no longer adds vendor names/years absent from the question; extractor now extracts all relevant claims and records scope differences instead of dropping them. Reason: Q2 returned 0 claims in run 1. Verifier rules and expectations were NOT loosened.
- 2026-10-13 (P2): Added dependencies pypdf, beautifulsoup4, lxml, psycopg, rank-bm25, fonttools.
- 2026-10-13 (P2): LLM_MODEL switched to the `:free` slug because paid credits reached 0 (user choice). Data sent stays public + SYNTHETIC only. P0 latency/JSON-schema measurements re-run on `:free`.
- 2026-10-13 (P2): Retrieval query = Vietnamese + English keywords + original question, top 8, max 2 chunks per document. Reason: cross-language miss and crowding by short SYNTHETIC files. FR2 gold set is not re-measured with this setting.
- 2026-10-13 (P2): verify.py compares with whitespace removed (PDF text has stray spaces); number and name rules unchanged.
