import type { ReactNode } from "react";
import type { Answers, Grade, Level, ReviewState, Tier } from "@/lib/api";
import { ANSWERS_VI, GRADE_TONE, TIER_VI, levelVi } from "@/lib/text";

/* Stroke SVG icons (no emoji). All are decorative: the adjacent text carries the meaning. */
type IconName = "check" | "x" | "dashed-circle" | "alert" | "info" | "external" | "flask" | "clock" | "search" | "branch" | "star";

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
    className: "shrink-0",
  };
  switch (name) {
    case "check":
      return <svg {...common}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
    case "x":
      return <svg {...common}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case "dashed-circle":
      return <svg {...common} strokeDasharray="3.5 3"><circle cx="12" cy="12" r="9" /></svg>;
    case "alert":
      return <svg {...common}><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18.2v.1" /></svg>;
    case "info":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.6v.1" /></svg>;
    case "external":
      return <svg {...common}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></svg>;
    case "flask":
      return <svg {...common}><path d="M9 3h6M10 3v6l-5.5 9.5A1.5 1.5 0 005.8 21h12.4a1.5 1.5 0 001.3-2.5L14 9V3" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>;
    case "branch":
      return <svg {...common}><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="9" r="2" /><path d="M6 7v10M18 11c0 4-6 3-11.2 6.6" /></svg>;
    case "star":
      return <svg {...common}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5z" /></svg>;
  }
}

const TONE: Record<string, string> = {
  ok: "bg-ok-bg text-ok-text border-ok-text/40",
  warn: "bg-warn-bg text-warn-text border-warn-border",
  danger: "bg-danger-bg text-danger-text border-danger-text/50",
  neutral: "bg-subtle text-ink border-line",
};

export function toneClass(tone: keyof typeof TONE): string {
  return TONE[tone];
}

/** Label for any SYNTHETIC document. Never optional wherever such a document appears. */
export function SyntheticTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border border-warn-border bg-warn-bg px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-warn-text ${className}`}
      title="Tài liệu tự soạn để thử hệ thống, không phải thị trường thật"
    >
      <Icon name="flask" size={12} />
      SYNTHETIC
    </span>
  );
}

export function GradeBadge({ grade, className = "" }: { grade: Grade; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[13px] font-semibold ${TONE[GRADE_TONE[grade]]} ${className}`}>
      <span className="font-mono">{grade}</span>
      <span>Hạng {grade}</span>
    </span>
  );
}

/**
 * Claim chip: mono ID + grade + state. `review` is the analyst decision; `failedCheck` marks a claim that did not
 * pass the automatic citation check. `selected` inverts to ink fill with white text.
 */
export function ClaimChip({
  id,
  grade,
  review = "none",
  selected = false,
  failedCheck = false,
}: {
  id: string;
  grade?: Grade;
  review?: ReviewState;
  selected?: boolean;
  failedCheck?: boolean;
}) {
  const bad = failedCheck || review === "rejected";
  const base = selected
    ? "bg-ink text-white border-ink"
    : bad
      ? TONE.danger
      : review === "confirmed"
        ? TONE.ok
        : "bg-surface text-ink border-line";
  const gradeCls = selected ? "bg-white text-ink" : grade ? TONE[GRADE_TONE[grade]] : "";
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 rounded-full border px-2 py-0.5 text-[13px] ${base}`}>
      <span className="font-mono font-medium">{id}</span>
      {grade && (
        <span className={`rounded-full border px-1.5 text-[12px] font-semibold ${gradeCls}`}>Hạng {grade}</span>
      )}
      {bad ? (
        <span className="inline-flex items-center gap-0.5 font-medium">
          <Icon name="x" size={13} /> {failedCheck ? "đã loại" : "đã loại khỏi memo"}
        </span>
      ) : review === "confirmed" ? (
        <span className="inline-flex items-center gap-0.5 font-medium">
          <Icon name="check" size={13} /> đã xác nhận
        </span>
      ) : (
        <span className="inline-flex items-center gap-0.5">
          <Icon name="check" size={13} /> đạt kiểm tra trích dẫn
        </span>
      )}
    </span>
  );
}

const LEVEL_TONE: Record<Level, string> = {
  High: TONE.ok,
  Medium: "bg-surface text-ink border-ink",
  Low: TONE.warn,
  "Chưa đủ căn cứ": `${TONE.danger} border-dashed`,
};

export function LevelBadge({ level, className = "" }: { level: Level; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-0.5 text-[13px] font-semibold ${LEVEL_TONE[level]} ${className}`}>
      {level === "Chưa đủ căn cứ" && <Icon name="dashed-circle" size={14} />}
      {level === "Low" && <Icon name="alert" size={14} />}
      Mức: {levelVi(level)}
    </span>
  );
}

const TIER_TONE: Record<Tier, string> = {
  supported: TONE.ok,
  uncertain: TONE.warn,
  refused: `${TONE.danger} border-dashed`,
};

/** Mission 3 tier: "Có thể tin" / "Chưa chắc chắn" / "Chưa có căn cứ". Always text, never colour only. */
export function TierBadge({ tier, className = "" }: { tier: Tier; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-0.5 text-[13px] font-semibold ${TIER_TONE[tier]} ${className}`}>
      <Icon name={tier === "supported" ? "check" : tier === "uncertain" ? "alert" : "dashed-circle"} size={14} />
      {TIER_VI[tier]}
    </span>
  );
}

/** Marks a sub-question that directly answers the original question. */
export function CoreBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border border-accent px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-accent ${className}`}
      title="Câu hỏi con trả lời trực tiếp câu hỏi gốc; nếu nó chưa có căn cứ thì câu hỏi gốc chưa có kết luận"
    >
      <Icon name="star" size={12} />
      câu hỏi con chính
    </span>
  );
}

const ANSWERS_TONE: Record<Answers, string> = {
  direct: TONE.ok,
  partial: TONE.warn,
  context: TONE.neutral,
};

/** How directly a claim answers its sub-question (label by the model, used by code). */
export function AnswersTag({ answers, reason }: { answers: Answers; reason?: string | null }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[12px] font-semibold ${ANSWERS_TONE[answers]}`}
      title={reason ?? undefined}
    >
      {ANSWERS_VI[answers]}
    </span>
  );
}

export function Banner({
  tone = "warn",
  title,
  children,
}: {
  tone?: "warn" | "danger" | "neutral";
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div role="note" className={`flex gap-3 rounded-lg border px-4 py-3 text-[14px] ${TONE[tone]}`}>
      <span className="mt-0.5"><Icon name={tone === "neutral" ? "info" : "alert"} size={18} /></span>
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="label-mono">{children}</p>;
}
