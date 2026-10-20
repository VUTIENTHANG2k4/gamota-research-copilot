"use client";

import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { api, ApiHttpError, ApiUnreachableError, type Claim, type Run } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { GRADE_COMPONENTS, claimTypeVi, dateOrUnknown, inheritedFrom, sourceTypeVi } from "@/lib/text";
import { AnswersTag, GradeBadge, Icon, LevelBadge, SyntheticTag, SectionLabel } from "./ui";
import { useRun } from "./RunProvider";
import { Loading } from "./states";

const NUMBER_RE = /\d+(?:[.,]\d+)*(?:\s?%)?/g;

/** Wrap every figure in <mark> so numbers stand out inside the quote. */
function withFigures(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(NUMBER_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    out.push(
      <mark key={i++} className="rounded-sm bg-hl px-0.5 font-semibold text-ink tabular">
        {m[0]}
      </mark>,
    );
    last = idx + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Find the claim passage inside the chunk, ignoring whitespace differences (same rule as the code check). */
export function locatePassage(chunk: string, passage: string): [number, number] | null {
  const chars = Array.from(passage.replace(/\s+/g, ""));
  if (!chars.length) return null;
  const pattern = chars.map((c) => c.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("\\s*");
  try {
    const m = new RegExp(pattern, "u").exec(chunk);
    return m ? [m.index, m.index + m[0].length] : null;
  } catch {
    return null;
  }
}

function safeUrl(u: string | undefined): string | null {
  if (!u) return null;
  try {
    const p = new URL(u);
    return p.protocol === "http:" || p.protocol === "https:" ? p.href : null;
  } catch {
    return null;
  }
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function Quote({ chunkText, passage }: { chunkText: string | null; passage: string }) {
  const box = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const range = chunkText ? locatePassage(chunkText, passage) : null;
  const start = range ? range[0] : -1;

  // Scroll the quote container (not the page) so the quoted part is visible.
  useEffect(() => {
    if (box.current && markRef.current) {
      box.current.scrollTop = Math.max(0, markRef.current.offsetTop - 40);
    }
  }, [chunkText, start]);

  if (chunkText && range) {
    const [a, b] = range;
    return (
      <div ref={box} className="relative max-h-72 overflow-auto rounded-lg border border-line bg-subtle p-4 text-[15px]">
        <span className="text-muted">{chunkText.slice(0, a)}</span>
        <span ref={markRef} className="box-decoration-clone rounded bg-[#d3eaf0] px-0.5 underline decoration-accent decoration-2 underline-offset-4">
          {withFigures(chunkText.slice(a, b))}
        </span>
        <span className="text-muted">{chunkText.slice(b)}</span>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-line bg-subtle p-4 text-[15px]">
      {chunkText && (
        <p className="mb-2 text-[13px] font-medium text-warn-text">
          Không định vị được đoạn trích bên trong đoạn gốc; hiển thị riêng đoạn trích của claim.
        </p>
      )}
      <span className="box-decoration-clone rounded bg-[#d3eaf0] px-0.5 underline decoration-accent decoration-2 underline-offset-4">{withFigures(passage)}</span>
    </div>
  );
}

function ReviewRow({ claim }: { claim: Claim }) {
  const { run, review, reviewBusy, reviewError, lastDecision } = useRun();
  const state = claim.review;
  const decision = lastDecision && lastDecision.claimId === claim.claim_id ? lastDecision : null;
  const decisionWord = (st: string) => (st === "confirmed" ? "xác nhận" : st === "rejected" ? "loại khỏi memo" : "hoàn tác");

  return (
    <div className="rounded-lg border-2 border-ink/70 p-4" aria-labelledby={`rv-${claim.claim_id}`}>
      <p id={`rv-${claim.claim_id}`} className="label-mono">Duyệt của chuyên viên</p>
      <p className="mt-1 text-[15px] font-semibold">
        {state === "confirmed" && "Bạn đã xác nhận claim này."}
        {state === "rejected" && "Claim này đã bị loại khỏi memo."}
        {state === "none" && "Chưa duyệt claim này."}
      </p>
      {state !== "none" && inheritedFrom(claim.reviewed_by) && (
        <p className="mt-1 text-[14px]">
          Quyết định này được kế thừa từ lần chạy trước (<span className="font-mono">{inheritedFrom(claim.reviewed_by)}</span>),
          không phải do bạn bấm ở lần chạy này. Bấm Hoàn tác nếu muốn xét lại.
        </p>
      )}
      {state === "rejected" && (
        <p className="mt-1 text-[14px] text-danger-text">
          Claim vẫn được hiển thị để bạn thấy, nhưng không còn được tính vào mức chắc chắn và sẽ không có trong memo viết lại.
        </p>
      )}
      {claim.is_synthetic && (
        <p className="mt-1 text-[14px] text-warn-text">
          Claim SYNTHETIC không bao giờ được tính vào kết luận, dù xác nhận hay loại.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={reviewBusy || state === "confirmed"} onClick={() => review(claim.claim_id, "confirmed")}>
          <Icon name="check" size={16} /> Xác nhận
        </button>
        <button
          type="button"
          className="btn border-danger-text bg-surface text-danger-text hover:bg-danger-bg disabled:opacity-50"
          disabled={reviewBusy || state === "rejected"}
          onClick={() => review(claim.claim_id, "rejected")}
        >
          <Icon name="x" size={16} /> Loại khỏi memo
        </button>
        <button type="button" className="btn btn-secondary" disabled={reviewBusy || state === "none"} onClick={() => review(claim.claim_id, "none")}>
          Hoàn tác
        </button>
      </div>
      {reviewBusy && <p role="status" className="mt-2 text-[14px] text-muted">Đang lưu quyết định...</p>}
      {reviewError && (
        <p role="alert" className="mt-2 rounded border border-danger-text/50 bg-danger-bg p-2 text-[14px] text-danger-text">
          Không lưu được quyết định: {reviewError}
        </p>
      )}
      {decision && !reviewBusy && (
        <div role="status" className="mt-3 rounded-lg border border-line bg-subtle p-3 text-[14px]">
          <p className="font-semibold">Đã lưu: {decisionWord(decision.state)}.</p>
          {decision.changes.length === 0 ? (
            <p>Mức chắc chắn của các câu hỏi con không đổi (máy chủ đã tính lại).</p>
          ) : (
            <ul className="mt-1 space-y-2">
              {decision.changes.map((c) => (
                <li key={c.subId}>
                  <p className="font-semibold">
                    Mức chắc chắn của <span className="font-mono">{c.subId}</span> đã đổi:
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5">
                    <LevelBadge level={c.from.level} /> <span aria-hidden>→</span> <LevelBadge level={c.to.level} />
                  </p>
                  <p className="text-muted">Lý do mới: {c.to.reason}</p>
                </li>
              ))}
            </ul>
          )}
          {run.memo_status === "stale" && (
            <p className="mt-2 font-medium text-warn-text">
              Memo chưa phản ánh quyết định này. Vào bước Memo và bấm &quot;Viết lại memo&quot;.
            </p>
          )}
        </div>
      )}
      <p className="mt-2 text-[13px] text-muted">
        Tổng cộng lần chạy này: {run.review_summary.confirmed} claim đã xác nhận, {run.review_summary.rejected} claim đã loại.
        Mức chắc chắn hiện tại do code tính lại sau mỗi quyết định (không do AI).
      </p>
    </div>
  );
}

function ClaimDetail({ claim, run }: { claim: Claim; run: Run }) {
  const { state, reload } = useApi(() => api.chunk(claim.chunk_id), claim.chunk_id);
  const src = claim.source;
  const url = safeUrl(src.url);
  const sameOrigin = claim.origin_group
    ? run.subs.flatMap((s) => s.claims).filter((c) => c.origin_group === claim.origin_group).length
    : 0;
  const methodology = String(src.has_methodology).toLowerCase() === "true";
  const parent = inheritedFrom(claim.reviewed_by);
  const by = claim.reviewed_by ? (parent ? ` (kế thừa từ lần chạy ${parent})` : ` (bởi ${claim.reviewed_by})`) : "";

  let chunkText: string | null = null;
  let chunkProblem: ReactNode = null;
  if (state.status === "ok") chunkText = state.data.text;
  if (state.status === "error") {
    const e = state.error;
    const msg =
      e instanceof ApiHttpError
        ? `${e.detail} (HTTP ${e.status})`
        : e instanceof ApiUnreachableError
          ? "Không kết nối được máy chủ API."
          : "Lỗi không xác định khi tải đoạn gốc.";
    chunkProblem = (
      <div role="alert" className="rounded-lg border border-danger-text/50 bg-danger-bg p-3 text-[14px] text-danger-text">
        <p className="font-semibold">Không tải được đoạn gốc đầy đủ</p>
        <p>{msg}</p>
        <p className="mt-1">
          Bên dưới chỉ hiện đoạn trích (<code className="font-mono">passage</code>) đã lưu cùng claim. Đoạn đầy đủ
          xung quanh nó không có sẵn lúc này.
        </p>
        <button type="button" className="btn btn-secondary mt-2 !min-h-9 bg-surface" onClick={reload}>
          Thử tải lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[17px] font-medium">{claim.claim_id}</span>
          <GradeBadge grade={claim.grade} />
          {claim.review === "rejected" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-danger-text/50 bg-danger-bg px-2 py-0.5 text-[13px] font-semibold text-danger-text">
              <Icon name="x" size={13} /> đã loại khỏi memo{by}
            </span>
          )}
          {claim.review === "confirmed" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-ok-text/40 bg-ok-bg px-2 py-0.5 text-[13px] font-semibold text-ok-text">
              <Icon name="check" size={13} /> đã xác nhận{by}
            </span>
          )}
          {claim.answers && <AnswersTag answers={claim.answers} reason={claim.answers_reason} />}
          {claim.is_synthetic && <SyntheticTag />}
          {claim.claim_type !== "fact" && (
            <span className="rounded border border-dashed border-ink px-1.5 font-mono text-[11px] uppercase tracking-[0.06em]">
              {claimTypeVi(claim.claim_type)}
            </span>
          )}
        </div>
        <p className="mt-2 text-[15px] font-medium">{claim.content}</p>
        {claim.answers && claim.answers_reason && (
          <p className="mt-1 text-[13px]">
            <span className="font-semibold">Mức liên quan (AI gán nhãn): </span>
            <span className="text-muted">{claim.answers_reason}</span>
          </p>
        )}
      </div>

      {claim.is_synthetic && (
        <p className="rounded-lg border border-warn-border bg-warn-bg p-3 text-[14px] text-warn-text">
          Tài liệu SYNTHETIC: do nhóm tự soạn để thử hệ thống. Không dùng để kết luận về thị trường thật hay về Gamota
          thật.
        </p>
      )}

      <div>
        <SectionLabel>Đoạn gốc (nguyên văn)</SectionLabel>
        <div className="mt-2 space-y-2">
          {state.status === "loading" ? <Loading what="đoạn gốc" /> : null}
          {chunkProblem}
          {state.status !== "loading" && <Quote chunkText={chunkText} passage={claim.passage} />}
          <p className="text-[13px] text-muted">
            Phần có viền là câu claim trích; số liệu được tô vàng. Đoạn gốc{" "}
            <span className="font-mono">{claim.chunk_id}</span>
            {state.status === "ok" && <> (trang {state.data.page})</>}.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-ok-text/40 bg-ok-bg p-3 text-[14px] text-ok-text">
        <span className="mt-0.5"><Icon name="check" size={18} /></span>
        <p>
          <span className="font-semibold">Đạt kiểm tra trích dẫn tự động (bằng code):</span> đoạn trích có nguyên văn
          trong đoạn gốc; các con số và tên riêng của claim đều có trong đoạn trích. Kiểm tra này không bảo đảm claim
          trả lời đúng câu hỏi con.
        </p>
      </div>

      <div>
        <SectionLabel>Nguồn</SectionLabel>
        <p className="mt-1 font-semibold">
          {src.title}
          {src.is_synthetic && <> <SyntheticTag className="ml-1 align-middle" /></>}
        </p>
        <dl className="mt-2 grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-[14px]">
          <Row k="Tổ chức">{dateOrUnknown(src.org)}</Row>
          <Row k="Loại nguồn">{sourceTypeVi(src.source_type)}</Row>
          <Row k="Ngày công bố">{dateOrUnknown(src.publish_date)}</Row>
          <Row k="Ngày dữ liệu">{dateOrUnknown(src.data_date)}</Row>
          <Row k="Đăng lại từ">{src.cites_origin ? <span className="font-mono">{src.cites_origin}</span> : "không ghi (không phải bài đăng lại)"}</Row>
          <Row k="Gốc thông tin">
            {claim.origin_group ? (
              <>
                <span className="font-mono">{claim.origin_group}</span>
                {sameOrigin > 1 && <> ({sameOrigin} claim trong lần chạy này cùng một gốc)</>}
              </>
            ) : (
              "không ghi"
            )}
          </Row>
          <Row k="Nêu phương pháp">{methodology ? "có" : "không"}</Row>
          {src.conflict_of_interest_note && <Row k="Xung đột lợi ích">{src.conflict_of_interest_note}</Row>}
          <Row k="Liên kết">
            {url ? (
              <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 break-all text-accent underline">
                {url} <Icon name="external" size={13} />
              </a>
            ) : (
              "không có đường dẫn"
            )}
          </Row>
        </dl>
        {claim.scope && (
          <p className="mt-3 text-[14px]">
            <span className="text-muted">Phạm vi (do AI điền, code không kiểm tra): </span>
            {claim.scope}
          </p>
        )}
      </div>

      <div>
        <SectionLabel>Vì sao hạng {claim.grade}</SectionLabel>
        <div className="mt-2 overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-[14px]">
            <thead className="bg-subtle text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Tiêu chí</th>
                <th className="px-3 py-2 font-semibold">Khoảng điểm</th>
                <th className="px-3 py-2 text-right font-semibold">Điểm</th>
              </tr>
            </thead>
            <tbody>
              {GRADE_COMPONENTS.map((c) => (
                <tr key={c.key} className="border-t border-line">
                  <td className="px-3 py-2">{c.label}</td>
                  <td className="px-3 py-2 font-mono text-[13px] text-muted">{c.range}</td>
                  <td className="px-3 py-2 text-right font-mono tabular">{claim.grade_detail.components[c.key]}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-ink bg-subtle font-semibold">
                <td className="px-3 py-2">Tổng (tối đa 9)</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right font-mono tabular">
                  {claim.grade_detail.score} → Hạng {claim.grade}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[13px] text-muted">
          Quy tắc: A từ 8 điểm, B 6 đến 7, C 4 đến 5, D dưới 4. Độ mới: {claim.grade_detail.freshness_note ?? "không ghi"}.
        </p>
      </div>

      <ReviewRow claim={claim} />
    </div>
  );
}

export function SourcePanel({ claim, run, onClear }: { claim: Claim | null; run: Run; onClear: () => void }) {
  return (
    <aside aria-label="Đoạn gốc của claim" className="card !p-5">
      {claim ? (
        <Fragment key={claim.claim_id}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <SectionLabel>Đoạn gốc</SectionLabel>
            <button type="button" onClick={onClear} className="btn btn-secondary !min-h-9 !px-3">
              Đóng
            </button>
          </div>
          <ClaimDetail claim={claim} run={run} />
        </Fragment>
      ) : (
        <div>
          <SectionLabel>Đoạn gốc</SectionLabel>
          <p className="mt-2 font-semibold">Chưa chọn claim nào</p>
          <p className="mt-1 text-muted">
            Bấm vào một claim (mã dạng <span className="font-mono">C-xxxxxxxx</span>) để xem đoạn tài liệu gốc, số liệu
            được tô vàng, thông tin nguồn và lý do xếp hạng.
          </p>
        </div>
      )}
    </aside>
  );
}
