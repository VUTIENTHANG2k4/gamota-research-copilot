"use client";

import { useState } from "react";
import Link from "next/link";
import { useRun } from "@/components/RunProvider";
import { AnswersTag, Banner, CoreBadge, SyntheticTag, ClaimChip, LevelBadge, SectionLabel, Icon, TierBadge } from "@/components/ui";
import { EmptyState, Loading } from "@/components/states";
import { SyntheticNote } from "@/components/SyntheticNote";
import { FollowupBanner } from "@/components/Followup";
import { Workspace, useClaimSelection } from "@/components/Workspace";
import { api, type Claim, type RejectedClaim, type Retrieved, type SourceMeta, type Sub } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { ANSWERS_VI, claimTypeVi, coreIds, dateOrUnknown, errorText, historyVi, inheritedFrom, rejectionReasonVi, tierOf } from "@/lib/text";

type SourceMap = Map<string, SourceMeta> | null;

function ClaimRow({ claim, sub }: { claim: Claim; sub: Sub }) {
  const { selectedId, select } = useClaimSelection();
  const selected = selectedId === claim.claim_id;
  const parent = inheritedFrom(claim.reviewed_by);
  const isMain = (sub.verdict.main ?? []).includes(claim.claim_id);
  const hist = (sub.verdict.history ?? []).find((h) => h.claim_id === claim.claim_id);
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
          {claim.answers && <AnswersTag answers={claim.answers} reason={claim.answers_reason} />}
          {isMain && (
            <span className="inline-flex items-center gap-1 rounded border border-ok-text/40 bg-ok-bg px-1.5 py-0.5 text-[12px] font-semibold text-ok-text">
              <Icon name="check" size={12} /> bằng chứng chính
            </span>
          )}
          {hist && (
            <span className="inline-flex items-center gap-1 rounded border border-dashed border-ink/70 bg-subtle px-1.5 py-0.5 text-[12px] font-semibold">
              <Icon name="clock" size={12} /> lịch sử: {historyVi(hist.code)}, dữ liệu {hist.data_date}
            </span>
          )}
        </div>
        <p className="mt-2 text-[15px]">{claim.content}</p>
        <p className="mt-1 text-[13px] text-muted">
          Nguồn <span className="font-mono">{claim.source_id}</span>: {claim.source.title} · dữ liệu{" "}
          {dateOrUnknown(claim.src_data_date)}
        </p>
        {claim.answers && claim.answers_reason && (
          <p className="mt-1 text-[13px]">
            <span className="font-semibold">Vì sao &quot;{ANSWERS_VI[claim.answers]}&quot; (AI gán nhãn): </span>
            <span className="text-muted">{claim.answers_reason}</span>
          </p>
        )}
        {parent && (
          <p className="mt-1 inline-flex items-center gap-1 rounded border border-accent/60 px-1.5 py-0.5 text-[13px] font-medium text-accent">
            <Icon name="branch" size={13} /> Quyết định {claim.review === "rejected" ? "loại" : "xác nhận"} kế thừa từ lần chạy{" "}
            <span className="font-mono">{parent}</span>
          </p>
        )}
      </button>
    </li>
  );
}

/** Full text of a retrieved passage, loaded on demand. */
function ChunkPreview({ chunkId }: { chunkId: string }) {
  const { state, reload } = useApi(() => api.chunk(chunkId), chunkId);
  if (state.status === "loading") return <Loading what="đoạn tài liệu" />;
  if (state.status === "error")
    return (
      <div role="alert" className="rounded border border-danger-text/50 bg-danger-bg p-2 text-[13px] text-danger-text">
        Không tải được đoạn: {errorText(state.error)}{" "}
        <button type="button" className="font-semibold underline" onClick={reload}>Thử lại</button>
      </div>
    );
  return <p className="max-h-56 overflow-auto whitespace-pre-wrap rounded border border-line bg-surface p-2 text-[13.5px]">{state.data.text}</p>;
}

function RetrievedRow({ r, src, claimCount }: { r: Retrieved; src: SourceMeta | undefined; claimCount: number }) {
  const [open, setOpen] = useState(false);
  const synthetic = src?.is_synthetic ?? r.source_id.startsWith("SYN");
  return (
    <li className="rounded border border-line bg-surface p-2 text-[14px]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-mono font-medium">{r.source_id}</span>
        {synthetic && <SyntheticTag />}
        <span className="min-w-0 break-words">{src?.title ?? "(không đọc được tên tài liệu)"}</span>
      </div>
      <p className="mt-0.5 text-[13px] text-muted">
        trang {r.page} · điểm khớp từ khóa <span className="tabular">{r.score.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}</span>
        {" · "}
        {claimCount > 0 ? (
          <span className="font-semibold text-ink">{claimCount} claim đạt kiểm tra từ đoạn này</span>
        ) : (
          <span className="font-semibold text-ink">không có claim nào đạt kiểm tra từ đoạn này</span>
        )}
        {src?.data_date ? <> · dữ liệu {src.data_date}</> : null}
      </p>
      <button type="button" className="mt-1 text-[13px] font-semibold text-accent underline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? "Ẩn đoạn" : "Đọc đoạn này"} (<span className="font-mono">{r.chunk_id}</span>)
      </button>
      {open && <div className="mt-1"><ChunkPreview chunkId={r.chunk_id} /></div>}
    </li>
  );
}

