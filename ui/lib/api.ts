// Typed client for the FastAPI backend (contract: docs/api.md).
// The UI reads data ONLY from this API. It never calls OpenRouter and holds no API keys.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export type Level = "High" | "Medium" | "Low" | "Chưa đủ căn cứ";
export type Grade = "A" | "B" | "C" | "D";
export type RunStatus = "queued" | "running" | "done" | "error" | "needs_clarification";
export type MemoStatus = "none" | "fresh" | "stale" | "running" | "error";
export type ReviewState = "none" | "confirmed" | "rejected";

export interface RunSummary {
  id: string;
  question: string;
  parent_id: string | null;
  status: RunStatus;
  stage: string;
  error: string | null;
  created_at: string;
  finished_at: string | null;
  memo_status: MemoStatus;
  has_result: boolean;
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
  scope: string | null;
  claim_type: string;
  passage: string;
  chunk_id: string;
  source_id: string;
  is_synthetic: boolean;
  grade: Grade;
  grade_detail: GradeDetail;
  origin_group: string | null;
  src_data_date: string;
  src_publish_date: string;
  review: ReviewState;
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
  verdict: Verdict;
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
  overall: { level: Level; reason: string };
  subs: MemoSub[];
  gaps: string[];
  key_assumptions: string[];
  next_steps: string[];
  stats?: { llm_fact?: number; llm_fact_supported?: number; demoted?: number };
}

export interface Run {
  id: string;
  question: string;
  parent_id: string | null;
  created_at: string;
  finished_at: string | null;
  status: RunStatus;
  stage: string;
  error: string | null;
  brief: Brief | null;
  subs: Sub[];
  review_summary: { confirmed: number; rejected: number };
  memo: Memo | null;
  memo_status: MemoStatus;
  memo_error: string | null;
  memo_generated_at: string | null;
  timing?: Record<string, number>;
}

export interface ChunkResponse {
  chunk_id: string;
  source_id: string;
  page: number;
  text: string;
  source: Partial<SourceMeta>;
}

export interface Health {
  status: string;
  mode: string;
  corpus: { state: "starting" | "ingesting" | "ready" | "error"; chunks: number; error: string | null };
}

export interface About {
  corpus: { documents: number; synthetic: number; real: number };
  limitations: string[];
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

function sendJson<T>(method: string, path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const enc = encodeURIComponent;

export const api = {
  health: () => request<Health>("/api/health"),
  about: () => request<About>("/api/about"),
  runs: () => request<RunSummary[]>("/api/runs"),
  run: (id: string) => request<Run>(`/api/runs/${enc(id)}`),
  startRun: (question: string) => sendJson<{ id: string }>("POST", "/api/runs", { question }),
  deleteRun: (id: string) => sendJson<{ deleted: string }>("DELETE", `/api/runs/${enc(id)}`),
  clarify: (id: string, answer: string) => sendJson<{ id: string }>("POST", `/api/runs/${enc(id)}/clarify`, { answer }),
  review: (id: string, claimId: string, state: ReviewState) =>
    sendJson<Run>("PUT", `/api/runs/${enc(id)}/claims/${enc(claimId)}/review`, { state }),
  rewriteMemo: (id: string) => sendJson<{ id: string }>("POST", `/api/runs/${enc(id)}/memo`),
  chunk: (id: string) => request<ChunkResponse>(`/api/chunks/${enc(id)}`),
  exportDocxUrl: (id: string) => `${API_URL}/api/runs/${enc(id)}/export.docx`,
};
