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

## P3 - grade, dedupe, conflict, confidence, refusal (2026-10-13)

**Built**: `app/grade.py` (score table of spec 03, components shown per source), `app/dedupe.py` + `corpus/origin_groups.csv`, `app/conflict.py` (code finds candidate pairs; LLM only labels the cause; code re-checks the label), `app/confidence.py` (hard rules + refusal), `scripts/run_p3.py` (writes `runs/p3/Q*.json`), `tests/test_p3.py`. 22 tests pass (no LLM). Run on `runs/p2` (Q1,Q3,Q4,Q5 = run 4; Q2 = run 5). LLM calls: 11 conflict labels on the `:free` model.

**Source grades** (30 sources; components in `runs/p3/*.json`): A = S001-S003 (primary decree text), SYN05-SYN08 (SYNTHETIC reports); B = S004-S006; C = S007-S010, S012, S013, SYN02-04, SYN09; D = S011, S014-S018, SYN01, SYN10-SYN12. The 825M source (S014) is D (press release, Gamota conflict of interest).

**Verdicts per sub-question** (headline = real documents only; second = test mode including SYNTHETIC):
| Q | real only | with SYNTHETIC |
|---|---|---|
| Q1 | 1 Medium, 4 "Chưa đủ căn cứ" | same |
| Q2 | 5 of 5 "Chưa đủ căn cứ" | 2 Medium, 3 "Chưa đủ căn cứ" |
| Q3 | 3 Medium, 2 "Chưa đủ căn cứ" | same |
| Q4 | 4 of 4 "Chưa đủ căn cứ" | same |
| Q5 | 5 of 5 "Chưa đủ căn cứ" | same |

**P3 gate: "traps caught, Q4 refused"**
- **Q4 refused: yes.** All 4 sub-questions give "Chưa đủ căn cứ" in both modes: the only claims come from SYN10, which is grade D (internal, unverified, simulated, no D7 figure).
- **D1 stale figure (SYN01): caught by grade** (freshness 0, grade D) and by a year-labelled conflict in unit tests. In the Q2 run its claim 0,6 tỷ USD (2021) appears with grade D.
- **D3 two definitions (SYN05 700M vs SYN06 490M): caught end to end.** Conflict found by code (30% apart), cause labelled `definition`, explained, confidence Medium instead of High.
- **D2 three reposts: dedupe works in unit tests only** (SYN02-04 and S007/S008 and S016-S018 each count as 1 origin). End to end only SYN02 produced claims, so it was not exercised in a full run.
- **D4 genuine conflict (SYN07 18% vs SYN08 9%): NOT exercised end to end.** No valid claim from SYN07/SYN08 in the current Q1 run (the claims were rejected by verify in earlier runs). The rule (unexplained conflict -> Low) is only covered by unit tests with hand-made inputs.
- **D5 unrelated document (SYN09): never retrieved**, so not exercised.

**Defects found (not hidden)**
1. The model left `value`/`unit` empty in most claims, so conflict detection first found 0 conflicts anywhere. Fixed with a code fallback that reads the first money amount or percentage from the claim text. This is a heuristic and can pick the wrong number in a long sentence.
2. Cause labels are only partly checked: SYN01 (2021) vs SYN06 (2025) was labelled `scope` instead of `year`, and code accepted it because the two scope strings differ.
3. `data_kind` guessed "reviews" from the question wording and downgraded the decree to grade B; fixed (primary legal text is always judged as legal). The keyword rule for kinds remains crude.
4. Q2 in real-only mode refuses all 5 sub-questions: the pipeline never extracted a valid claim from S004 (B) or S014 (D). This is the P2 limitation passing through; it is the honest output, but it means the product does not yet answer Q2 about the real market.
5. Q3 is capped at Medium because S001-S003 are one origin (same decree) and the press articles are grade C/D. That is the rule working as specified, not a measurement of correctness.
6. "Agree" for High confidence is weak: two A/B origins with non-numeric claims are assumed to agree when no numeric conflict is flagged. A claim being valid does not prove it answers the sub-question.
7. Not checked: whether conflict explanations are correct beyond the label re-check; no independent grading (P4). Thresholds (10% difference, 0.25 word-overlap) are initial proposals, not calibrated.

**P3 gate: approved by the user on 2026-10-13 with limitations recorded**: D4 (SYN07/08 genuine conflict) and D5 (SYN09 unrelated) not exercised end to end; D2 only partly. P4 must either design scenarios that run them through the real pipeline or report "not tested".

## P4 - memo, baseline, T1-T9 (2026-10-13) - IN PROGRESS

