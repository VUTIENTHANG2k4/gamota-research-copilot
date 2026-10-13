# Data model and scoring rules

Part of the gamota-research-copilot spec; see `docs/SPEC.md` for the index.

## 7. Data model

**Source:** ID, title, URL, source type (primary data / report with methodology / press / PR / forum / internal), organisation, publish date, data date, whether a methodology is stated (yes/no), conflict-of-interest note, citation origin (if it is a repost), snapshot date, hash, `is_synthetic` flag.

**Claim:** ID, source ID, content, topic, value, unit, scope (market, platform, year, measurement definition), type (fact / estimate / opinion), original passage, citation-check status, review status.

**Conflict:** ID, related claims, classified cause, explanation, usage suggestion, resolution status.

**Memo:** question, brief, conclusion, confidence level, list of points (each tagged with claim IDs), conflicts, gaps, key assumptions, next verification steps.

## 8. Source grading and confidence rules

The MVP uses **explicit rules** so results can be explained and tested. The thresholds below are **initial proposals** to be calibrated during trial runs.

**Source score (max 9):**

| Criterion | Scoring |
|---|---|
| Source type | Primary/official data 4; report with methodology 3; press 2; unverified internal 2; PR/forum 0-1 |
| Freshness | Within the validity window for the data type 3; partly expired 1; expired 0 |
| Methodology | Measurement and definitions stated clearly 2; partly stated 1; not stated 0 |
| Conflict of interest | None 0; present (PR, vendor) minus 2 |

**Grade:** A from 8 points; B from 6 to 7; C from 4 to 5; D below 4.

**Validity window by data type (proposal):** market size and revenue 18 months; store rankings and reviews 6 months; legal regulations must be the version currently in force.

**Confidence of a conclusion:**

| Level | Condition |
|---|---|
| High | At least 2 independent grade A/B sources agree, no unexplained conflict remains |
| Medium | One grade A/B source, or a conflict whose cause has been explained |
| Low | Only grade C/D sources, or an unexplained conflict |
| Not enough evidence | No valid claim answers the question |

Count "independent" by origin, not by number of articles.
