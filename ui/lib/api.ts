// Typed client for the FastAPI backend (contract: docs/api.md).
// The UI reads data ONLY from this API. It never calls OpenRouter and holds no API keys.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export type Level = "High" | "Medium" | "Low" | "Chưa đủ căn cứ";
export type Grade = "A" | "B" | "C" | "D";

export interface RunSummary {
  key: string;
  label: string;
  question: string;
  origin: "saved" | "live";
  origin_note: string;
}

export interface SubQuestion {
  id: string;
  text: string;
  search_query?: string;
  search_query_en?: string;
  evidence_type?: string;
}

export interface Brief {
  decision: string;
  scope: string;
  needs_clarification: boolean;
  sub_questions: SubQuestion[];
  clarifying_questions: string[];
}

export interface SourceMeta {
  id: string;
  title: string;
  url: string;
  source_type: string;
  org: string;
  publish_date: string;
  data_date: string;
  has_methodology: string | boolean;
  conflict_of_interest_note: string;
  cites_origin: string;
  is_synthetic: boolean;
}

export interface GradeDetail {
  score: number;
  grade?: Grade;
  kind?: string;
  components: {
    source_type: number;
    freshness: number;
    methodology: number;
    conflict_of_interest: number;
  };
  freshness_note?: string;
}

export interface Claim {
  claim_id: string;
  content: string;
  value: number | string | null;
  unit: string | null;
  scope: string | null;
  data_date: string | null;
  claim_type: string;
  passage: string;
  chunk_id: string;
  source_id: string;
  is_synthetic: boolean;
  grade: Grade;
  grade_detail: GradeDetail;
  origin_group: string | null;
  source_type: string;
  src_data_date: string;
  src_publish_date: string;
  source: SourceMeta;
}

export interface RejectedClaim {
  content: string;
  passage: string;
  reason: string;
  source_id: string | null;
  is_synthetic: boolean | null;
}

export interface Conflict {
  claim_a: string;
  claim_b: string;
  cause: string;
  llm_cause?: string;
  recheck?: string;
  explanation: string;
  usage_suggestion: string;
  status: "explained" | "unexplained";
  relative_diff?: number;
  synthetic_involved?: boolean;
}

export interface Verdict {
  level: Level;
  reason: string;
  refused?: boolean;
  independent_ab?: number;
}

export interface Sub {
  id: string;
  text: string;
  retrieved: { chunk_id: string; source_id: string; page: number; score: number }[];
  claims: Claim[];
  rejected_claims: RejectedClaim[];
  conflicts: Conflict[];
  verdict_real_only: Verdict;
  verdict_with_synthetic: Verdict;
}

export interface MemoPoint {
  sub_id?: string;
  is_fact: boolean;
  text: string;
  claim_ids: string[];
  citations: string[];
  draft_flag: boolean;
}

export interface MemoSub {
  id: string;
  text: string;
  verdict: Verdict;
  refused_text: string | null;
  points: MemoPoint[];
  conflicts: Conflict[];
  reference_signals_cd: { claim_id: string; content: string; citation: string }[];
}

export interface Memo {
  question: string;
  mode: "real" | "test";
  overall: { level: Level; reason: string };
  analyst_review: string;
  subs: MemoSub[];
  gaps: string[];
  key_assumptions: string[];
  next_steps: string[];
  stats?: { llm_fact?: number; llm_fact_supported?: number; demoted?: number };
}

export interface Run {
  key: string;
  question: string;
  needs_clarification: boolean;
  brief: Brief;
  subs: Sub[];
  memo_real: Memo | null;
  memo_test: Memo | null;
  baseline: { question: string; answer: string; latency_s: number } | null;
  timing?: Record<string, number>;
}

export interface ChunkResponse {
  chunk_id: string;
  source_id: string;
  page: number;
  text: string;
  source: Partial<SourceMeta>;
}

export interface Job {
  status: "running" | "done" | "error";
  stage: string;
  key: string;
  question: string;
  error?: string;
}

export interface TestResults {
  report_file: string;
  title: string;
  summary_markdown: string;
  scenario_table_header: string[];
  scenario_table: string[][];
  scenario_details_markdown: string;
  metrics_markdown: string;
  metrics_table: string[][];
  baseline_markdown: string;
  limitations_of_suite_markdown: string;
  machine_scores: unknown;
}

export interface Limitations {
  report_file: string;
  defects_markdown: string;
  not_testable_markdown: string;
  defects_from_progress: string;
  not_checked: string;
  fixed_statements: string[];
}

/** Backend not reachable at all (not started, wrong URL, CORS). */
export class ApiUnreachableError extends Error {
  constructor() {
    super("API unreachable");
    this.name = "ApiUnreachableError";
  }
}

/** Backend answered with a non-2xx status. `detail` is the Vietnamese message from FastAPI. */
export class ApiHttpError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`HTTP ${status}: ${detail}`);
    this.name = "ApiHttpError";
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { cache: "no-store", ...init });
  } catch {
    throw new ApiUnreachableError();
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
      else if (body?.detail) detail = JSON.stringify(body.detail);
    } catch {
      /* body is not JSON: keep statusText */
    }
    throw new ApiHttpError(res.status, detail);
  }
  return (await res.json()) as T;
}

export const api = {
  runs: () => request<RunSummary[]>("/api/runs"),
  run: (key: string) => request<Run>(`/api/runs/${encodeURIComponent(key)}`),
  chunk: (id: string) => request<ChunkResponse>(`/api/chunks/${encodeURIComponent(id)}`),
  startRun: (question: string) =>
    request<{ job_id: string; key: string }>("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }),
  job: (id: string) => request<Job>(`/api/jobs/${encodeURIComponent(id)}`),
  testResults: () => request<TestResults>("/api/test-results"),
  limitations: () => request<Limitations>("/api/limitations"),
};
