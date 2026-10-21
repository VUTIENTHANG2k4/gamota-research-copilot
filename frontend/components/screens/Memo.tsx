"use client";

import { useState } from "react";
import Link from "next/link";
import { useRun } from "@/components/RunProvider";
import { CoreBadge, Icon, LevelBadge, SectionLabel, SyntheticTag, TierBadge, toneClass } from "@/components/ui";
import { EmptyState } from "@/components/states";
import { Inline } from "@/components/Markdown";
import { RunProgress } from "@/components/RunProgress";
import { FollowupBanner, FollowupBox } from "@/components/Followup";
import { ClaimRef, Workspace } from "@/components/Workspace";
import {
  api,
  ApiHttpError,
  type Level,
  type Memo,
  type MemoClaimRef,
  type MemoPoint,
  type MemoSub,
  type Run,
  type Tier,
  type Verdict,
} from "@/lib/api";
import {
  LEVEL_ORDER,
  TIER_ORDER,
  causeVi,
  coreIds,
  errorText,
  formatDateTime,
  historyVi,
  levelVi,
  tierOf,
  uncertainVi,
} from "@/lib/text";
import { useAbout } from "@/lib/useAbout";

const BAND_CELL: Record<Level, string> = {
  "Chưa đủ căn cứ": "bg-danger-bg text-danger-text border-dashed border-danger-text",
  Low: "bg-warn-bg text-warn-text border-warn-border",
  Medium: "bg-subtle text-ink border-ink",
  High: "bg-ok-bg text-ok-text border-ok-text",
};

