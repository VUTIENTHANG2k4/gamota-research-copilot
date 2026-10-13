# Plan, risks, agent framework, honesty rules

Part of the gamota-research-copilot spec; see `docs/SPEC.md` for the index.

## 15. Three-day plan by phase

| Phase | Work | Approval gate |
|---|---|---|
| P0 | Init repo, docker compose, .env, check OpenRouter calls and JSON schema | Model call works, observed limitations written down |
| P1 | Collect the real corpus, sources.csv, write SYNTHETIC trap documents | User reviews the source list |
| P2 | ingest, retrieve, extract, verify | Q1-Q5 produce valid claims |
| P3 | grade, dedupe, conflict, confidence, refusal when data is missing | Traps caught, Q4 refused |
| P4 | memo, baseline, test suite T1-T9, independent grading | T1-T9 table has real results |
| P5 | Next.js UI in Vietnamese | Demo runs end to end |

**5-minute demo script:** Q1 from start to memo (see the evidence, see the PR trap down-graded); Q2 shows the conflict; Q4 refuses correctly; show the test-result table, including T7 if it failed.

## 16. Risks and assumptions

- **A small corpus makes it easier to "pass" than reality.** State this limit plainly when presenting results.
- **The grading rubric is a subjective proposal.** An analyst must cross-check it to calibrate.
- **Self-written traps may be too easy.** Have someone outside write a few more traps.
- **Internal data is only simulated.** Never use group E results to conclude anything about the real Gamota.
- **LLM cost and latency** must be recorded to judge scalability.
- **The free Nemotron endpoint logs usage.** Send only public and SYNTHETIC documents; use the paid variant if stability is needed.
- **Nemotron's JSON schema support, Vietnamese quality and latency are unverified.** Measure in P0 and P4; the fallback is to parse JSON and validate with Pydantic.
- **Full Next.js in 3 days is a schedule risk.** Build it after P4 and cut it first when time runs out.
- **Pressure to look good can override honesty.** The UI should be attractive but always show confidence, conflicts, "Chưa đủ căn cứ" and the Known limitations page.

## 17. Agent framework for Claude Code

One main agent holds the plan and the pipeline, with three specialised subagents; every phase stops for user approval.

| Agent | Role | Limits |
|---|---|---|
| Main agent | Plan, pipeline from ingest to memo, documentation | Updates PROGRESS.md and CHANGES.md each phase |
| source-collector | Collect and snapshot real sources, write sources.csv | Does not write or edit document content, does not invent metadata, does not bypass paywalls |
| evaluator | Run T1-T9 and the baseline, grade independently | Does not edit code, does not edit expectations, writes only to tests/reports |
| ui-builder | Build the Vietnamese Next.js UI | Starts only after P4, must display honestly |

Cut line when time runs out: cut from P5 upwards, never cut P4.

## 18. Honesty rules

1. Never hide failures or limitations; present them clearly and professionally.
2. Never change expectations to make a test pass.
3. Never invent figures, sources, URLs or quotations.
4. Self-written documents are always labelled SYNTHETIC.
5. Never call the product production-ready.
6. Never commit or print API keys.
