# Test suite and metrics

Part of the gamota-research-copilot spec; see `docs/SPEC.md` for the index.

## 12. Test suite

Format: **Expectation → Actual result → Pass/Fail → Lesson learned.** The result fields are filled after running. Test reports under `tests/reports/` are written in Vietnamese.

**T1. Works well: a question with several clear sources (Q3)**
- Expectation: the memo states the current regulation correctly, every fact sentence has a claim ID; the official source is grade A; confidence High.
- Actual result: (fill in after running)
- Pass/Fail: (fill in)
- Lesson learned: (fill in)

**T2. Hard case: two strong sources, two figures (Q2)**
- Expectation: show the value range, explain it is due to different measurement definitions, suggest which figure to use for which purpose; confidence Medium.
- Actual result / Pass-Fail / Lesson learned: (fill in after running)

**T3. Duplicated-source and PR trap (Q1)**
- Expectation: 3 articles quoting one press release count as 1 independent source; the PR article is graded C/D and does not raise confidence.
- Actual result / Pass-Fail / Lesson learned: (fill in after running)

**T4. Stale-data trap**
- Expectation: expired figures lose freshness points, are not used as the main evidence, and the memo states the data date.
- Actual result / Pass-Fail / Lesson learned: (fill in after running)

**T5. Missing data (Q4)**
- Expectation: answers "Chưa đủ căn cứ", gives no number, suggests where the data should come from.
- Actual result / Pass-Fail / Lesson learned: (fill in after running)

**T6. Ambiguous question ("Thị trường game casual thế nào?" / "How is the casual game market?")**
- Expectation: the system asks at most 3 clarifying questions about the decision, scope and time frame instead of writing a generic report.
- Actual result / Pass-Fail / Lesson learned: (fill in after running)

**T7. Expected weak case: figures inside PDF tables or charts, or in a different unit/currency**
- Expectation: extract the right number with its unit; if unsure, flag it and do not infer.
- Prediction (to confirm): extraction will be wrong or confuse units, because PDF readers easily break table structure.
- Actual result / Pass-Fail / Lesson learned: (fill in after running)

**T8 (baseline).** Run Q1-Q5 through a direct-answer LLM (no claim flow) and compare: number of sentences with verifiable citations, number of figures without support, and whether Q4 is refused correctly.

**T9. Draft versus in-force regulation (Q3)**
- Expectation: the memo uses Decree 147/2024/NĐ-CP (effective 25/12/2024) as the main evidence; the draft amendment is labelled "draft, not in force" and not presented as the regulation currently applied.
- Actual result / Pass-Fail / Lesson learned: (fill in after running)

## 13. Metrics and thresholds

Thresholds are **proposed targets** to be calibrated when real run data exists. If they are missed, report it; do not lower them.

| Metric | How measured | Target |
|---|---|---|
| Citation accuracy | Manually check a sample of claims: does the original passage say exactly that? | ≥ 95% |
| Share of supported "fact" sentences | Sentences with a valid claim ID / total fact sentences | ≥ 90% |
| Traps caught | Traps down-graded or flagged / 5 traps | ≥ 4/5 |
| Correct refusal | Questions lacking data answered "Chưa đủ căn cứ" | 100% on the test suite |
| Source-grade agreement | Matches the grade table scored by an analyst | ≥ 80% |
| Confidence calibration | Are "High" conclusions correct more often than "Low"? | High > Low |
| Versus baseline | Unsupported figures in the MVP versus the baseline | MVP clearly lower |
| Time | From question to draft memo | Record, compare with manual work |

The suite is still small (5 questions, 20-30 sources), so results only prove the mechanism works, not accuracy on the real market.

**Additional metrics:** stability between runs (run each scenario at least 2 times and record differences); share of responses whose JSON parses without retry; share of claims rejected at the citation check; average latency per step.
