# Fixed decisions

Part of the gamota-research-copilot spec; see `docs/SPEC.md` for the index.

Mission 2 | Spec for functionality, data and testing (updated 13/10/2026)

> **Status:** this is a spec to build and run. The "Actual result" fields of the test suite are intentionally left blank and are filled only after real runs. Items marked "prediction" are hypotheses to confirm, not measured results.

## Fixed decisions (updated 13/10/2026)

This version follows the decisions of 13/10/2026; where it conflicts with older sections, this section wins.

| Topic | Decision | Note |
|---|---|---|
| Project name | gamota-research-copilot | Replaces the working name Research Copilot |
| Model | NVIDIA Nemotron 3 Ultra via OpenRouter | Replaces the local-model option; the free endpoint logs usage |
| UI | Next.js + Tailwind, fully in Vietnamese | Built last, cut first when time runs out |
| Corpus | Real sources collected by an agent; traps and simulated internal data are self-written and labelled SYNTHETIC | SYNTHETIC groups are never used to draw conclusions about the real market |
| Sample questions | Keep Q1-Q5 | |
| Timeline | 3 days, phases P0-P5, each with an approval gate | Never cut testing (P4) |
| Missing a threshold | Keep the threshold, report the real result | Failure is a valid result |
| Finish level | Polished MVP, not production | Never use the words production-ready |
| Presenting limitations | Show them honestly, never hide them | A "Known limitations" page exists |
