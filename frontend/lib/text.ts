import {
  ApiHttpError,
  ApiUnreachableError,
  type Answers,
  type Claim,
  type Grade,
  type Level,
  type MemoStatus,
  type Run,
  type RunStatus,
  type Tier,
} from "./api";

export const LEVEL_ORDER: Level[] = ["Chưa đủ căn cứ", "Low", "Medium", "High"];

export const LEVEL_VI: Record<Level, string> = {
  High: "Cao",
  Medium: "Trung bình",
  Low: "Thấp",
  "Chưa đủ căn cứ": "Chưa đủ căn cứ",
};

export function levelVi(level: string): string {
  return LEVEL_VI[level as Level] ?? level;
}

export const CAUSE_VI: Record<string, string> = {
  definition: "Khác định nghĩa đo",
  year: "Khác năm",
  scope: "Khác phạm vi",
  method: "Khác phương pháp",
  legal_status: "Khác tình trạng pháp lý",
  unknown: "Chưa rõ nguyên nhân",
  // Mission 3 relations decided by code
  revision: "Bản cập nhật thay bản trước",
  stale: "Số liệu cũ",
  weak_dissent: "Nguồn yếu hơn cho số khác",
};

export const causeVi = (c: string) => CAUSE_VI[c] ?? c;

/** Mission 3 trust tiers. */
export const TIER_VI: Record<Tier, string> = {
  supported: "Có thể tin",
  uncertain: "Chưa chắc chắn",
  refused: "Chưa có căn cứ",
};
export const TIER_ORDER: Tier[] = ["supported", "uncertain", "refused"];

/** Same fallback as the backend (memo.py): tier from the level when an older run has no tier. */
export function tierOf(v: { tier?: Tier; level: Level }): Tier {
  if (v.tier) return v.tier;
  return v.level === "High" ? "supported" : v.level === "Chưa đủ căn cứ" ? "refused" : "uncertain";
}

/** Short plain-Vietnamese name of each "uncertain" code; the API's `text` is always shown next to it. */
export const UNCERTAIN_VI: Record<string, string> = {
  single_origin: "Chỉ có 1 nguồn gốc độc lập",
  explained_conflict: "Nguồn mâu thuẫn, đã rõ nguyên nhân",
  unexplained_conflict: "Nguồn mâu thuẫn, chưa rõ nguyên nhân",
  weak_dissent: "Nguồn yếu hơn cho số khác",
  draft: "Dự thảo",
  partial_relevance: "Chỉ trả lời một phần",
};
export const uncertainVi = (c: string) => UNCERTAIN_VI[c] ?? c;

/** History codes: old figures kept only as history, never conclusions. */
export const HISTORY_VI: Record<string, string> = {
  stale: "Số liệu cũ",
  superseded: "Đã có bản cập nhật",
  older_period: "Số kỳ trước",
};
export const historyVi = (c: string) => HISTORY_VI[c] ?? c;

export const ANSWERS_VI: Record<Answers, string> = {
  direct: "trả lời trực tiếp",
  partial: "trả lời một phần",
  context: "chỉ là bối cảnh",
};

/** "kế thừa từ <id>" in reviewed_by: the decision was copied from the parent run. Returns the parent id. */
export function inheritedFrom(reviewedBy: string | null | undefined): string | null {
  const m = reviewedBy?.match(/^kế thừa từ\s+(\S+)/);
  return m ? m[1] : null;
}

/** Core sub-question IDs. An empty list means every sub-question counts as core (backend rule, trust.overall). */
export function coreIds(run: Run): { ids: Set<string>; marked: boolean } {
  const fromMemo = run.memo?.core ?? [];
  const fromBrief = (run.brief?.sub_questions ?? []).filter((q) => q.core).map((q) => q.id);
  const list = fromMemo.length ? fromMemo : fromBrief;
  if (list.length) return { ids: new Set(list), marked: true };
  return { ids: new Set(run.subs.map((s) => s.id)), marked: false };
}

