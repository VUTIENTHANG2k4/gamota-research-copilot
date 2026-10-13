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

## P1 - Corpus (2026-10-13)

**Done**
- `source-collector` saved 18 real public documents (`corpus/raw/S001-S018`): group A 6, B 7, C 5. `corpus/sources.csv` hashes all re-verified by the main agent (0 mismatches). Q2 figures (825M, 575M, 315M) spot-checked against the saved files.
- Main agent wrote 12 SYNTHETIC files (`corpus/synthetic/SYN01-SYN12`, `is_synthetic=true`, header line `SYNTHETIC`): D1 stale figure (1), D2 three reposts of one press release (3), D3 two definitions (2), D4 two genuine conflicts (2), D5 unrelated (1), E internal simulated (3, no D7 retention on purpose for Q4).
- Total 30 documents (18 real + 12 synthetic), top of the 20-30 range.

**Known gaps (not hidden)**
- Q5: only 2 press articles about Liên Quân Mobile (S012, S013); no raw player reviews (app stores need JS, social needs login). S013 is about esports format, not product complaints. Q5 is expected to be weak.
- Q3: full text of the draft amendment and of Nghị định 174/2026/NĐ-CP not found; only press coverage (S009-S011). The 60 min/game, 180 min/day rule was NOT checked inside the S001-S003 PDFs.
- PocketGamer.biz (403): the 825M claim comes from Gamota's own release (S014), which is also a conflict of interest.
- Metadata unsure: publish dates empty for S004-S006; S005/S006 are mirrors on investgame.net; S007/S008 cite GameGeek without ID so `cites_origin` is empty.
- sources.csv `source_type` uses the collector's labels (legal_primary, industry_report, press, press_release, vendor_blog, press_repost, internal); mapping to the spec's score table is for P3 `grade.py`.
- Real sources were read only by the collector for metadata; contents of PDFs not yet parsed (P2).

**Open defects**: S001-S003 text layer unverified; S017 is 8.6 MB HTML.
