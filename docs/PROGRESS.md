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

## P2 - ingest, retrieve, extract, verify (2026-10-13) - NOT COMPLETE: Q5 re-run blocked

**Built**: `app/ingest.py` (pypdf/bs4 -> 686 page-aware chunks in PostgreSQL, 30 sources), `app/retrieve.py` (BM25, accent-stripped unigram+bigram), `app/brief.py`, `app/extract.py`, `app/verify.py` (code guardrail 1), `app/jsonllm.py` (JSON schema + Pydantic, retry <= 2), `scripts/run_p2.py`, `scripts/eval_retrieval.py`, `tests/test_verify.py` (6 pass).

**Decision (from measurement): keyword search only for now.** FR2 on a 14-query gold set: 14/14 in top-5 (target 80%). Limits: the gold set is small and written by the main agent, expectations are lenient ("any of several documents"), and the short SYNTHETIC files tend to outrank real documents in BM25. bge-m3 NOT tried; pgvector unused. Revisit only if P3/P4 show retrieval misses.

**JSON schema**: `response_format` json_schema worked on every extract/brief call: 0 retries needed in 2 runs.

**Q1-Q5 results (2 runs; run 1 in `runs/p2_run1`, run 2 in `runs/p2`; run 2 prompts changed after run 1, see CHANGES)**
| Q | Run 1 claims (valid/rejected) | Run 2 claims (valid/rejected) |
|---|---|---|
| Q1 | 8 / 4 | 18 / 5 |
| Q2 | 0 / 0 (**failure**) | 3 / 4 |
| Q3 | 8 / 8 | 5 / 14 |
| Q4 | 0 / 0 | 0 / 0 |
| Q5 | 3 / 0 | not re-run: HTTP 402 from OpenRouter |

**Defects observed (not hidden)**
1. Run 1 Q2 returned 0 claims although the corpus has the answer: the brief invented vendor names and years in sub-questions (Appota, Niko Partners, data.ai, Sensor Tower, 2023/2024) and the extractor then returned empty. Prompts changed; Q2 now yields 3 valid claims, but only from SYN05/SYN06 (SYNTHETIC) and S008 (a download-count claim, not revenue). **No valid claim from the real revenue sources (S014 825M, S004 575M, S007 315M) was extracted in run 2.** Q2 does not yet meet "valid claims" for the real market.
2. Run-to-run instability: Q3 valid claims went 8 -> 5 between runs. Results are not stable even at temperature 0 after prompt edits.
3. The verifier rejects many claims correctly (number or name not in the passage; e.g. model added "Việt Nam", "Công ty Giả Lập Alpha", or decree numbers 147/174 that the passage did not contain). This is the guardrail working, but recall is low. 4-14 rejections per question.
4. Q3 (regulation): the 60 min / 180 min rule was not extracted as a valid claim in run 2 (not verified either way). Decree PDF text has extraction artifacts ("Truyề n thông", split characters) that break verbatim matching.
5. Q4: 0 claims, which is the expected "no data" behaviour at this stage; retrieval returned SYN10 (DAU/D1 only) and the model produced no D7 claim. Refusal logic itself is P3.
6. Q5: 3 valid claims in run 1 from S012/S013 (press articles). Only one run exists.
7. Infra: host port 5432 was taken by another local PostgreSQL, so our container uses 5434 (`.env`, `.env.example`, compose). OpenRouter returned HTTP 402 `in_flight_budget_exhausted` after ~64 calls (total cost recorded in `runs/`: about 0.11 USD); account credits need topping up to finish the Q5 re-run.

**Not checked**: precision of the valid claims (whether each really matches its source) is untested beyond the code check; no independent grading yet (P4). Duplicate/stale handling belongs to P3.

### P2 addendum (later the same day) - still NOT complete

