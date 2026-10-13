# gamota-research-copilot

AI research assistant for the game market, built for Gamota. It takes a research question and returns a **one-page memo** with a conclusion, a confidence level, and verifiable evidence (every number links to its source passage).

This is an **MVP/prototype for a contest (Mission 2)**, not a production system. The goal is to show that the team picked the right core piece, built it, tested it, and knows where it works and where it does not.

## Language policy

- Code, identifiers, comments, commit messages, and everything under `.claude/` are in **English**.
- `docs/` (spec and design) is in **English**.
- Everything the end user sees is in **Vietnamese**: the web UI, the memo, and the test reports in `backend/tests/reports/`. Sample questions Q1-Q5 and the corpus text the pipeline processes keep their Vietnamese originals.
- Keep technical terms (claim, brief, memo) as they are, with a short Vietnamese gloss on first use in UI text.

## Non-negotiable rules (read before doing anything)

1. **Never hide failures or limitations.** The product must show confidence levels, conflicts, and "Chưa đủ căn cứ" (not enough evidence) honestly, and ship a "Known limitations" page. A polished, professional presentation of limitations is welcome; hiding or blurring them is not.
2. **Never change expectations to make a test pass.** Report exactly what ran. A failed scenario is a valid and required result.
3. **Never invent figures, sources, URLs, or quotations.** If something cannot be found, say "Chưa đủ căn cứ" or ask the user.
4. **Mark every self-written document `SYNTHETIC`**: at the top of the file, in `sources.csv` (`is_synthetic=true`), and in the UI. Never use SYNTHETIC documents to draw conclusions about the real market or the real Gamota.
5. **Never call the product "production-ready"** in docs or UI. Say "MVP" or "prototype".
6. **Never commit or print API keys.** Keys live only in `.env` (gitignored).

## Architecture and stack

Repository layout: `backend/` (Python: `app/` pipeline, `api/` FastAPI, `corpus/`, `scripts/`, `tests/`, `Dockerfile`), `frontend/` (Next.js), `docs/`. Run Python commands from `backend/`; the virtualenv `.venv` and `.env` live at the repo root.

| Layer | Choice |
|---|---|
| LLM | NVIDIA Nemotron 3 Ultra via OpenRouter, slug `nvidia/nemotron-3-ultra-550b-a55b`, set by the `LLM_MODEL` env var |
| Backend | Python, FastAPI |
| Database | PostgreSQL + pgvector (docker compose); keyword search as fallback if embeddings are not ready |
| Embeddings | Local (e.g. bge-m3) or skipped in favour of keyword search; decided in P2 from measurements |
| Frontend | Next.js + Tailwind, Vietnamese only |
| Tests | pytest + `backend/tests/run_eval.py` |

`backend/app/llm.py` is the **only** place that calls the model. Do not call OpenRouter anywhere else. Use temperature 0 and JSON-schema output, and save every response under `backend/runs/` so results are reproducible.

**Data warning:** the free (`:free`) Nemotron endpoint logs usage to improve NVIDIA's products. Send only public documents and SYNTHETIC documents. Never send real Gamota data or personal data. It is not yet verified how well OpenRouter supports `response_format` JSON schema for this model: check it in P0. Fallback: parse JSON, validate with Pydantic, retry at most twice.

## Pipeline

Brief → retrieve → extract claims (LLM) → **verify citations (code)** → **grade sources + dedupe origins (code)** → reconcile conflicts → **confidence level (code)** → analyst review → memo (LLM, claim IDs only).

Four guardrails run in code, never delegated to the LLM:

1. Numbers and entities in a claim must appear in the source passage, otherwise the claim is rejected.
2. Source grade A-D is computed from the scoring table in `docs/spec/03-data-model-and-scoring-rules.md`.
3. Confidence (High / Medium / Low / Not enough evidence) comes from hard rules.
4. A "fact" sentence in the memo without a claim ID is deleted or labelled "inference".

If no grade A/B claim answers a sub-question, output **"Chưa đủ căn cứ"** and write no conclusion for that part.

## Phases and approval gates

Work in order. **At the end of each phase: stop, report real results (including failures), and wait for the user's approval before starting the next phase.** Read only the spec files listed for the current phase.

| Phase | Work | Gate | Read |
|---|---|---|---|
| P0 | Init repo, docker compose, `.env`, check OpenRouter calls and JSON schema | Model call works; limitations observed are written down | `04-architecture.md` |
| P1 | Collect the corpus (`source-collector` subagent), `sources.csv`, write SYNTHETIC trap documents | User reviews the source list | `05-corpus-and-sample-questions.md`, `03-data-model-and-scoring-rules.md` |
| P2 | `ingest`, `retrieve`, `extract`, `verify` | Q1-Q5 produce valid claims | `02-pipeline-and-requirements.md`, `03-data-model-and-scoring-rules.md` |
| P3 | `grade`, `dedupe`, `conflict`, `confidence`, refusal when data is missing | Traps are caught, Q4 is refused | `03-data-model-and-scoring-rules.md`, `02-pipeline-and-requirements.md` |
| P4 | `memo`, `baseline.py`, test suite T1-T9 (`evaluator` subagent grades independently) | T1-T9 table has real results | `06-evaluation.md`, `07-contest-answers.md` |
| P5 | Next.js UI (`ui-builder` subagent) | Demo runs end to end | `01-overview.md`, `02-pipeline-and-requirements.md` |

Always read `docs/spec/00-decisions.md` first: it wins if anything conflicts. `docs/spec/08-plan-risks-agents-honesty.md` holds risks and the full plan.

**3-day budget and cut line:** if time runs out, cut from the bottom. P5 may shrink to the minimum (4 screens + test-results page + known-limitations page). **Never cut P4**: without test results nothing is proven.

## Evaluation

Required format per scenario: **Expectation → Actual result → Pass/Fail → Lesson learned** (reports are written in Vietnamese). At least 5 scenarios, including at least one that works well, one hard or ambiguous case, and one failure or poorly handled case. Thresholds are proposed targets: if they are missed, report that; do not lower them. Sample questions Q1-Q5 stay as in `docs/spec/05-corpus-and-sample-questions.md`.

## UI

Vietnamese only. Follow `docs/design/DESIGN.md` (approved design; it overrides generic styling). The `frontend-design` skill may help with implementation quality only. Beautiful and clear, but always display: source grade, confidence with reason, conflicts, the "Chưa đủ căn cứ" state, the SYNTHETIC label, and a **Known limitations** page that honestly lists what the MVP cannot do.

## Working conventions

- **At the start of every session, read `docs/PROGRESS.md` first** (before any other spec file) to learn which phase is current, what was measured, and which defects are open. Then follow the phase table below.
- Put temporary files in the scratchpad directory, not in the repo.
- **At the end of each phase**, before asking for approval: update `docs/PROGRESS.md` (what was done, real measurements, open defects) and `docs/CHANGES.md`, then make a git commit for that phase so history reads like real work. Use a clear message such as `P2: ingest, retrieve, extract, verify (Q2 limitation recorded)`, never include `.env`, API keys, `runs/` or `.venv/`, and do not push unless the user asks. If a phase is approved with limitations, the commit message or `PROGRESS.md` must say so.
- Record every change from the original plan in `docs/CHANGES.md` with the reason (it feeds mandatory contest question 2).
- Ask the user when a decision is irreversible or unclear.
