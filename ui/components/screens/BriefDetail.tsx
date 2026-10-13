"use client";

import Link from "next/link";
import { useRun } from "@/components/RunProvider";
import { Banner, SectionLabel } from "@/components/ui";
import { EmptyState } from "@/components/states";
import { TIMING_LABELS, formatSeconds } from "@/lib/text";

export default function BriefDetailPage() {
  const { run, origin } = useRun();
  const { brief } = run;
  const key = encodeURIComponent(run.key);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <SectionLabel>Bước 1: Brief</SectionLabel>
        <h1 className="mt-1 text-[26px] font-semibold leading-[1.35] tracking-[-0.015em]">{run.question}</h1>
      </div>

      {run.needs_clarification ? (
        <section className="card border-warn-border" aria-labelledby="clar-h">
          <SectionLabel>Cần làm rõ câu hỏi</SectionLabel>
          <h2 id="clar-h" className="mt-1 text-xl font-semibold">Hệ thống hỏi lại trước khi nghiên cứu</h2>
          <p className="mt-2">
            Câu hỏi quá mơ hồ để viết một báo cáo có căn cứ, nên hệ thống dừng ở bước brief. <strong>Chưa có truy xuất,
            chưa có claim, chưa có memo.</strong> Hãy trả lời các câu dưới đây rồi nhập lại câu hỏi cụ thể hơn.
          </p>
          {brief.clarifying_questions.length > 0 ? (
            <ol className="mt-4 space-y-3">
              {brief.clarifying_questions.map((q, i) => (
                <li key={i} className="flex gap-3 rounded-lg border border-line bg-subtle p-4">
                  <span className="font-mono text-[13px] font-medium text-accent">H{i + 1}</span>
                  <span className="text-[16px]">{q}</span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="mt-4">
              <EmptyState title="API không kèm câu hỏi làm rõ nào" />
            </div>
          )}
          <p className="mt-4 text-[14px] text-muted">
            Tối đa 3 câu hỏi làm rõ. <Link href="/" className="font-semibold text-accent underline">Quay lại để nhập câu hỏi khác</Link>.
          </p>
        </section>
      ) : (
        <>
          <section className="card" aria-labelledby="brief-h">
            <SectionLabel>Brief</SectionLabel>
            <h2 id="brief-h" className="mt-1 text-xl font-semibold">Quyết định và phạm vi</h2>
            <dl className="mt-3 space-y-4">
              <div>
                <dt className="text-[13px] font-semibold text-muted">Quyết định cần hỗ trợ</dt>
                <dd className="mt-0.5 text-[16px]">{brief.decision}</dd>
              </div>
              <div>
                <dt className="text-[13px] font-semibold text-muted">Phạm vi</dt>
                <dd className="mt-0.5 text-[16px]">{brief.scope}</dd>
              </div>
            </dl>
          </section>

          <section className="card" aria-labelledby="sub-h">
            <SectionLabel>Câu hỏi con ({brief.sub_questions.length})</SectionLabel>
            <h2 id="sub-h" className="mt-1 text-xl font-semibold">Hệ thống sẽ tìm bằng chứng cho từng câu hỏi con</h2>
            {brief.sub_questions.length === 0 ? (
              <div className="mt-4"><EmptyState title="Brief không có câu hỏi con nào" /></div>
            ) : (
              <ol className="mt-4 space-y-3">
                {brief.sub_questions.map((s) => (
                  <li key={s.id} className="rounded-lg border border-line bg-subtle p-4">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="font-mono text-[13px] font-medium text-accent">{s.id}</span>
                      {s.evidence_type && (
                        <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-muted">{s.evidence_type}</span>
                      )}
                    </div>
                    <p className="mt-1 text-[16px]">{s.text}</p>
                    {(s.search_query || s.search_query_en) && (
                      <p className="mt-2 text-[13px] text-muted">
                        Từ khóa tìm kiếm (do LLM đặt): {s.search_query}
                        {s.search_query_en ? <> / <span lang="en">{s.search_query_en}</span></> : null}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {brief.clarifying_questions.length > 0 && (
            <section className="card" aria-labelledby="clar2-h">
              <SectionLabel>Câu hỏi làm rõ</SectionLabel>
              <h2 id="clar2-h" className="mt-1 text-xl font-semibold">Hệ thống còn muốn hỏi thêm</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                {brief.clarifying_questions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </section>
          )}

          {run.timing && Object.keys(run.timing).length > 0 && (
            <section className="card" aria-labelledby="time-h">
              <SectionLabel>Thời gian chạy</SectionLabel>
              <h2 id="time-h" className="mt-1 text-xl font-semibold">Đo thực tế trên model miễn phí</h2>
              <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 text-[14px] sm:max-w-xl">
                {Object.entries(run.timing).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt>{TIMING_LABELS[k] ?? k}</dt>
                    <dd className="text-right font-mono tabular">{formatSeconds(v)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-[13px] text-muted">Chưa gồm thời gian viết memo. Model miễn phí chậm hơn model trả phí.</p>
            </section>
          )}

          <Banner tone="neutral" title={origin === "saved" ? "Bạn đang xem kết quả đã lưu" : "Bạn đang xem kết quả chạy trực tiếp"}>
            {origin === "saved"
              ? "Đây là kết quả đã lưu từ lần chạy kiểm thử P4. Brief này do LLM soạn và chưa có chuyên viên duyệt."
              : "Brief này do LLM soạn và chưa có chuyên viên duyệt."}
          </Banner>

          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/runs/${key}/evidence`} className="btn btn-primary">Xem kho bằng chứng</Link>
            <Link href={`/runs/${key}/memo`} className="btn btn-secondary">Đến thẳng memo</Link>
          </div>
        </>
      )}
    </div>
  );
}