**Built**: `app/pipeline.py` (P2+P3 as one callable), `app/memo.py` (LLM writes points from A/B claims by claim ID; code relabels any fact point without a valid ID or with numbers not in the cited claims, labels draft-law claims, computes confidence/refusal, gaps, assumptions, next steps), `app/baseline.py` (direct LLM answer, no corpus), `tests/run_eval.py` (`--run N` = full round, `--score` = score saved rounds with no LLM calls). Expectations in the scoring code are those of spec 06, fixed before any result.

**Infrastructure problems met (all real, all fixed in `app/llm.py`)**
- Free tier = 50 requests/day per account (HTTP 429 `free-models-per-day`); user supplied extra keys, `OPENROUTER_API_KEYS` rotates them (the main agent noted this may conflict with OpenRouter terms; user's decision).
- OpenRouter sometimes returns HTTP 200 with an error body ("provider overloaded"); now treated as a retryable error. Client timeout raised to 300 s and retried. Identical requests are cached under `runs/cache/` (temperature 0).
- A syntax check I ran by importing `scripts/run_p3.py` ran the pipeline at import and burned part of a day's quota (my mistake).
- Call latency on the free endpoint is 60+ s; one round takes about 1.5 h.

**Defect found by round 1 (v1) and kept as evidence**: the new "needs clarification" gate in the brief was too eager. In `runs/p4/round_1_gate_v1` it stopped 5 of 7 questions (Q1, Q4, Q5, A, B) before any retrieval, so scores for T1, T3, T5 and the D traps in that run say nothing about the pipeline. The brief prompt was changed (clarification only when the topic or decision cannot be identified); the full round was re-run as `runs/p4/round_1`. Only T6 should trigger the gate. The brief prompt change was made after seeing results; it changes behaviour, not any expectation or threshold.

**Result: one round only.** Round 2 (stability) could not run: the three free-tier keys (50 requests/day each) were used up by round 1 and the gate re-run, and a Docker restart cost one more attempt. Stability between runs was NOT measured, so "each scenario at least twice" is not met. The user decided (2026-10-13) to grade one round and record this.

**Independent grading** by the `evaluator` subagent (Vietnamese report: `tests/reports/20261013-2115.md`). It hand-checked all 48 valid claims, 17 source grades, the memos and the baseline, with no LLM calls.

| Scenario | Machine | Evaluator |
|---|---|---|
| T1 (Q3, works well) | Fail | **Fail**: the 60/180 rule is absent from the memo (the S001 chunks that contain it were never retrieved); overall Medium, High unreachable (S001-S003 are one origin) |
| T2 (Q2, two figures) | Pass | **Pass only with SYNTHETIC**; Fail on real documents (all 5 sub-questions refused) |
| T3 (reposts) | Pass | Pass (mechanism); ran through extra question A, effect on confidence not exercised |
| T4 (stale data) | Pass | Pass with caveat: the stale figure still appears in the memo's conflict section |
| T5 (Q4 missing data) | Fail | **Fail**: the actual-D7 sub-question is refused correctly, but the memo shows an industry D7 benchmark and overall Medium |
| T6 (ambiguous) | Pass | Pass (3 clarifying questions; one run) |
| T7 (PDF tables/charts) | needs hand check | **Fail**: a pie chart misread with no flag; 1 table claim right; 1 truncated table cell turned into a claim. Matches the pre-registered prediction |
| T8 (baseline) | Fail | Fail (partly): MVP 0 unsupported figures vs about 32 in the baseline by hand count (machine counted 1); the baseline refuses Q4, the MVP does not refuse overall |
| T9 (draft vs in force) | Fail | **Fail**: Decree 147/2024 not named as main evidence; the draft label never fired (not testable) |

Traps: D1-D4 caught (D2 and D4 only through the extra questions A and B); D5 (SYN09) never retrieved, so not testable. Nominal 4/5.

**Metrics vs targets**
- Citation accuracy: 95.8% (46/48) on "passage says what the claim says", but 92.9% (26/28) on real documents only (target 95%: missed) and 72.9% (35/48) when scope/context errors count.
- Source-grade agreement: 82.4% (14/17), target 80%: met, narrowly.
- Correct refusal on questions that truly lack data: 50% (Q4, Q5), target 100%: missed.
- Supported fact sentences in memos: 61.5% by machine, 92.3% after the evaluator corrected false demotions, on only 13 sentences (target 90%).
- Confidence calibration: not assessable (no High verdict anywhere).
- Versus baseline: MVP clearly has fewer unsupported figures.
- Time: 4-11 minutes per question on the free model. Claims rejected at verify: 43%. JSON valid without retry: 41/42.

**Top open defects (impact order, from the evaluator; none fixed, because a fix would invalidate the measured round and no LLM quota is left)**
1. No check that a valid A/B claim actually answers the sub-question, so Medium is given to irrelevant, truncated or opinion claims; the confidence label means little.
2. `app/memo.py` computes the overall level from answered sub-questions only (lines ~96-101): Q4 and Q1 show "Medium" while their core sub-question is refused. 3 of 6 Medium sub-questions have no sentence under them.
3. Retrieval and verify miss data present in the corpus: 43% of claims rejected, about 9 of 39 rejections are apostrophe/punctuation mismatches; Q2 revenue and the S001 60/180 rule are never extracted.
4. The memo number check counts digits inside IDs such as "SYN05" and "C-dff7cd85", so 4 of 5 demoted fact sentences were actually correct (the machine 61.5% is understated).
5. PDF tables and charts are misparsed without any flag; the source grade varies with the wording of the sub-question; LLM-written scope and conflict explanations can go beyond the evidence.

**Not checked**: stability between runs, human analyst review (step not implemented; claims are auto-approved), embeddings (bge-m3 not tried), a second model.

**Gate P4 ("T1-T9 table has real results")**: met in the sense that every scenario has a real, independently graded result, including 5 failures. It does not show a product that answers Q2, Q3 and Q4 well.

**P4 gate: approved by the user on 2026-10-13 with limitations recorded**: one round only (stability not measured), T1/T5/T7/T8/T9 failed, T2 passes only with SYNTHETIC documents, the five open defects above remain. The UI and the Known limitations page must show these honestly.

## P5 - Next.js UI (2026-10-13)

**Built**: `api/main.py` (FastAPI: saved P4 results from `runs/p4/round_1`, live runs via `POST /api/runs`, test results and limitations parsed from `tests/reports/*.md` and `docs/PROGRESS.md`), `docs/api.md` (contract), `ui/` (Next.js + Tailwind, TypeScript) by the `ui-builder` subagent: 6 screens (Brief, Kho bằng chứng with source-passage panel, Đối soát mâu thuẫn read-only, Memo with real/test toggle and SYNTHETIC banner, Kết quả kiểm thử, Giới hạn đã biết). The UI only calls this API, never OpenRouter; no keys in `ui/`.

**Verified (by the subagent, re-checked by the main agent where noted)**
- Q1, Q2, Q4 flow from Brief to Memo run in a real headless browser against the real API and database, desktop and a 390 px mobile run for Q2; `tsc --noEmit`, `npm run lint` and `npm run build` clean (main agent re-ran the build: passes; nothing outside `ui/` was changed; no API key found in the repo).
- Error states (failed live run, clarification run, chunk 503 with the passage still shown, API unreachable) were tested only against a small mock (`ui/tests/mock-api.mjs`) that proxies the real API.

**Not verified / not done (honest list)**
- No real live run: `POST /api/runs` was never run end to end (no LLM quota); the success path (job finishes, redirect to the new run) is untested; only the error path was exercised, against the mock.
- Screenshots were reviewed for Brief, Evidence, Reconciliation, Memo and Test results; the limitations page, the live-error, clarification and unreachable states were checked by text assertions only. No screen-reader or keyboard test, no contrast measurement, widths between 390 and 1360 px not tried.
- Analyst review (confirm/reject/undo) and Word/PDF export are NOT implemented; the UI says so in one plain line.
- Backend/data gaps seen by the UI: claim `value`, `unit`, `data_date` are null in all saved claims (the UI uses claim text and the source's data date); `defects_from_progress` and `not_checked` are English text shown as is; the T6 (AMB) and T7 saved data cannot be opened through `/api/runs` (404 by design of the key whitelist), so the clarification screen was only tested with the mock; the memo has no single conclusion sentence, so the headline is the question plus the overall confidence band; a live job is lost if the page is reloaded.
- The UI computes two warnings for evaluator defects: overall "Medium" next to refused sub-questions, and a sub-question with a level but no sentence.

**How to run**: `docker compose up -d`; from the repo root `.venv\Scripts\python -m uvicorn api.main:app --port 8000`; in `ui/`: `npm install` (first time), `npm run dev`, open http://localhost:3000 (`ui/.env.local` holds `NEXT_PUBLIC_API_URL`, gitignored).

## Separate deliverables (2026-10-13, after P5)

User asked to split two pieces of work. Priority chosen: report first, lean product later.
- **Test report for the contest judges (Word, Vietnamese)**: `tests/reports/Bao-cao-kiem-thu-gamota-research-copilot.docx` (10 pages). Built from the evaluator report `tests/reports/20261013-2115.md` and docs/PROGRESS.md without changing any result; includes T1-T9 in Expectation / Actual / Pass-Fail / Lesson form, strengths and weaknesses, metrics vs thresholds, baseline comparison, the limits of the test suite and answers to the 3 mandatory questions. Checked by exporting to PDF with Microsoft Word and viewing pages 1, 4 and 8 (the other pages were not viewed, and the docx XSD validator could not run: python package defusedxml missing).
- **Lean product (UI + full interaction + deployment)**: NOT started. Decisions already given by the user: deploy = Vercel (UI) + Render/Railway (API, Postgres); interaction = analyst confirm/reject claims, Word/PDF export, persistent question history, answering clarifying questions; test-results and project-log content moves out of the product. Needs free-model quota to verify live runs, so it waits.

## Lean product (2026-10-14) - built, not deployed, not verified with a live model

Split from the contest report at the user's request. The old demo UI is kept in git as tag `demo-p5`. Decisions by the user: deploy on Vercel (UI) + Render (API and PostgreSQL), start with an empty history, no access control, `ui/` replaced in place.

**Built**
- Backend `api/` (`main.py`, `store.py`, `service.py`, `export.py`): runs, history and review decisions persisted in PostgreSQL (restart-safe; a job interrupted by a restart is marked as such); analyst review (confirm / reject / undo) with confidence recomputed by code at once; "rewrite memo" from non-rejected claims (uses the model); answering clarifying questions (starts a linked new run); Word export with appendix and limitations note; corpus loaded automatically into an empty database; at most 2 concurrent jobs. Contract: `docs/api.md`.
- UI `ui/` by the `ui-builder` subagent: question box + persistent history, brief/clarify, evidence store with source panel and review buttons, read-only reconciliation, memo with stale warning, rewrite, "Tải Word", "Lưu thành PDF" (browser print with a print stylesheet), short "Giới hạn đã biết". All report/test content (T1-T9, trap mode, baseline, P4 notes) removed from the product.
- Deployment files: `api/Dockerfile`, `render.yaml`, `.dockerignore`, `.github/workflows/ci.yml` (backend tests against a PostgreSQL service with a fake LLM, UI lint and build), `docs/DEPLOY.md` (steps, changing model/key without code changes, caveats).
- 29 tests pass locally (22 earlier + 7 for the API with a fake LLM that exists only in `tests/fake_llm.py`).

**Verified**: the API flows (start run, history persists, review, memo rewrite, clarification, Word file content, interrupted-job marking, error text without local paths) with the fake LLM; UI `tsc`, `lint`, `build` clean; the UI in a headless browser against the real backend for home/history, a failed run, a clarification run and the limitations page, and against a mock for finished-run flows (review recompute, stale memo, rewrite, error and special states, 390 px).

**NOT verified (honest list)**
- A real model run through the new API from question to memo has not been done: the free-model quota (50 requests/day per account) was exhausted again; the one attempt ended as a stored error (HTTP 429), which at least shows the error path works. Retry when quota is available.
- A real memo rewrite, review decisions on a real finished run, and opening the downloaded Word file in Word were not done (Word content was only checked by reading the docx back in a test). PDF is only the print stylesheet, checked with print emulation.
- Nothing was deployed: Dockerfile, `render.yaml`, CI and the Vercel settings are untested; `docker build` was not run and the CI workflow has never run on GitHub.
- No access control: anyone with the link can start runs and spend the deployer's model quota (user decision, shown on the limitations page).
- The earlier P5 commit missed `ui/app/runs/` because the root `.gitignore` had `runs/`; it is now anchored (`/runs/`). Tag `demo-p5` therefore lacks those pages.

Open defects of the pipeline itself (relevance check, overall confidence, retrieval misses, table/chart parsing) are unchanged; see the P4 section.

### Restructure into backend/ and frontend/ (2026-10-14)

Layout is now `backend/` (Python) and `frontend/` (Next.js); see README and CLAUDE.md. Paths in the sections above that mention `app/`, `api/`, `corpus/`, `tests/`, `scripts/`, `runs/` or `ui/` refer to the old layout, i.e. `backend/<name>` and `frontend`. Checked after the move: pytest 29 passed (run from `backend/`), frontend `tsc`, lint and build clean, `docker build` with context `backend/` succeeds and the container loads the corpus into an empty PostgreSQL (`corpus.state=ready`, 686 chunks, 30 documents). Not yet checked: `render.yaml` and CI on GitHub, Vercel build with Root Directory `frontend`, nothing pushed or deployed. Still no live-model run of the lean product (free-tier quota).
