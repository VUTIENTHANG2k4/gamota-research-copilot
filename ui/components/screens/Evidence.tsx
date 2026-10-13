"use client";

import Link from "next/link";
import { useRun } from "@/components/RunProvider";
import { Banner, SyntheticTag, ClaimChip, LevelBadge, SectionLabel, Icon } from "@/components/ui";
import { EmptyState } from "@/components/states";
import { SyntheticNote } from "@/components/SyntheticNote";
import { Workspace, useClaimSelection } from "@/components/Workspace";
import type { Claim, RejectedClaim, Sub } from "@/lib/api";
import { claimTypeVi, dateOrUnknown, rejectionReasonVi } from "@/lib/text";

function ClaimRow({ claim }: { claim: Claim }) {
  const { selectedId, select } = useClaimSelection();
  const selected = selectedId === claim.claim_id;
  return (
    <li>
      <button
        type="button"
        onClick={() => select(claim.claim_id)}
        aria-pressed={selected}
        className={`w-full cursor-pointer rounded-lg border p-3 text-left ${
          selected
            ? "border-ink bg-subtle shadow-[inset_4px_0_0_var(--color-ink)]"
            : claim.review === "rejected"
              ? "border-danger-text/60 bg-danger-bg/40 hover:border-danger-text"
              : "border-line bg-surface hover:border-accent"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <ClaimChip id={claim.claim_id} grade={claim.grade} review={claim.review} selected={selected} />
          {claim.is_synthetic && <SyntheticTag />}
          {claim.claim_type !== "fact" && (
            <span className="rounded border border-dashed border-ink px-1.5 font-mono text-[11px] uppercase tracking-[0.06em]">
              {claimTypeVi(claim.claim_type)}
            </span>
          )}
        </div>
        <p className="mt-2 text-[15px]">{claim.content}</p>
        <p className="mt-1 text-[13px] text-muted">
          Nguồn <span className="font-mono">{claim.source_id}</span>: {claim.source.title} · dữ liệu{" "}
          {dateOrUnknown(claim.src_data_date)}
        </p>
      </button>
    </li>
  );
}

function RejectedRow({ c }: { c: RejectedClaim }) {
  return (
    <li className="rounded-lg border border-danger-text/50 bg-danger-bg p-3 text-danger-text">
      <div className="flex flex-wrap items-center gap-2">
        <ClaimChip id="claim bị loại" failedCheck />
        {c.source_id && <span className="font-mono text-[13px]">{c.source_id}</span>}
        {c.is_synthetic && <SyntheticTag />}
      </div>
      <p className="mt-2 text-[15px] text-ink">{c.content}</p>
      <p className="mt-1 text-[14px] font-semibold">Lý do loại: {rejectionReasonVi(c.reason)}</p>
      <p className="font-mono text-[12px] opacity-90">mã lý do: {c.reason}</p>
      {c.passage && (
        <blockquote className="mt-2 rounded border border-danger-text/30 bg-surface p-2 text-[14px] text-ink">
          <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Đoạn mô hình đã trích: </span>
          {c.passage}
        </blockquote>
      )}
    </li>
  );
}

function SubSection({ sub }: { sub: Sub }) {
  const { openedVerdicts } = useRun();
  const opened = openedVerdicts[sub.id];
  const moved = opened && opened.level !== sub.verdict.level;
  const rejectedByReview = sub.claims.filter((c) => c.review === "rejected").length;
  return (
    <section className="card" aria-labelledby={`sub-${sub.id}`}>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="label-mono">{sub.id}</span>
        <span className="text-[13px] text-muted">
          đã truy xuất {sub.retrieved.length} đoạn · {sub.claims.length} claim đạt kiểm tra trích dẫn
          {rejectedByReview > 0 && <> ({rejectedByReview} đã loại khỏi memo)</>} · {sub.rejected_claims.length} claim bị loại ở bước kiểm tra
        </span>
      </div>
      <h2 id={`sub-${sub.id}`} className="mt-1 text-[18px] font-semibold leading-snug">{sub.text}</h2>

      <div className="mt-3 space-y-2 text-[14px]">
        <p className="flex flex-wrap items-center gap-2">
          <LevelBadge level={sub.verdict.level} />
          <span><strong>Vì sao:</strong> {sub.verdict.reason}</span>
        </p>
        {moved && (
          <div role="status" className="rounded-lg border-2 border-warn-border bg-warn-bg p-3 text-warn-text">
            <p className="font-semibold">Mức chắc chắn đã đổi sau quyết định duyệt của bạn (code tính lại)</p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5">
              Khi mở trang: <LevelBadge level={opened.level} /> <span aria-hidden>→</span> hiện tại: <LevelBadge level={sub.verdict.level} />
            </p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <SectionLabel>Claim đạt kiểm tra trích dẫn ({sub.claims.length})</SectionLabel>
        {sub.claims.length === 0 ? (
          <div className="mt-2">
            <EmptyState title="Chưa có claim hợp lệ cho câu hỏi con này">
              Không có claim nào qua kiểm tra trích dẫn. Hệ thống không điền số liệu thay thế.
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {sub.claims.map((c) => <ClaimRow key={`${c.claim_id}`} claim={c} />)}
          </ul>
        )}
      </div>

      {sub.rejected_claims.length > 0 && (
        <div className="mt-5">
          <SectionLabel>Claim bị loại ở bước kiểm tra trích dẫn ({sub.rejected_claims.length})</SectionLabel>
          <ul className="mt-2 space-y-2">
            {sub.rejected_claims.map((c, i) => <RejectedRow key={i} c={c} />)}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function EvidencePage() {
  const { run } = useRun();

  if (run.status === "needs_clarification" || run.subs.length === 0) {
    return (
      <EmptyState title="Chưa có bằng chứng cho lần chạy này">
        {run.status === "needs_clarification"
          ? "Câu hỏi cần làm rõ nên chưa truy xuất tài liệu nào. Trả lời ở bước Brief."
          : "Máy chủ không trả về câu hỏi con nào."}
      </EmptyState>
    );
  }

  const valid = run.subs.flatMap((s) => s.claims);
  const rejected = run.subs.reduce((n, s) => n + s.rejected_claims.length, 0);
  const synth = valid.filter((c) => c.is_synthetic).length;
  const { confirmed, rejected: removed } = run.review_summary;

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <SectionLabel>Bước 2: Kho bằng chứng</SectionLabel>
        <h1 className="mt-1 text-[26px] font-semibold leading-[1.35] tracking-[-0.015em]">Kho bằng chứng</h1>
        <p className="mt-2 text-muted">
          Mỗi <strong>claim</strong> (một khẳng định trích từ tài liệu) kèm hạng nguồn A đến D. Bấm vào claim để xem đoạn
          gốc bên cạnh, rồi <strong>Xác nhận</strong> hoặc <strong>Loại khỏi memo</strong>. Mức chắc chắn của từng câu hỏi
          con được code tính lại ngay sau mỗi quyết định; memo chỉ đổi khi bạn viết lại memo.
        </p>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[14px]">
          <span><strong className="tabular">{valid.length}</strong> claim đạt kiểm tra trích dẫn</span>
          <span className="inline-flex items-center gap-1 font-semibold text-danger-text">
            <Icon name="x" size={14} /> <span className="tabular">{rejected}</span> claim bị loại ở bước kiểm tra
          </span>
          <span><strong className="tabular">{synth}</strong> claim từ tài liệu SYNTHETIC</span>
        </p>
        <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[14px]" aria-label="Tóm tắt duyệt">
          <span className="font-semibold text-ok-text"><span className="tabular">{confirmed}</span> claim đã xác nhận</span>
          <span className="font-semibold text-danger-text"><span className="tabular">{removed}</span> claim đã loại khỏi memo</span>
        </p>
      </div>

      <SyntheticNote />

      {run.memo_status === "stale" && (
        <Banner tone="warn" title="Memo chưa phản ánh các thay đổi duyệt gần nhất">
          <Link href={`/runs/${encodeURIComponent(run.id)}/memo`} className="font-semibold underline">Đến bước Memo</Link> để viết lại.
        </Banner>
      )}

      <Workspace run={run}>
        <div className="space-y-6">
          {run.subs.map((s) => <SubSection key={s.id} sub={s} />)}
        </div>
      </Workspace>
    </div>
  );
}
