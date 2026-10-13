# Core loop and functional requirements

Part of the gamota-research-copilot spec; see `docs/SPEC.md` for the index.

## 5. Core loop

```
Question → [1] Brief → [2] Retrieve relevant passages → [3] Extract claims
      → [4] Verify citations → [5] Grade + reconcile
      → [6] Analyst review → [7] Memo with evidence
```

| Step | Input | Processing | Output |
|---|---|---|---|
| 1. Brief | Raw question | LLM splits out the decision, scope, sub-questions and needed evidence types | Brief (JSON) |
| 2. Retrieve | Sub-questions | Hybrid keyword and semantic search over the corpus | List of passages with sources |
| 3. Extract | Passages | LLM extracts only claims present in the passage, returns JSON per schema | Draft claims |
| 4. Verify citations | Draft claims | Code check: do the numbers and entities in the claim appear in the source passage? | Valid claims or rejected |
| 5. Grade + reconcile | Valid claims | Grade sources by rules, group claims by topic, detect conflicts, trace duplicated origins | Claim groups, grades, conflicts |
| 6. Review | Claim groups | Analyst confirms, edits or rejects | Approved claims |
| 7. Memo | Approved claims | LLM writes the memo using claim IDs only; code checks every sentence has a source ID | Memo + appendix |

Refusal mechanism: if after step 5 no grade A/B claim answers a sub-question, the system writes **"Chưa đủ căn cứ"** (not enough evidence) and writes no conclusion for that part.

## 6. Functional requirements

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR1 | Accept a question and generate a brief | Brief has the decision, scope and 3-5 sub-questions; at most 3 clarifying questions |
| FR2 | Retrieve from the corpus | Returns the relevant document in the top 5 for at least 80% of sub-questions in the test suite |
| FR3 | Structured claim extraction | Each claim has: content, value, unit, scope, data date, source ID, original passage |
| FR4 | Automatic citation check | A claim whose number/entity is not in the source passage is rejected; the reason is logged |
| FR5 | Source grading | Grade A-D computed by the rules in section 8, component scores displayed |
| FR6 | Duplicate-source detection | Sources quoting the same origin count as one independent source |
| FR7 | Conflict detection and explanation | Each conflict has a cause (definition, year, scope, method, unknown) and a suggestion of which figure to use for which purpose |
| FR8 | Confidence label | High / Medium / Low / Not enough evidence, per the rules in section 8, with a reason |
| FR9 | Review screen | Analyst confirms, edits, rejects claims; changes are recorded and affect the memo |
| FR10 | Memo generation | Every "fact" sentence has a claim ID; a sentence without one is labelled "inference" or deleted |
| FR11 | "What could make the conclusion wrong" section | 2-3 key assumptions, generated from conflicts and low-grade claims |
| FR12 | Word/PDF export | Memo exports with an appendix listing claims and sources |
| FR13 | Run the test suite | One command runs all scenarios and prints a pass/fail report and the metrics |
