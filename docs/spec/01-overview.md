# Overview, scope and users

Part of the gamota-research-copilot spec; see `docs/SPEC.md` for the index.

## 1. MVP summary

**What the MVP is:** an application that runs on a **frozen corpus of 20-30 documents**. The user enters a research question and the system returns a **one-page memo** with a conclusion, a confidence level, sourced points, conflicts, data gaps, and what could make the conclusion wrong. Every point can be clicked to see the original source passage.

**What the MVP is not:** a free-form Q&A chatbot, a web-crawling tool, or a market dashboard.

## 2. The chosen core piece

The chosen piece is the **engine that turns sources into evidence-backed statements**, made of four connected capabilities:

1. Extract **claims** (a statement with its source, date and original passage) from documents.
2. **Grade sources** A-D with explicit rules; not all sources are treated equally.
3. **Handle conflicts and missing data**: explain the cause, show a range, or refuse to answer.
4. **Generate the memo** only from verified claims, with a confidence level.

**Why this piece:** the biggest risk of the whole brief is AI that is wrong in a convincing way. If this engine works, the rest (nice UI, wide crawling, alerts, dashboards) is ordinary engineering. If it does not work, the rest is meaningless.

**Four hypotheses the MVP must prove:**

| ID | Hypothesis | How to prove it |
|---|---|---|
| H1 | Every key conclusion has verifiable evidence | Measure citation accuracy and the share of supported sentences |
| H2 | The system does not treat all sources equally | PR traps, old sources and duplicated sources are down-weighted |
| H3 | The system knows how to say "not enough evidence" | Questions without data must be refused correctly |
| H4 | The structured approach beats a direct-answer LLM | Compare with a baseline on the same question set |

## 3. Scope

| In the MVP | Deliberately not done |
|---|---|
| Enter a question, generate a short brief (at most 3 clarifying questions) | Live web crawling, large-scale social media |
| Frozen corpus of 20-30 documents with dates and URLs | Deep sentiment analysis, quantitative forecasting |
| Claim extraction + automatic citation matching | Continuous monitoring alerts |
| Rule-based source grading, duplicate-source detection | Integration with real internal systems |
| Conflict detection and explanation | Multiple markets, every game genre |
| Review screen: confirm, edit, reject claims | Permissions, SSO, multi-user |
| One-page memo, Word/PDF export | An executive-facing trial UI |
| Automated test suite + comparison baseline | |

**Why a frozen corpus:** results must be repeatable for fair testing. Live crawling changes results day to day and makes runs incomparable.

## 4. Users and scenarios

- **Primary user:** Gamota market analyst.
- **Recipients of the output:** leadership, Product Managers, the publishing team.
- **Main scenario:** the board asks "Should we build an idle RPG for Vietnamese mobile next year?" The analyst enters the question, approves the brief, reviews the claim store, resolves the flagged conflicts, then exports the memo.

User stories:

- As an analyst, I want every number shown with its original passage so I can verify it in seconds.
- As an analyst, I want to know why two sources conflict so I can pick the right figure.
- As a leader, I want to know how sure the conclusion is and what could make it wrong.
- As an analyst, I want the system to say plainly when data is insufficient instead of guessing.