function ConfidenceBand({ level, reason, note }: { level: Level; reason: string; note?: string }) {
  return (
    <div>
      <div role="img" aria-label={`Mức chắc chắn tổng thể: ${levelVi(level)}`} className="grid grid-cols-2 gap-2 min-[560px]:grid-cols-4">
        {LEVEL_ORDER.map((l) => {
          const active = l === level;
          return (
            <div
              key={l}
              className={`rounded-lg border px-3 py-2 text-center text-[14px] ${
                active ? `${BAND_CELL[l]} border-[3px] font-bold` : "border-line bg-surface text-muted"
              }`}
            >
              {levelVi(l)}
              {active && <span className="block text-[11px] font-semibold uppercase tracking-[0.06em]">mức hiện tại</span>}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[15px]">
        <strong>Vì sao mức {levelVi(level)}:</strong> {reason}
      </p>
      {note && (
        <p className="mt-2 flex gap-2 rounded-lg border border-warn-border bg-warn-bg p-3 text-[14px] text-warn-text">
          <span className="mt-0.5"><Icon name="alert" size={16} /></span>
          <span>{note}</span>
        </p>
      )}
    </div>
  );
}

function Point({ p }: { p: MemoPoint }) {
  return (
    <li className="rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-col gap-2 min-[620px]:flex-row min-[620px]:items-start min-[620px]:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap gap-1.5">
            {!p.is_fact && (
              <span className="rounded border border-dashed border-ink px-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em]">
                Suy luận
              </span>
            )}
            {p.draft_flag && (
              <span className={`rounded border px-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] ${toneClass("warn")}`}>
                Dự thảo
              </span>
            )}
          </div>
          <p className={p.is_fact ? "text-[15px]" : "text-[15px] italic text-muted"}>{p.text}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5 min-[620px]:max-w-[16rem] min-[620px]:justify-end">
          {p.claim_ids.length === 0 ? (
            <span className="rounded border border-dashed border-ink px-1.5 text-[13px]">không có claim ID</span>
          ) : (
            p.claim_ids.map((id) => <ClaimRef key={id} id={id} />)
          )}
        </div>
      </div>
      {p.citations.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-[12.5px] text-muted">
          {p.citations.map((c, i) => <li key={i} className="font-mono break-words">{c}</li>)}
        </ul>
      )}
    </li>
  );
}

const isRefused = (s: MemoSub) => s.verdict.level === "Chưa đủ căn cứ" || s.refused_text !== null;

/** Sub-questions without an A/B basis, one compact row each: reason, where to look next, and what was found anyway. */
function RefusedList({
  subs,
  run,
  core,
  m3,
}: {
  subs: MemoSub[];
  run: Run;
  core: Set<string>;
  m3: boolean;
}) {
  return (
    <section aria-labelledby="refused-h" className="rounded-xl border-[1.5px] border-dashed border-danger-text bg-danger-bg/30 p-4">
      <h2 id="refused-h" className="flex items-center gap-2 text-[17px] font-bold text-danger-text">
        <Icon name="dashed-circle" size={20} /> Chưa đủ căn cứ ({subs.length} câu hỏi con)
      </h2>
      <p className="text-[14px]">Hệ thống không viết kết luận và không ước lượng cho các câu hỏi con này.</p>
      <ul className="mt-3 space-y-2">
        {subs.map((s) => (
          <RefusedRow key={s.id} sub={s} runId={run.id} core={m3 && core.has(s.id)} m3={m3}
            current={run.subs.find((x) => x.id === s.id)?.verdict} />
        ))}
      </ul>
    </section>
  );
}

function RefusedRow({ sub, runId, core, m3, current }: { sub: MemoSub; runId: string; core: boolean; m3: boolean; current?: Verdict }) {
  const history = sub.history ?? [];
  const historyIds = new Set(history.map((h) => h.claim_id));
  const refSignals = sub.reference_signals_cd.filter((s) => !historyIds.has(s.claim_id));
  // code-written steps end with "cho nội dung: <sub-question>", which is already printed just above
  const steps = (sub.next_steps ?? []).map((s) => s.replace(` cho nội dung: ${sub.text}`, "."));
  const extra = history.length + refSignals.length;
  return (
    <li id={`m-sub-${sub.id}`} className="scroll-mt-4 rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-mono">{sub.id}</span>
        {core && <CoreBadge />}
      </div>
      <p className="mt-1 font-medium">{sub.text}</p>
      <p className="mt-1 text-[14px] text-muted"><strong>Lý do:</strong> {sub.verdict.reason}</p>
      {current && current.level !== sub.verdict.level && (
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] font-medium text-warn-text">
          <Icon name="alert" size={15} /> Sau quyết định duyệt, mức đã đổi thành <LevelBadge level={current.level} />.
        </p>
      )}
      {m3 && steps.length > 0 && (
        <p className="mt-1 text-[14px]"><strong className="text-accent">Nên tìm tiếp:</strong> {steps.join(" ")}</p>
      )}
      <div className="no-print mt-1 flex flex-wrap gap-x-4 text-[13px]">
        <Link href={`/runs/${encodeURIComponent(runId)}/evidence#sub-${sub.id}`} className="font-semibold text-accent underline">
          Đã tìm những tài liệu nào
        </Link>
      </div>
      {extra > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[13px] font-semibold">
            Số liệu cũ và tín hiệu nguồn yếu, không dùng làm kết luận ({extra})
          </summary>
          <div className="mt-2 space-y-2">
            {history.length > 0 && <HistoryList items={history} />}
            {refSignals.length > 0 && <RefSignals items={refSignals} />}
          </div>
        </details>
      )}
    </li>
  );
}

function RefSignals({ items }: { items: MemoSub["reference_signals_cd"] }) {
  return (
    <div className="rounded-lg border border-line bg-subtle p-3">
      <p className="font-semibold">Tín hiệu tham khảo hạng C/D</p>
      <p className="text-[13px] text-muted">Nguồn yếu: không đủ làm căn cứ kết luận, chỉ để tham khảo.</p>
      <ul className="mt-2 space-y-2">
        {items.map((s) => (
          <li key={s.claim_id} className="flex flex-col gap-1 min-[620px]:flex-row min-[620px]:items-start min-[620px]:justify-between">
            <div className="min-w-0 text-[14px]">
              <p>{s.content}</p>
              <p className="font-mono text-[12.5px] text-muted break-words">{s.citation}</p>
            </div>
            <div className="shrink-0"><ClaimRef id={s.claim_id} /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Main evidence: the A/B claims the conclusion rests on. Each item opens its source passage. */
function MainEvidence({ items }: { items: MemoClaimRef[] }) {
  return (
    <div className="rounded-lg border border-ok-text/40 bg-ok-bg/40 p-3">
      <p className="flex items-center gap-1.5 font-semibold text-ok-text">
        <Icon name="check" size={16} /> Bằng chứng chính ({items.length})
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((c) => (
          <li key={c.claim_id} className="flex flex-col gap-1 rounded border border-line bg-surface p-2 min-[620px]:flex-row min-[620px]:items-start min-[620px]:justify-between">
            <div className="min-w-0 text-[14px]">
              <p>{c.content}</p>
              <p className="font-mono text-[12.5px] text-muted break-words">{c.citation}</p>
            </div>
            <div className="shrink-0"><ClaimRef id={c.claim_id} /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Why the sub-question is not yet "Có thể tin": code reasons, in plain Vietnamese. */
function UncertainList({ items }: { items: NonNullable<MemoSub["uncertain"]> }) {
  return (
    <div className="rounded-lg border-2 border-warn-border bg-warn-bg/60 p-3 text-warn-text">
      <p className="flex items-center gap-1.5 font-semibold">
        <Icon name="alert" size={16} /> Điểm chưa chắc chắn và lý do ({items.length})
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((u, i) => (
          <li key={i} className="rounded border border-warn-border/60 bg-surface p-2 text-[14px] text-ink">
            <p>
              <strong>{uncertainVi(u.code)}:</strong> {u.text}
            </p>
            {u.claim_ids.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] text-muted">Claim liên quan:</span>
                {u.claim_ids.map((id) => <ClaimRef key={id} id={id} />)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Old figures kept only as history. Deliberately different from conclusions: dashed frame, date first, no bold claim. */
function HistoryList({ items }: { items: NonNullable<MemoSub["history"]> }) {
  return (
    <div className="rounded-lg border-[1.5px] border-dashed border-ink/60 bg-subtle p-3">
      <p className="flex items-center gap-1.5 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-ink">
        <Icon name="clock" size={15} /> Số liệu lịch sử: không dùng làm kết luận ({items.length})
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((h) => (
          <li key={h.claim_id} className="rounded border border-line bg-surface p-2 text-[14px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-ink/60 px-1.5 font-mono text-[12px] font-medium tabular">dữ liệu {h.data_date}</span>
              <span className="rounded border border-ink/60 px-1.5 text-[12px] font-semibold uppercase tracking-[0.04em]">{historyVi(h.code)}</span>
              <ClaimRef id={h.claim_id} />
            </div>
            <p className="mt-1.5 text-muted">
              <span className="font-medium text-ink">Con số cũ, chỉ để tham khảo: </span>&ldquo;{h.content}&rdquo;
            </p>
            <p className="mt-0.5 text-[13px]">{h.text}</p>
            <p className="font-mono text-[12px] text-muted break-words">{h.citation}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NextSteps({ items }: { items: string[] }) {
  return (
    <div className="rounded-lg border border-accent/60 bg-surface p-3">
      <p className="flex items-center gap-1.5 font-semibold text-accent">
        <Icon name="search" size={16} /> Nên tìm tiếp ở đâu
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-[14px] text-muted">Code không đề xuất hướng tìm nào cho câu hỏi con này.</p>
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-[14px]">
          {items.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      )}
    </div>
  );
}

function SubBlock({
  sub,
  index,
  current,
  core,
  m3,
}: {
  sub: MemoSub;
  index: number;
  current?: Verdict;
  core: boolean;
  m3: boolean;
}) {
  const tier = sub.tier ?? tierOf(sub.verdict);
  const history = sub.history ?? [];
  const historyIds = new Set(history.map((h) => h.claim_id));
  const refSignals = sub.reference_signals_cd.filter((s) => !historyIds.has(s.claim_id));
  return (
    <section id={`m-sub-${sub.id}`} className="scroll-mt-4 border-t border-line pt-6" aria-labelledby={`m-${sub.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-mono">{index}. {sub.id}</span>
        {m3 && core && <CoreBadge />}
        {m3 && <TierBadge tier={tier} />}
        <LevelBadge level={sub.verdict.level} />
      </div>
      <h3 id={`m-${sub.id}`} className="mt-1 text-[18px] font-semibold leading-snug">{sub.text}</h3>
      <p className="mt-1 text-[14px] text-muted"><strong>Lý do:</strong> {sub.verdict.reason}</p>
      {current && current.level !== sub.verdict.level && (
        <p className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border-2 border-warn-border bg-warn-bg p-2 text-[14px] font-medium text-warn-text">
          <Icon name="alert" size={16} /> Sau quyết định duyệt, mức của câu hỏi con này đã đổi thành <LevelBadge level={current.level} />{" "}
          (memo viết trước đó vẫn ghi mức trên).
        </p>
      )}

      <div className="mt-3 space-y-3">
        {sub.points.length === 0 ? (
          <div className="flex gap-2 rounded-lg border border-warn-border bg-warn-bg p-3 text-[14px] text-warn-text">
            <span className="mt-0.5"><Icon name="alert" size={16} /></span>
            <p>
              <strong>Có mức {levelVi(sub.verdict.level)} nhưng chưa có câu kết luận nào ở phần này.</strong> Mức này đến
              từ việc có claim hạng A/B hợp lệ, không phải từ một câu trả lời đã viết. Hãy đọc mức này với sự dè dặt.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sub.points.map((p, i) => <Point key={i} p={p} />)}
          </ul>
        )}

        {sub.main_evidence && sub.main_evidence.length > 0 && <MainEvidence items={sub.main_evidence} />}
        {sub.uncertain && sub.uncertain.length > 0 && <UncertainList items={sub.uncertain} />}

        {sub.conflicts.length > 0 && (
          <div className="rounded-lg border border-warn-border bg-warn-bg/60 p-3">
            <p className="font-semibold text-warn-text">Mâu thuẫn giữa các nguồn ({sub.conflicts.length})</p>
            <ul className="mt-2 space-y-2">
              {sub.conflicts.map((c, i) => (
                <li key={i} className="rounded border border-line bg-surface p-2 text-[14px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <ClaimRef id={c.claim_a} />
                    <span aria-hidden>so với</span>
                    <ClaimRef id={c.claim_b} />
                  </div>
                  <p className="mt-1">
                    <strong>{causeVi(c.cause)}</strong>
                    {" · "}
                    <span className={c.status === "unexplained" ? "font-bold text-danger-text" : ""}>
                      {c.status === "explained" ? "đã giải thích nguyên nhân" : "CHƯA giải thích được"}
                    </span>
                    {c.decided_by && (
                      <span className="text-muted"> · {c.decided_by === "code" ? "code xếp loại" : "AI gán nguyên nhân"}</span>
                    )}
                    {c.synthetic_involved && <> <SyntheticTag className="align-middle" /></>}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[13px]">Giải thích đầy đủ và gợi ý dùng con số nào ở bước Đối soát.</p>
          </div>
        )}

        {history.length > 0 && <HistoryList items={history} />}

        {refSignals.length > 0 && <RefSignals items={refSignals} />}

        {m3 && <NextSteps items={sub.next_steps ?? []} />}
      </div>
    </section>
  );
}

/** Top summary: the sub-questions grouped by what can be trusted (tiers computed by code). */
function TrustSummary({ memo, core, coreMarked }: { memo: Memo; core: Set<string>; coreMarked: boolean }) {
  const byId = new Map(memo.subs.map((s) => [s.id, s]));
  const tiers: Record<Tier, string[]> =
    memo.tiers ??
    (Object.fromEntries(TIER_ORDER.map((t) => [t, memo.subs.filter((s) => tierOf(s.verdict) === t).map((s) => s.id)])) as Record<Tier, string[]>);
  const frame: Record<Tier, string> = {
    supported: "border-ok-text/50",
    uncertain: "border-warn-border",
    refused: "border-danger-text border-dashed",
  };
  return (
    <section aria-labelledby="tiers-h">
      <SectionLabel>Tóm tắt: điều gì tin được</SectionLabel>
      <h2 id="tiers-h" className="sr-only">Tóm tắt theo mức tin cậy</h2>
      <div className="mt-2 grid gap-3 min-[900px]:grid-cols-3">
        {TIER_ORDER.map((t) => (
          <div key={t} className={`rounded-lg border-2 bg-surface p-3 ${frame[t]}`}>
            <div className="flex flex-wrap items-center gap-2">
              <TierBadge tier={t} />
              <span className="text-[14px] font-semibold tabular">{tiers[t]?.length ?? 0} câu hỏi con</span>
            </div>
            {(tiers[t] ?? []).length === 0 ? (
              <p className="mt-2 text-[14px] font-medium">Không có câu hỏi con nào.</p>
            ) : t === "refused" ? (
              // the full refused list follows below the details, so only the IDs here
              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {tiers[t].map((id) => (
                  <a key={id} href={`#m-sub-${id}`} className="font-mono text-[13px] font-medium text-accent underline">
                    {id}{coreMarked && core.has(id) ? " (chính)" : ""}
                  </a>
                ))}
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {tiers[t].map((id) => {
                  const s = byId.get(id);
                  return (
                    <li key={id} className="text-[14px]">
                      <a href={`#m-sub-${id}`} className="group block rounded px-1 py-0.5 hover:bg-subtle">
                        <span className="font-mono text-[13px] font-medium text-accent">{id}</span>
                        {coreMarked && core.has(id) && <span className="ml-1.5 align-middle"><CoreBadge /></span>}
                        <span className="block group-hover:underline">{s?.text ?? "(không có trong memo)"}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
      {memo.tiers && !coreMarked && (
        <p className="mt-2 text-[13px] text-muted">
          Lần chạy này không đánh dấu câu hỏi con chính, nên khi tính mức tổng thể mọi câu hỏi con đều được tính là chính.
        </p>
      )}
    </section>
  );
}

function ListSection({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section className="border-t border-line pt-6">
      <SectionLabel>{title}</SectionLabel>
      {items.length === 0 ? (
        <p className="mt-2 text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          {items.map((it, i) => <li key={i}><Inline text={it} /></li>)}
        </ul>
      )}
    </section>
  );
}

function MemoView({ memo, run }: { memo: Memo; run: Run }) {
  // Mission 3 memos carry tiers; the overall level then already counts refused core sub-questions (backend rule).
  const m3 = !!memo.tiers;
  const { ids: core, marked: coreMarked } = coreIds(run);
  const total = memo.subs.length;
  const refusedCount = memo.subs.filter((s) => s.verdict.level === "Chưa đủ căn cứ").length;
  const answered = memo.subs.filter((s) => !isRefused(s));
  const refusedSubs = memo.subs.filter(isRefused);
  const noPoints = memo.subs.filter((s) => s.verdict.level !== "Chưa đủ căn cứ" && s.points.length === 0).length;
  const note =
    !m3 && memo.overall.level !== "Chưa đủ căn cứ" && refusedCount > 0
      ? `${refusedCount}/${total} câu hỏi con ở trạng thái "Chưa đủ căn cứ". Mức tổng thể chỉ tính các phần đã trả lời, nên hãy đọc nó cùng với các phần này: mức tổng thể có thể cao hơn thực tế.${
          noPoints > 0 ? ` Ngoài ra ${noPoints} câu hỏi con có mức nhưng chưa có câu kết luận nào.` : ""
        }`
      : undefined;
  const st = memo.stats;
  const { confirmed, rejected } = run.review_summary;

  return (
    <article className="card space-y-6" aria-labelledby="memo-h">
      <header>
        <SectionLabel>Memo (bản ghi nhớ một trang)</SectionLabel>
        <h1 id="memo-h" className="mt-1 text-[26px] font-semibold leading-[1.35] tracking-[-0.015em]">{memo.question}</h1>
        <p className="mt-1 text-[14px] text-muted">
          Bản do AI soạn từ các claim không bị loại, viết lúc {formatDateTime(run.memo_generated_at)}.
        </p>
      </header>

      <section aria-labelledby="overall-h">
        <SectionLabel>Mức chắc chắn tổng thể</SectionLabel>
        <h2 id="overall-h" className="sr-only">Mức chắc chắn tổng thể</h2>
        <div className="mt-2">
          <ConfidenceBand level={memo.overall.level} reason={memo.overall.reason} note={note} />
        </div>
      </section>

      <TrustSummary memo={memo} core={core} coreMarked={coreMarked} />

      {answered.length > 0 && (
        <div>
          <SectionLabel>Chi tiết theo câu hỏi con</SectionLabel>
          <div className="mt-4 space-y-6">
            {answered.map((s, i) => (
              <SubBlock
                key={s.id}
                sub={s}
                index={i + 1}
                current={run.subs.find((x) => x.id === s.id)?.verdict}
                core={core.has(s.id)}
                m3={m3}
              />
            ))}
          </div>
        </div>
      )}

      {refusedSubs.length > 0 && <RefusedList subs={refusedSubs} run={run} core={core} m3={m3} />}

      {/* M3: gaps repeat the refused list above, so they are shown only for older memos */}
      {!m3 && <ListSection title="Khoảng trống dữ liệu" items={memo.gaps} empty="Memo không ghi khoảng trống nào." />}
      <ListSection title="Giả định chính / điều có thể làm kết luận sai" items={memo.key_assumptions} empty="Memo không ghi giả định nào." />
      {!m3 && <ListSection title="Bước xác minh tiếp theo" items={memo.next_steps} empty="Memo không đề xuất bước nào." />}

      <footer className="rounded-lg border border-ink/60 bg-subtle p-4 text-[14px]">
        <p className="font-semibold">Về memo này</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            Duyệt của chuyên viên: <strong>{confirmed}</strong> claim đã xác nhận, <strong>{rejected}</strong> claim đã loại khỏi
            memo.
          </li>
          {st && typeof st.demoted === "number" && st.demoted > 0 && (
            <li>
              {st.demoted}/{st.llm_fact ?? "?"} câu AI viết như sự kiện nhưng không có claim đỡ nên bị code hạ xuống
              &quot;suy luận&quot;; hãy đọc lại các câu này.
            </li>
          )}
        </ul>
      </footer>
    </article>
  );
}

/** Elapsed time is counted from the moment this component appears (the rewrite request or the page opening). */
function RewriteRunning() {
  const [since] = useState(() => Date.now());
  return (
    <div className="no-print">
      <RunProgress
        stage="viết lại memo từ các claim không bị loại"
        since={since}
        title="Đang viết lại memo"
        note="bản memo cũ bên dưới vẫn là bản trước đó"
      />
    </div>
  );
}

function MemoStatus({
  run,
  onRewrite,
  busy,
  startError,
}: {
  run: Run;
  onRewrite: () => void;
  busy: boolean;
  startError: string | null;
}) {
  const st = run.memo_status;
  if (st === "running") return <RewriteRunning />;

  const canRewrite = run.subs.length > 0;
  return (
    <>
      {st === "stale" && (
        <section role="alert" className="rounded-xl border-2 border-warn-border bg-warn-bg p-5 text-warn-text">
          <p className="flex items-center gap-2 text-[18px] font-bold">
            <Icon name="alert" size={20} /> Memo chưa phản ánh các thay đổi duyệt gần nhất
          </p>
          <p className="mt-1 text-[15px]">
            Bạn đã xác nhận hoặc loại claim sau khi memo này được viết ({run.review_summary.confirmed} xác nhận,{" "}
            {run.review_summary.rejected} loại). Nội dung bên dưới có thể còn dựa trên claim đã bị loại. Viết lại memo để
            cập nhật; việc này dùng model và mất khoảng một phút hoặc hơn.
          </p>
          {canRewrite && (
            <button type="button" className="btn btn-primary no-print mt-3" onClick={onRewrite} disabled={busy}>
              {busy ? "Đang gửi yêu cầu..." : "Viết lại memo"}
            </button>
          )}
        </section>
      )}
      {st === "error" && (
        <section role="alert" className="rounded-xl border-2 border-danger-text bg-danger-bg p-5 text-danger-text">
          <p className="flex items-center gap-2 text-[18px] font-bold">
            <Icon name="alert" size={20} /> Viết memo bị lỗi
          </p>
          <p className="mt-1 text-[14px]">Nội dung lỗi từ máy chủ, nguyên văn. Không có memo mới được tạo.</p>
          <pre className="mt-1 whitespace-pre-wrap break-words rounded border border-danger-text/30 bg-surface p-3 font-mono text-[13px] text-ink">
            {run.memo_error ?? "(máy chủ không kèm nội dung lỗi)"}
          </pre>
          {run.memo && (
            <p className="mt-2 text-[14px] font-semibold">
              Bản memo bên dưới là bản trước đó, có thể không còn khớp với các quyết định duyệt.
            </p>
          )}
          {canRewrite && (
            <button type="button" className="btn btn-primary no-print mt-3" onClick={onRewrite} disabled={busy}>
              {busy ? "Đang gửi yêu cầu..." : "Thử viết lại memo"}
            </button>
          )}
        </section>
      )}
      {st === "none" && !run.memo && canRewrite && (
        <section className="no-print rounded-xl border-2 border-dashed border-ink/60 bg-surface p-5">
          <p className="text-[17px] font-semibold">Lần chạy này chưa có memo</p>
          <p className="text-[14px] text-muted">
            Bạn có thể yêu cầu viết memo từ các claim không bị loại (dùng model, mất khoảng một phút hoặc hơn).
          </p>
          <button type="button" className="btn btn-primary mt-3" onClick={onRewrite} disabled={busy}>
            {busy ? "Đang gửi yêu cầu..." : "Viết memo"}
          </button>
        </section>
      )}
      {startError && (
        <p role="alert" className="no-print rounded-lg border border-danger-text/50 bg-danger-bg p-3 text-[14px] text-danger-text">
          Không bắt đầu được việc viết memo: {startError}
        </p>
      )}
    </>
  );
}

function PrintLimitations() {
  const about = useAbout();
  return (
    <section className="print-only mt-6 border-t border-ink pt-3 text-[12px]">
      <p className="font-bold">Ghi chú giới hạn (bản MVP)</p>
      {about ? (
        <ul className="mt-1 list-disc pl-5">
          {about.limitations.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      ) : (
        <p className="mt-1">
          Bản MVP: memo do AI soạn, cần mở đoạn gốc của từng claim trước khi dùng. Tài liệu SYNTHETIC là tài liệu tự soạn,
          không dùng để kết luận. Danh sách giới hạn đầy đủ nằm ở trang Giới hạn đã biết.
        </p>
      )}
    </section>
  );
}

export default function MemoPage() {
  const { run, refresh } = useRun();
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  async function rewrite() {
    setBusy(true);
    setStartError(null);
    try {
      await api.rewriteMemo(run.id);
      refresh();
    } catch (e) {
      setStartError(
        e instanceof ApiHttpError && e.status === 429 ? `${e.detail} Hãy thử lại sau vài phút.` : errorText(e),
      );
    } finally {
      setBusy(false);
    }
  }

  if (run.status === "needs_clarification" || run.subs.length === 0) {
    return (
      <EmptyState title="Chưa có memo cho lần chạy này">
        {run.status === "needs_clarification"
          ? "Câu hỏi cần làm rõ nên chưa có nghiên cứu nào được chạy và memo chưa được viết. Trả lời ở bước Brief."
          : "Máy chủ không trả về kết quả nào cho lần chạy này."}
      </EmptyState>
    );
  }

  const memo = run.memo;
  const stale = run.memo_status === "stale";

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <SectionLabel>Bước 4: Memo</SectionLabel>
        {memo && (
          <div className="flex flex-wrap gap-2">
            <DocxButton runId={run.id} />
            <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
              Lưu thành PDF
            </button>
          </div>
        )}
      </div>
      {memo && stale && (
        <p className="no-print text-[13px] text-muted">
          Tệp Word của memo chưa cập nhật mang sẵn cảnh báo rằng memo chưa phản ánh các thay đổi duyệt gần nhất; bản in PDF
          cũng giữ cảnh báo này.
        </p>
      )}

      <FollowupBanner run={run} />

      <MemoStatus run={run} onRewrite={rewrite} busy={busy} startError={startError} />

      <Workspace run={run}>
        <div className="space-y-6">
          {memo ? (
            <>
              <MemoView memo={memo} run={run} />
              <PrintLimitations />
            </>
          ) : (
            run.memo_status !== "running" && (
              <EmptyState title="Chưa có memo">
                Máy chủ không trả về memo cho lần chạy này; không có nội dung thay thế được hiển thị.
              </EmptyState>
            )
          )}
          <FollowupBox run={run} />
        </div>
      </Workspace>
    </div>
  );
}


function DocxButton({ runId }: { runId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api.downloadDocx(runId);
          } catch (e) {
            setError(e instanceof ApiHttpError ? `HTTP ${e.status}: ${e.detail}` : "Không tải được tệp Word từ máy chủ.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Đang tạo Word..." : "Tải Word"}
      </button>
      {error && (
        <span role="alert" className="mt-1 text-[13px] text-danger-text">
          {error}
        </span>
      )}
    </span>
  );
}