/** What retrieval returned for a sub-question, so the user can tell "the corpus has nothing" from "may have missed it". */
function Searched({ sub, sources, query, refused }: { sub: Sub; sources: SourceMap; query?: string; refused: boolean }) {
  const docs = new Set(sub.retrieved.map((r) => r.source_id));
  const perChunk = new Map<string, number>();
  for (const c of sub.claims) perChunk.set(c.chunk_id, (perChunk.get(c.chunk_id) ?? 0) + 1);
  const body = (
    <div className="mt-2 space-y-2">
      {query && (
        <p className="text-[13px]">
          <span className="text-muted">Từ khóa đã tìm (AI lập trong brief): </span>
          <span className="font-mono">{query}</span>
        </p>
      )}
      {sub.retrieved.length === 0 ? (
        <p className="font-medium">Không truy xuất được đoạn nào cho câu hỏi con này.</p>
      ) : (
        <ol className="space-y-1.5">
          {sub.retrieved.map((r) => (
            <RetrievedRow key={r.chunk_id} r={r} src={sources?.get(r.source_id)} claimCount={perChunk.get(r.chunk_id) ?? 0} />
          ))}
        </ol>
      )}
    </div>
  );
  const title = `Hệ thống đã tìm những gì: ${sub.retrieved.length} đoạn từ ${docs.size} tài liệu`;
  if (refused) {
    return (
      <div className="mt-5 rounded-lg border-[1.5px] border-dashed border-danger-text bg-subtle p-3">
        <p className="flex items-center gap-1.5 font-semibold"><Icon name="search" size={16} /> {title}</p>
        {body}
      </div>
    );
  }
  return (
    <details className="mt-5 rounded-lg border border-line bg-subtle p-3">
      <summary className="cursor-pointer font-semibold">{title}</summary>
      {body}
    </details>
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

function SubSection({ sub, core, sources }: { sub: Sub; core: boolean; sources: SourceMap }) {
  const { run, openedVerdicts } = useRun();
  const opened = openedVerdicts[sub.id];
  const moved = opened && opened.level !== sub.verdict.level;
  const rejectedByReview = sub.claims.filter((c) => c.review === "rejected").length;
  const refused = sub.verdict.level === "Chưa đủ căn cứ";
  const hasTier = !!sub.verdict.tier;
  const query = run.brief?.sub_questions.find((q) => q.id === sub.id)?.search_query;
  const labelled = sub.claims.filter((c) => c.answers).length;
  const synthCount = sub.claims.filter((c) => c.is_synthetic).length;
  return (
    <section id={`sub-${sub.id}`} className="card scroll-mt-4" aria-labelledby={`sub-h-${sub.id}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="label-mono">{sub.id}</span>
        {core && <CoreBadge />}
        <span className="text-[13px] text-muted">
          đã truy xuất {sub.retrieved.length} đoạn · {sub.claims.length} claim đạt kiểm tra trích dẫn
          {rejectedByReview > 0 && <> ({rejectedByReview} đã loại khỏi memo)</>} · {sub.rejected_claims.length} claim bị loại ở bước kiểm tra
        </span>
      </div>
      <h2 id={`sub-h-${sub.id}`} className="mt-1 text-[18px] font-semibold leading-snug">{sub.text}</h2>

      <div className="mt-3 space-y-2 text-[14px]">
        <p className="flex flex-wrap items-center gap-2">
          {hasTier && <TierBadge tier={tierOf(sub.verdict)} />}
          <LevelBadge level={sub.verdict.level} />
          <span><strong>Vì sao:</strong> {sub.verdict.reason}</span>
        </p>
        {synthCount > 0 && (
          <p className="text-[13px] font-medium text-warn-text">
            Mức này chỉ tính tài liệu thật: {synthCount} claim SYNTHETIC bên dưới không được dùng để kết luận.
          </p>
        )}
        {sub.claims.length > 0 && labelled === 0 && (
          <p className="text-[13px] text-muted">
            Các claim ở đây chưa có nhãn mức liên quan (trả lời trực tiếp / một phần / bối cảnh): lần chạy dùng phiên bản cũ.
          </p>
        )}
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
            {sub.claims.map((c) => <ClaimRow key={`${c.claim_id}`} claim={c} sub={sub} />)}
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

      <Searched sub={sub} sources={sources} query={query} refused={refused} />
    </section>
  );
}

export default function EvidencePage() {
  const { run } = useRun();
  const { state: srcState } = useApi(() => api.sources(), "sources");
  const sources: SourceMap = srcState.status === "ok" ? new Map(srcState.data.map((s) => [s.id, s])) : null;
  const { ids: core, marked: coreMarked } = coreIds(run);

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

      {synth > 0 && <SyntheticNote compact />}

      <FollowupBanner run={run} />

      {srcState.status === "error" && (
        <Banner tone="warn" title="Không đọc được danh sách nguồn">
          Danh sách &quot;hệ thống đã tìm những gì&quot; chỉ hiện mã nguồn, không có tên tài liệu ({errorText(srcState.error)}).
          Tài liệu có mã bắt đầu bằng SYN vẫn được gắn nhãn SYNTHETIC.
        </Banner>
      )}

      {run.memo_status === "stale" && (
        <Banner tone="warn" title="Memo chưa phản ánh các thay đổi duyệt gần nhất">
          <Link href={`/runs/${encodeURIComponent(run.id)}/memo`} className="font-semibold underline">Đến bước Memo</Link> để viết lại.
        </Banner>
      )}

      <Workspace run={run}>
        <div className="space-y-6">
          {run.subs.map((s) => (
            <SubSection key={s.id} sub={s} core={coreMarked && core.has(s.id)} sources={sources} />
          ))}
        </div>
      </Workspace>
    </div>
  );
}
