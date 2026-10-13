import type { Claim, Grade, Level, Run } from "./api";

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
};

export const causeVi = (c: string) => CAUSE_VI[c] ?? c;

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

export function formatSeconds(s: number): string {
  return `${s.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} giây`;
}

export const TIMING_LABELS: Record<string, string> = {
  brief_s: "Soạn brief",
  extract_verify_s: "Truy xuất, trích claim, kiểm tra trích dẫn",
  grade_conflict_s: "Chấm hạng và đối soát mâu thuẫn",
};