export const GRADE_TONE: Record<Grade, "ok" | "warn" | "danger"> = {
  A: "ok",
  B: "ok",
  C: "warn",
  D: "danger",
};

/** Component names for the "Vì sao hạng X" table, with the ranges from docs/spec/03. */
export const GRADE_COMPONENTS: { key: "source_type" | "freshness" | "methodology" | "conflict_of_interest"; label: string; range: string }[] = [
  { key: "source_type", label: "Loại nguồn", range: "0 đến 4" },
  { key: "freshness", label: "Độ mới của dữ liệu", range: "0 đến 3" },
  { key: "methodology", label: "Phương pháp nêu rõ", range: "0 đến 2" },
  { key: "conflict_of_interest", label: "Xung đột lợi ích", range: "0 hoặc -2" },
];

export const SOURCE_TYPE_VI: Record<string, string> = {
  legal_primary: "văn bản pháp luật gốc",
  industry_report: "báo cáo ngành",
  press: "báo chí",
  press_repost: "báo chí đăng lại",
  press_release: "thông cáo báo chí",
  vendor_blog: "blog của nhà cung cấp",
  internal: "nội bộ",
};
export const sourceTypeVi = (t: string) => SOURCE_TYPE_VI[t] ?? t;

/** Translate the code-generated rejection reasons; the original is always shown next to it. */
export function rejectionReasonVi(reason: string): string {
  if (reason.startsWith("passage is not a verbatim quote")) {
    return "Đoạn trích không phải là nguyên văn của bất kỳ đoạn tài liệu nào đã truy xuất.";
  }
  const num = reason.match(/^number \[(.*)\] not in passage/);
  if (num) return `Con số ${num[1]} trong claim không có trong đoạn trích.`;
  const ent = reason.match(/^entity '(.*)' not in passage/);
  if (ent) return `Tên riêng '${ent[1]}' trong claim không có trong đoạn trích.`;
  return "Claim không qua kiểm tra trích dẫn tự động.";
}

export function claimTypeVi(t: string): string {
  if (t === "fact") return "sự kiện";
  if (t === "estimate") return "ước tính";
  if (t === "opinion") return "ý kiến";
  return t;
}

/** Render a date field from sources.csv; empty means "not stated", never invented. */
export function dateOrUnknown(v: string | null | undefined): string {
  return v && v.trim() ? v : "không ghi";
}

export function claimIndex(run: Run): Map<string, Claim> {
  const m = new Map<string, Claim>();
  for (const s of run.subs) for (const c of s.claims) m.set(c.claim_id, c);
  return m;
}

/** "<br>" and inline bullets from LLM text become separate lines. */
export function splitBullets(text: string): string[] {
  const t = text.replace(/<br\s*\/?>/gi, "\n");
  const parts = t
    .split(/\n|\s•\s|^•\s?/)
    .map((p) => p.replace(/^[•\-*]\s*/, "").trim())
    .filter(Boolean);
  return parts;
}

export const RUN_STATUS_VI: Record<RunStatus, string> = {
  queued: "Đang chờ",
  running: "Đang chạy",
  done: "Hoàn tất",
  error: "Lỗi",
  needs_clarification: "Cần làm rõ câu hỏi",
};

export const MEMO_STATUS_VI: Record<MemoStatus, string> = {
  none: "Chưa có memo",
  fresh: "Memo mới nhất",
  stale: "Memo chưa phản ánh duyệt gần nhất",
  running: "Đang viết lại memo",
  error: "Viết memo bị lỗi",
};

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "không ghi";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "không ghi";
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** "m:ss" from a number of seconds. */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Plain Vietnamese text for an error thrown by the API client; server messages are kept verbatim. */
export function errorText(e: unknown): string {
  if (e instanceof ApiUnreachableError) return "Không kết nối được máy chủ. Thao tác chưa được thực hiện.";
  if (e instanceof ApiHttpError) return `${e.detail} (HTTP ${e.status})`;
  return "Lỗi không xác định.";
}
