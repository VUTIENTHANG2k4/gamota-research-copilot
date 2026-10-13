# gamota-research-copilot spec: index

The spec is split into small files under `docs/spec/`, one per workstream. Claude Code reads only the files for the current phase (the mapping is in `CLAUDE.md`). **If two files conflict, `00-decisions.md` wins.**

| File | Content | Used in phase |
|---|---|---|
| `spec/00-decisions.md` | Fixed decisions (name, model, UI, finish level) | All phases |
| `spec/01-overview.md` | MVP summary, chosen core piece, scope, users and scenarios | P5 |
| `spec/02-pipeline-and-requirements.md` | 7-step core loop and functional requirements FR1-FR13 | P2, P3, P5 |
| `spec/03-data-model-and-scoring-rules.md` | Data model, A-D source grading rules, confidence rules | P1, P2, P3 |
| `spec/04-architecture.md` | Architecture, tech stack, four quality guardrails, model notes | P0 |
| `spec/05-corpus-and-sample-questions.md` | 5-group corpus, real sources found so far, sample questions Q1-Q5 | P1 |
| `spec/06-evaluation.md` | Test scenarios T1-T9 and metrics with thresholds | P4 |
| `spec/07-contest-answers.md` | Draft answers to the 3 mandatory contest questions | P4 |
| `spec/08-plan-risks-agents-honesty.md` | Phase plan, risks, agent framework, honesty rules | When the overall picture is needed |
| `design/DESIGN.md` | Approved UI design (fonts, colour tokens, layout, components) | P5 |

**Language:** the spec and design docs are in English. Everything the end user sees (web UI, memo, test reports in `tests/reports/`) is in Vietnamese. Sample questions and any text that the pipeline processes keep their Vietnamese originals.