- **Verifier change (whitespace only):** comparison now ignores ALL whitespace, because the Official Gazette PDF text has stray spaces inside words ("p hút", "trò c hơi") and the model repairs them when quoting. Characters, numbers and names must still match exactly. New test added (7 tests pass). This was found by locating the rule "không quá 60 phút đối với từng trò chơi ... không quá 180 phút một ngày" in S001 pages 74 and 85, which confirms the rule text exists in the corpus (previously "not checked").
- **Offline re-verification** (`scripts/reverify.py`, no LLM calls) of saved model outputs: run 2 valid claims Q1 18->19, Q2 3->6, Q3 5->10, Q4 0, Q5 3. Valid counts rose because more of the model's quotes matched, not because rules were loosened on numbers or names.
- **Run files are mixed, read carefully:** `runs/p2_run1` = run 1 (old prompts), `runs/p2_run2` = run 2 (new prompts), `runs/p2` = run 3 attempt: Q1, Q2 fresh; Q3 and Q4 are still run 2 (the run 3 call for Q3 failed with HTTP 402); Q5 is run 1.
- **Q2 still fails its purpose:** in run 3 the valid claims come from SYN05 (700M), SYN06 (490M), S017 (growth shares) and S008 (downloads). Not one claim from S014 (825M), S004 (575M) or S007 (315M). The LLM-written search queries do not retrieve those passages into the top 5, and short SYNTHETIC files plus S017 crowd them out. So the FR2 score of 14/14 does not transfer to the real pipeline: it used my hand-written queries, not the brief's.
- **Q3 still fails its purpose:** no valid claim states the 60 min / 180 min rule, although the rule is in S001.
- **Blocker:** OpenRouter credits are exhausted (HTTP 402 `in_flight_budget_exhausted`), so no further LLM runs are possible until credits are added. User chose to keep Q5 run 1 as is.

### P2 final state (after switching to the `:free` endpoint)

- **Model change:** `.env` `LLM_MODEL` is now `nvidia/nemotron-3-ultra-550b-a55b:free` (paid credit hit 0, confirmed via `/credits`: total_credits 0, usage 0.138 USD). Cost is 0. P0 checks re-run on `:free`: all 3 pass (2.1 s plain, 3.4 s json_schema, 3/3 fallback). Only public and SYNTHETIC documents are sent. `app/llm.py` now retries 429/5xx with 10 s and 30 s backoff.
- **Retrieval change:** query = brief Vietnamese keywords + English keywords (`search_query_en`, new) + the original question; top 8 chunks, max 2 per document. Reason: Q2 failed because the Vietnamese queries cannot match the English sources (S004, S014, S015).
- **Run layout:** `runs/p2/` = latest run. Q1, Q3, Q4, Q5 come from run 4 (Vietnamese queries only, per-source cap); Q2 comes from run 5 (bilingual queries). Older runs are in `runs/p2_archive/`.

| Q | claims | valid | rejected | valid claims come from |
|---|---|---|---|---|
| Q1 | 15 | 6 | 9 | SYN02, S006, SYN12 |
| Q2 | 14 | 9 | 5 | SYNTHETIC files + S017 (no S014/S007) |
| Q3 | 41 | 28 | 13 | S001, S002, S003 (primary decree), S009, S011 |
| Q4 | 6 | 2 | 4 | SYN10 only: claims that D7 is absent and D1 = 38% |
| Q5 | 5 | 3 | 2 | S012 |
JSON schema: 1 retry needed in 25+ extract calls.

**Result against the gate "Q1-Q5 produce valid claims": met for Q1, Q3, Q4, Q5; Q2 only partly.**
- Q3: the rule 60 min/game and 180 min/day is now extracted (S009 press; primary S001-S003 claims also valid).
- Q4: no D7 claim was invented; the valid claims state that D7 is missing. P3 must turn this into a refusal.
- Q5: only S012 yields claims (3), run once on this retrieval setting.
- **Q2 still unmet for the real market:** valid claims come from SYNTHETIC files and S017 (e.g. 177M USD for H1 2026, a repost of S016, a source with a Gamota conflict of interest). No valid claim from S014 (825M), S004 (575M) or S007 (315M). In the bilingual run S004 was retrieved but produced no valid claim; S014 and S007 were not retrieved because the short SYNTHETIC files and S017 fill the top 8. This is evidence that keyword search is not enough here; bge-m3 not tried.
- Run-to-run variance: 2 identical-prompt-family runs gave Q3 5 -> 28 valid claims after retrieval changes, so counts are not comparable across runs.
- Not checked: whether valid claims are semantically right (only the code check), and a repeat run of the final configuration for stability.

**P2 gate: approved by the user on 2026-10-13 with Q2 recorded as a known limitation** (no valid claim from the real revenue sources S014/S004/S007; keyword retrieval only; bge-m3 not tried). This must appear in the test report and on the Known limitations page.
