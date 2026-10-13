"use client";

import Link from "next/link";
import { useState } from "react";
import { useRun } from "@/components/RunProvider";
import { Banner, Icon, LevelBadge, SectionLabel, SyntheticTag, toneClass } from "@/components/ui";
import { EmptyState } from "@/components/states";
import { Inline, Markdown } from "@/components/Markdown";
import { ClaimRef, Workspace } from "@/components/Workspace";
import type { Level, Memo, MemoPoint, MemoSub } from "@/lib/api";
import { LEVEL_ORDER, causeVi, levelVi } from "@/lib/text";

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

function NotEnough({ sub }: { sub: MemoSub }) {
  return (
    <div className="rounded-xl border-[1.5px] border-dashed border-danger-text bg-danger-bg/50 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-danger-text"><Icon name="dashed-circle" size={26} /></span>
        <div>
          <p className="text-[20px] font-bold text-danger-text">Chưa đủ căn cứ</p>
          <p className="mt-1">
            <strong>Còn thiếu:</strong> {sub.verdict.reason}
          </p>
          <p className="mt-1 text-[15px]">
            Hệ thống không ước lượng và không viết kết luận cho câu hỏi con này. Con số hay nhận định nào không có claim
            hạng A hoặc B đi kèm đều bị bỏ.
          </p>
        </div>
      </div>
    </div>
  );
}

