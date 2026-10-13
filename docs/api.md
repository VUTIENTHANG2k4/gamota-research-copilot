# API contract (MVP / prototype)

Backend: FastAPI in `api/main.py`. Start: `.venv\Scripts\python -m uvicorn api.main:app --port 8000` from the repo root (PostgreSQL container must be up for `/api/chunks`). CORS allows `http://localhost:3000`. The UI must call only this API; it never calls OpenRouter.

All user-visible strings coming from the API are Vietnamese. Field names are English.

## Data origin (the UI must show it)

- `origin: "saved"` on `/api/runs`: results saved from the P4 test run (round 1). They are NOT new runs. Label them plainly ("Kết quả đã lưu từ lần chạy kiểm thử P4").
- `origin: "live"`: a run started with `POST /api/runs`. It only works while the free model has quota; otherwise the job ends with `status: "error"` and the UI must show the error text as is, never fake content.

## Endpoints

| Method and path | Returns |
|---|---|
| `GET /api/health` | `{status, mode, saved_runs}` |
| `GET /api/runs` | List of `{key, label, question, origin, origin_note}`. Saved keys: `Q1`-`Q5`, `A`, `B` (A and B are extra trap-testing questions) |
| `GET /api/runs/{key}` | One full run, see below. 404 if unknown |
| `GET /api/chunks/{chunk_id}` | `{chunk_id, source_id, page, text, source}`: the full passage a claim was quoted from. 503 with a Vietnamese message if the database is down |
| `GET /api/sources` | All 30 sources with metadata (`is_synthetic` boolean) |
| `POST /api/runs` | Body `{question}` (5-400 chars). Returns `{job_id, key}`. Takes minutes |
| `GET /api/jobs/{job_id}` | `{status: "running"\|"done"\|"error", stage, key, question, error?}` |
| `GET /api/test-results` | Taken from the latest `tests/reports/*.md` written by the evaluator: `report_file, title, summary_markdown, scenario_table_header, scenario_table, scenario_details_markdown, metrics_markdown, metrics_table, baseline_markdown, limitations_of_suite_markdown, machine_scores`. Never type these by hand |
| `GET /api/limitations` | `report_file, defects_markdown, not_testable_markdown, defects_from_progress, not_checked, fixed_statements` (list of standing limitations) |

## `GET /api/runs/{key}`

```
key, question, needs_clarification (bool), brief {decision, scope, needs_clarification,
  sub_questions[{id, text, search_query, search_query_en, evidence_type}], clarifying_questions[]}
subs[]: {
  id, text,
  retrieved[{chunk_id, source_id, page, score}],
  claims[]  (claims that passed the code citation check, graded):
    {claim_id (C-xxxxxxxx), content, value, unit, scope, data_date, claim_type, passage (verbatim quote),
     chunk_id, source_id, is_synthetic, grade (A-D), grade_detail {score, components{source_type, freshness,
     methodology, conflict_of_interest}, freshness_note}, origin_group, source_type, has_methodology,
     src_data_date, src_publish_date, source {id, title, url, source_type, org, publish_date, data_date,
     has_methodology, conflict_of_interest_note, cites_origin, is_synthetic}}
  rejected_claims[]: {content, passage, reason, source_id, is_synthetic}   (failed the citation check)
  conflicts[]: {claim_a, claim_b, cause (definition|year|scope|method|legal_status|unknown), llm_cause,
     recheck, explanation, usage_suggestion, status (explained|unexplained), relative_diff, synthetic_involved}
  verdict_real_only {level, reason, refused, independent_ab?}   <- headline, no SYNTHETIC evidence
  verdict_with_synthetic {...}                                  <- trap-test mode, SYNTHETIC included
}
memo_real, memo_test: {question, mode, overall{level, reason}, analyst_review, subs[{id, text, verdict,
  refused_text ("Chưa đủ căn cứ" or null), points[{is_fact, text, claim_ids[], citations[], draft_flag}],
  conflicts[], reference_signals_cd[{claim_id, content, citation}]}], gaps[], key_assumptions[], next_steps[],
  stats, markdown}
baseline: {question, answer, latency_s}   (direct LLM answer, no corpus; Q1-Q5 only)
timing
```

Confidence `level` values: `High`, `Medium`, `Low`, `Chưa đủ căn cứ`. Show Vietnamese labels: Cao, Trung bình, Thấp, Chưa đủ căn cứ, with the `reason` always visible.

`is_fact: false` on a memo point means "suy luận" (inference) and must be tagged so. `draft_flag: true` means the point cites a draft regulation: the text already carries the "DỰ THẢO" label.

## Honesty rules for consumers

- `memo_real` is the headline memo; `memo_test` includes SYNTHETIC documents and must carry the SYNTHETIC banner and never be presented as a statement about the real market.
- Show `rejected_claims` and the rejection reason, "Chưa đủ căn cứ" blocks, `unexplained` conflicts and the limitations page prominently.
- The analyst review step (confirm/reject claims) and Word/PDF export are NOT implemented. Do not draw buttons that do nothing.
