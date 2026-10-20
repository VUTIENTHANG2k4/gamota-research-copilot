// Typed client for the FastAPI backend (contract: docs/api.md).
// The UI reads data ONLY from this API. It never calls OpenRouter and holds no API keys.

import { clearSession, currentSession, redirectToLogin, type Session } from "./auth";

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
  created_by: string | null;
  status: RunStatus;
  stage: string;
  error: string | null;
  created_at: string;
  finished_at: string | null;
  memo_status: MemoStatus;
  has_result: boolean;
}

/** Mission 3 trust tier of a sub-question (computed by code). */
export type Tier = "supported" | "uncertain" | "refused";
/** How directly a claim answers its sub-question (Mission 3; missing on older runs). */
export type Answers = "direct" | "partial" | "context";

export interface SubQuestion {
  id: string;
  text: string;
  search_query?: string;
  search_query_en?: string;
  evidence_type?: string;
  /** true = directly answers the original question ("câu hỏi con chính"). Missing on older runs. */
  core?: boolean;
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
  /** Username, or "kế thừa từ <run id>" when the decision was inherited from the parent run. */
  reviewed_by?: string | null;
  answers?: Answers | null;
  answers_reason?: string | null;
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
  /** Mission 3: who decided the relation. "code" = from dates and grades, "llm" = cause labelled by the model. */
  decided_by?: "code" | "llm";
}

export type UncertainCode =
  | "single_origin"
  | "explained_conflict"
  | "unexplained_conflict"
  | "weak_dissent"
  | "draft"
  | "partial_relevance";
export type HistoryCode = "stale" | "superseded" | "older_period";

export interface UncertainItem {
  code: UncertainCode | string;
  text: string;
  claim_ids: string[];
}

export interface HistoryItem {
  code: HistoryCode | string;
  claim_id: string;
  text: string;
  data_date: string;
}

export interface Verdict {
  level: Level;
  reason: string;
  refused?: boolean;
  independent_ab?: number;
  // Mission 3 (computed by code; missing on older runs)
  tier?: Tier;
  main?: string[];
  uncertain?: UncertainItem[];
  history?: HistoryItem[];
  next_steps?: string[];
  codes?: string[];
}

export interface Retrieved {
  chunk_id: string;
  source_id: string;
  page: number;
  score: number;
}

export interface Sub {
  id: string;
  text: string;
  retrieved: Retrieved[];
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

export interface MemoClaimRef {
  claim_id: string;
  content: string;
  citation: string;
}

export interface MemoSub {
  id: string;
  text: string;
  verdict: Verdict;
  refused_text: string | null;
  points: MemoPoint[];
  conflicts: Conflict[];
  reference_signals_cd: MemoClaimRef[];
  // Mission 3 (missing on older memos)
  tier?: Tier;
  main_evidence?: MemoClaimRef[];
  uncertain?: (UncertainItem & { claims?: MemoClaimRef[] })[];
  history?: (HistoryItem & { content: string; citation: string })[];
  next_steps?: string[];
}

export interface MemoFollowup {
  parent_id: string;
  parent_question: string;
  /** false = the model judged the new question unrelated to the parent: nothing was inherited. */
  related: boolean;
  /** false = the user dropped the inherited context before asking. */
  inherit: boolean;
  /** Number of review decisions copied from the parent. */
  inherited: number;
}

export interface Memo {
  question: string;
  overall: { level: Level; reason: string; refused?: boolean };
  subs: MemoSub[];
  gaps: string[];
  key_assumptions: string[];
  /** Mission 3: "where to look next", each prefixed by the sub-question ID. */
  next_steps: string[];
  stats?: { llm_fact?: number; llm_fact_supported?: number; demoted?: number };
  // Mission 3 (missing on older memos)
  tiers?: Record<Tier, string[]>;
  core?: string[];
  followup?: MemoFollowup | null;
}

/** What a follow-up run inherited from its parent ("bối cảnh kế thừa"). */
export interface RunContext {
  parent_id: string;
  parent_question: string;
  inherit: boolean;
  decision?: string;
  scope?: string;
  gaps?: string[];
  rejected_claims?: string[];
  confirmed_claims?: string[];
  rejected_sources?: string[];
}

export interface Run {
  id: string;
  question: string;
  parent_id: string | null;
  created_by: string | null;
  /** Mission 3: set only on a follow-up run. */
  context?: RunContext | null;
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

function authHeaders(): Record<string, string> {
  const s = currentSession();
  return s ? { Authorization: `Bearer ${s.token}` } : {};
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      cache: "no-store",
      ...init,
      headers: { ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) },
    });
  } catch {
    throw new ApiUnreachableError();
  }
  if (res.status === 401 && path !== "/api/auth/login") {
    // missing or expired session: sign in again, then come back here
    clearSession();
    redirectToLogin();
  }
  return res;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await send(path, init);
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
  authConfig: () => request<{ enabled: boolean }>("/api/auth/config"),
  login: (username: string, password: string) =>
    sendJson<Session>("POST", "/api/auth/login", { username, password }),
  health: () => request<Health>("/api/health"),
  about: () => request<About>("/api/about"),
  runs: () => request<RunSummary[]>("/api/runs"),
  run: (id: string) => request<Run>(`/api/runs/${enc(id)}`),
  startRun: (question: string) => sendJson<{ id: string }>("POST", "/api/runs", { question }),
  deleteRun: (id: string) => sendJson<{ deleted: string }>("DELETE", `/api/runs/${enc(id)}`),
  clarify: (id: string, answer: string) => sendJson<{ id: string }>("POST", `/api/runs/${enc(id)}/clarify`, { answer }),
  /** Mission 3: continue the research from a finished run. `inherit=false` drops the inherited context. */
  followup: (id: string, question: string, inherit: boolean) =>
    sendJson<{ id: string }>("POST", `/api/runs/${enc(id)}/followup`, { question, inherit }),
  sources: () => request<SourceMeta[]>("/api/sources"),
  review: (id: string, claimId: string, state: ReviewState) =>
    sendJson<Run>("PUT", `/api/runs/${enc(id)}/claims/${enc(claimId)}/review`, { state }),
  rewriteMemo: (id: string) => sendJson<{ id: string }>("POST", `/api/runs/${enc(id)}/memo`),
  chunk: (id: string) => request<ChunkResponse>(`/api/chunks/${enc(id)}`),
  /** Word export needs the session header, so it is fetched and saved instead of opened as a plain link. */
  downloadDocx: async (id: string) => {
    const res = await send(`/api/runs/${enc(id)}/export.docx`);
    if (!res.ok) {
      let detail = res.statusText;
      try {
        detail = (await res.json())?.detail ?? detail;
      } catch {
        /* keep statusText */
      }
      throw new ApiHttpError(res.status, String(detail));
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `memo-${id}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