function SubBlock({ sub, index }: { sub: MemoSub; index: number }) {
  const refused = sub.verdict.level === "Chưa đủ căn cứ" || sub.refused_text !== null;
  return (
    <section className="border-t border-line pt-6" aria-labelledby={`m-${sub.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-mono">{index}. {sub.id}</span>
        <LevelBadge level={sub.verdict.level} />
      </div>
      <h3 id={`m-${sub.id}`} className="mt-1 text-[18px] font-semibold leading-snug">{sub.text}</h3>
      <p className="mt-1 text-[14px] text-muted"><strong>Lý do:</strong> {sub.verdict.reason}</p>

      <div className="mt-3 space-y-3">
        {refused ? (
          <NotEnough sub={sub} />
        ) : sub.points.length === 0 ? (
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
                    {c.synthetic_involved && <> <SyntheticTag className="align-middle" /></>}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[13px]">Giải thích đầy đủ và gợi ý dùng con số nào ở bước Đối soát.</p>
          </div>
        )}

        {sub.reference_signals_cd.length > 0 && (
          <div className="rounded-lg border border-line bg-subtle p-3">
            <p className="font-semibold">Tín hiệu tham khảo hạng C/D</p>
            <p className="text-[13px] text-muted">
              Nguồn yếu: không đủ làm căn cứ kết luận, chỉ để tham khảo.
            </p>
            <ul className="mt-2 space-y-2">
              {sub.reference_signals_cd.map((s) => (
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
        )}
      </div>
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

function MemoView({ memo }: { memo: Memo }) {
  const total = memo.subs.length;
  const refusedCount = memo.subs.filter((s) => s.verdict.level === "Chưa đủ căn cứ").length;
  const noPoints = memo.subs.filter((s) => s.verdict.level !== "Chưa đủ căn cứ" && s.points.length === 0).length;
  const note =
    memo.overall.level !== "Chưa đủ căn cứ" && refusedCount > 0
      ? `${refusedCount}/${total} câu hỏi con ở trạng thái "Chưa đủ căn cứ" nhưng mức tổng thể chỉ tính các phần đã trả lời. Đây là lỗi đã biết (xem Giới hạn đã biết): mức tổng thể có thể cao hơn thực tế.${
          noPoints > 0 ? ` Ngoài ra ${noPoints} câu hỏi con có mức nhưng chưa có câu kết luận nào.` : ""
        }`
      : undefined;
  const st = memo.stats;

  return (
    <article className="card space-y-6" aria-labelledby="memo-h">
      <header>
        <SectionLabel>Memo · {memo.mode === "real" ? "chỉ tài liệu thật" : "chế độ thử bẫy (gồm SYNTHETIC)"}</SectionLabel>
        <h1 id="memo-h" className="mt-1 text-[26px] font-semibold leading-[1.35] tracking-[-0.015em]">{memo.question}</h1>
        <p className="mt-1 text-[14px] text-muted">Bản nháp do AI soạn, chưa có chuyên viên duyệt.</p>
      </header>

      <section aria-labelledby="overall-h">
        <SectionLabel>Mức chắc chắn tổng thể</SectionLabel>
        <h2 id="overall-h" className="sr-only">Mức chắc chắn tổng thể</h2>
        <div className="mt-2">
          <ConfidenceBand level={memo.overall.level} reason={memo.overall.reason} note={note} />
        </div>
      </section>

      <div>
        <SectionLabel>Kết luận theo câu hỏi con</SectionLabel>
        <div className="mt-4 space-y-6">
          {memo.subs.map((s, i) => <SubBlock key={s.id} sub={s} index={i + 1} />)}
        </div>
      </div>

      <ListSection title="Khoảng trống dữ liệu" items={memo.gaps} empty="Memo không ghi khoảng trống nào." />
      <ListSection title="Giả định chính / điều có thể làm kết luận sai" items={memo.key_assumptions} empty="Memo không ghi giả định nào." />
      <ListSection title="Bước xác minh tiếp theo" items={memo.next_steps} empty="Memo không đề xuất bước nào." />

      <footer className="rounded-lg border border-ink/60 bg-subtle p-4 text-[14px]">
        <p className="font-semibold">Về memo này</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Memo do AI soạn và đã qua kiểm tra trích dẫn tự động (bằng code). Hãy mở đoạn gốc của từng claim trước khi dùng.</li>
          <li>
            <strong>Bước duyệt của chuyên viên CHƯA được thực hiện.</strong> Số claim do chuyên viên xác nhận: 0.{" "}
            {memo.analyst_review}
          </li>
          {st && typeof st.demoted === "number" && st.demoted > 0 && (
            <li>
              {st.demoted}/{st.llm_fact ?? "?"} câu bị code hạ xuống &quot;suy luận&quot;. Ở vòng kiểm thử P4, đánh giá độc lập cho
              thấy bộ kiểm tra số này từng hạ nhầm nhiều câu đúng (lỗi đã biết); hãy đọc lại các câu này.
            </li>
          )}
          <li>Bước duyệt claim của chuyên viên và xuất Word/PDF chưa được làm trong MVP.</li>
        </ul>
      </footer>
    </article>
  );
}

export default function MemoPage() {
  const { run } = useRun();
  const [mode, setMode] = useState<"real" | "test">("real");

  if (run.needs_clarification || run.subs.length === 0) {
    return (
      <EmptyState title="Chưa có memo cho lần chạy này">
        {run.needs_clarification
          ? "Câu hỏi cần làm rõ nên chưa có nghiên cứu nào được chạy và memo chưa được viết."
          : "API không trả về memo."}
      </EmptyState>
    );
  }

  const memo = mode === "real" ? run.memo_real : run.memo_test;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <SectionLabel>Bước 4: Memo</SectionLabel>
          <p className="mt-1 text-muted">
            Bấm vào mã claim bên cạnh mỗi câu để xem đoạn gốc. Chế độ chính chỉ dùng tài liệu thật; chế độ thử bẫy thêm tài
            liệu SYNTHETIC để kiểm tra các cơ chế.
          </p>
        </div>
        <div role="group" aria-label="Chọn chế độ memo" className="inline-flex rounded-lg border border-ink/60 bg-surface p-1">
          {([
            ["real", "Chính: chỉ tài liệu thật"],
            ["test", "Thử bẫy: gồm SYNTHETIC"],
          ] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-[44px] rounded-md px-3 text-[14px] font-semibold ${
                mode === m ? "bg-accent text-white" : "text-ink hover:bg-subtle"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === "test" ? (
        <Banner tone="warn" title="SYNTHETIC: memo thử bẫy, không phải thị trường thật">
          Memo này dùng cả tài liệu SYNTHETIC do nhóm tự soạn để thử hệ thống. Không dùng nó để kết luận về thị trường
          thật hay về Gamota thật. Banner này luôn hiển thị ở chế độ này.
        </Banner>
      ) : (
        <Banner tone="neutral" title="Memo chính: chỉ dùng tài liệu thật">
          Tài liệu SYNTHETIC bị loại ở chế độ này. Kết quả là bản đã lưu, chưa có chuyên viên duyệt; nhiều câu hỏi con vẫn
          &quot;Chưa đủ căn cứ&quot;.
        </Banner>
      )}

      <Workspace run={run}>
        <div className="space-y-6">
          {memo ? (
            <MemoView memo={memo} />
          ) : (
            <EmptyState title="Không có memo ở chế độ này">API không trả về memo cho chế độ đã chọn.</EmptyState>
          )}

          <section className="card" aria-labelledby="baseline-h">
            <SectionLabel>So sánh</SectionLabel>
            <h2 id="baseline-h" className="sr-only">Câu trả lời baseline</h2>
            {run.baseline ? (
              <details className="mt-1">
                <summary className="cursor-pointer text-[16px] font-semibold">
                  Câu trả lời trực tiếp của LLM, không có nguồn kiểm chứng
                </summary>
                <div className="mt-3 space-y-3">
                  <Banner tone="danger" title="Không dùng làm căn cứ">
                    Đây là câu trả lời của LLM không qua kho tài liệu: không có claim ID, không có đoạn gốc. Con số trong
                    đó không truy vết được; đánh giá kiểm thử ghi nhận nhiều số liệu không có căn cứ và có chỗ sai so với
                    kho (xem <Link href="/test-results" className="font-semibold underline">Kết quả kiểm thử</Link>, T8).
                  </Banner>
                  <Markdown text={run.baseline.answer} className="rounded-lg border border-line bg-subtle p-4" />
                </div>
              </details>
            ) : (
              <p className="mt-1 text-muted">Chưa có câu trả lời baseline cho câu hỏi này (chỉ Q1 đến Q5 có).</p>
            )}
          </section>
        </div>
      </Workspace>
    </div>
  );
}
