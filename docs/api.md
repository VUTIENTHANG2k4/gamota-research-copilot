# API contract: lean MVP (prototype)

Backend: FastAPI in `api/main.py`. Local start from the repo root: `.venv\Scripts\python -m uvicorn api.main:app --port 8000` (PostgreSQL must be up, `DATABASE_URL`). CORS origins come from `CORS_ORIGINS` (comma separated) and optional `CORS_ORIGIN_REGEX`. The UI calls only this API; it never calls OpenRouter.

All user-visible strings from the API are Vietnamese; field names are English. Runs, review decisions and history are stored in PostgreSQL and survive restarts. The corpus (30 fixed documents) is loaded into an empty database on first start (`/api/health` shows `corpus.state`: `starting`, `ingesting`, `ready`, `error`).

The product shows ONE memo: the real-documents memo. The 12 SYNTHETIC documents are in the corpus and their claims can appear in the evidence store with `is_synthetic: true` (the UI must label them), but they never count towards a conclusion.

## Endpoints

| Method and path | Purpose |
|---|---|
| `GET /api/health` | `{status, mode, corpus{state, chunks, error}}` |
| `GET /api/about` | `{corpus{documents, synthetic, real}, limitations[]}`: text for the short limitations page |
| `GET /api/runs` | History, newest first: `[{id, question, parent_id, status, stage, error, created_at, finished_at, memo_status, has_result}]` |
| `POST /api/runs` | Body `{question}` (5-400 chars). 202 `{id}`. 429 when too many jobs run (Vietnamese message), 503 while the corpus is loading |
| `GET /api/runs/{id}` | One run (below). Poll while `status` is `queued` or `running` |
| `DELETE /api/runs/{id}` | Remove a run from the history |
| `POST /api/runs/{id}/clarify` | Body `{answer}`; only when `status == "needs_clarification"`. 202 `{id}` of a NEW run (its `parent_id` is the old run) |
| `PUT /api/runs/{id}/claims/{claim_id}/review` | Body `{state: "confirmed" \| "rejected" \| "none"}`. Returns the updated run. Rejecting a claim removes it from conclusions: the confidence of the sub-question is recomputed by code immediately; `memo_status` becomes `stale` |
| `POST /api/runs/{id}/memo` | Rewrite the memo from non-rejected claims (uses the model, takes a minute or more). 202. Poll the run: `memo_status` goes `running` then `fresh` or `error` (`memo_error`) |
| `GET /api/runs/{id}/export.docx` | Word file: memo, review summary, limitations note, appendix of claims and sources. Adds a visible warning inside the file when the memo is stale. 409 if no memo. PDF export is the browser's print dialog ("Lưu thành PDF"), so the UI should provide a print stylesheet for the memo page |
| `GET /api/chunks/{chunk_id}` | `{chunk_id, source_id, page, text, source{...}}`: the full passage a claim was quoted from; 503 with a Vietnamese message if the database is down |
| `GET /api/sources` | All 30 sources with metadata |

## Run object (`GET /api/runs/{id}`)

```
id, question, parent_id, created_at, finished_at,
status: queued | running | done | error | needs_clarification
stage (Vietnamese text of the current step), error (verbatim text when status == "error")
brief: null or {decision, scope, needs_clarification, sub_questions[{id, text, ...}], clarifying_questions[]}
subs[]: {
  id, text, retrieved[{chunk_id, source_id, page, score}],
  claims[]: {claim_id (C-xxxxxxxx), content, scope, claim_type, passage (verbatim quote), chunk_id, source_id,
             is_synthetic, grade (A-D), grade_detail {score, components{source_type, freshness, methodology,
             conflict_of_interest}, freshness_note}, origin_group, src_data_date, src_publish_date,
             review: "none" | "confirmed" | "rejected",
             source {id, title, url, source_type, org, publish_date, data_date, has_methodology,
                     conflict_of_interest_note, cites_origin, is_synthetic}}
  rejected_claims[]: {content, passage, reason, source_id, is_synthetic}   (failed the automatic citation check)
  conflicts[]: {claim_a, claim_b, cause (definition|year|scope|method|legal_status|unknown), explanation,
                usage_suggestion, status (explained|unexplained), relative_diff}
  verdict: {level: High | Medium | Low | "Chưa đủ căn cứ", reason, refused, independent_ab?}   (recomputed by code after review)
}
review_summary: {confirmed, rejected}
memo: null or {question, mode, overall{level, reason}, analyst_review, subs[{id, text, verdict,
       refused_text ("Chưa đủ căn cứ" or null), points[{is_fact, text, claim_ids[], citations[], draft_flag}],
       conflicts[], reference_signals_cd[{claim_id, content, citation}]}], gaps[], key_assumptions[],
       next_steps[], stats, markdown}
memo_status: none | fresh | stale | running | error;  memo_error; memo_generated_at
timing
```

Confidence labels in the UI: High = Cao, Medium = Trung bình, Low = Thấp, "Chưa đủ căn cứ". The `reason` is always shown. `is_fact: false` on a point = "suy luận" (inference), shown with a tag. `draft_flag: true` = the point cites a draft regulation (text already carries the "DỰ THẢO" label).

## Rules for the UI

- A run in `error` shows its `error` text verbatim. The product never invents content to fill a gap.
- A `stale` memo must be shown with a clear warning that it does not reflect the latest review decisions, next to the "Viết lại memo" button.
- "Chưa đủ căn cứ" sub-questions, `unexplained` conflicts, rejected claims and SYNTHETIC labels are always easy to see.
- No access control exists: anyone with the link can start runs and use the deployer's model quota. The limitations page says so.
