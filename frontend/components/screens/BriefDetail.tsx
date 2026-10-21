"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRun } from "@/components/RunProvider";
import { CoreBadge, SectionLabel } from "@/components/ui";
import { FollowupBanner } from "@/components/Followup";
import { EmptyState } from "@/components/states";
import { api, ApiHttpError, type RunSummary } from "@/lib/api";
import { errorText } from "@/lib/text";

const ANSWER_MIN = 2;
const ANSWER_MAX = 600;

function ClarifyForm({ runId }: { runId: string }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; text: string } | null>(null);
  const [children, setChildren] = useState<RunSummary[]>([]);

  // Runs already started from this clarification (parent_id = this run), so the user can find them again.
  useEffect(() => {
    let alive = true;
    api.runs().then(
      (all) => alive && setChildren(all.filter((r) => r.parent_id === runId)),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [runId]);

  const len = answer.trim().length;
  const valid = len >= ANSWER_MIN && len <= ANSWER_MAX;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.clarify(runId, answer.trim());
      router.push(`/runs/${encodeURIComponent(r.id)}`);
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiHttpError && err.status === 429) setError({ title: "Hệ thống đang bận", text: err.detail });
      else if (err instanceof ApiHttpError && err.status === 503) setError({ title: "Kho tài liệu chưa sẵn sàng", text: err.detail });
      else if (err instanceof ApiHttpError && err.status === 409) setError({ title: "Không thể trả lời lúc này", text: err.detail });
      else setError({ title: "Chưa gửi được câu trả lời", text: errorText(err) });
    }
  }

  return (
    <form onSubmit={submit} className="mt-5">
      <label htmlFor="answer" className="block text-[14px] font-semibold">Câu trả lời của bạn (gộp trả lời cho các câu hỏi trên)</label>
      <textarea
        id="answer"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={busy}
        rows={4}
        maxLength={ANSWER_MAX + 100}
        aria-describedby="answer-hint"
        className="mt-1 w-full resize-y rounded-lg border border-ink/50 bg-surface p-3 text-[15px] disabled:bg-subtle"
      />
      <p id="answer-hint" className={`mt-1 text-[13px] ${len > 0 && !valid ? "font-semibold text-danger-text" : "text-muted"}`}>
        {len}/{ANSWER_MAX} ký tự. Câu trả lời được ghép vào câu hỏi gốc và chạy thành một lần nghiên cứu mới.
      </p>
      <button type="submit" disabled={!valid || busy} className="btn btn-primary mt-3">
        {busy ? "Đang gửi..." : "Gửi câu trả lời và chạy nghiên cứu"}
      </button>
      {error && (
        <div role="alert" className="mt-3 rounded-lg border border-danger-text/50 bg-danger-bg p-3 text-danger-text">
          <p className="font-semibold">{error.title}</p>
          <p className="text-[14px]">{error.text}</p>
        </div>
      )}
      {children.length > 0 && (
        <p className="mt-4 text-[14px]">
          Đã có {children.length} lần chạy làm rõ từ câu hỏi này:{" "}
          {children.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ", "}
              <Link href={`/runs/${encodeURIComponent(c.id)}`} className="font-semibold text-accent underline">
                mở lần chạy {c.id}
              </Link>
            </span>
          ))}
          .
        </p>
      )}
    </form>
  );
}

export default function BriefPage() {
  const { run } = useRun();
  const brief = run.brief;
  const id = encodeURIComponent(run.id);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <SectionLabel>Bước 1: Brief (bản tóm tắt nhiệm vụ)</SectionLabel>
        <h1 className="mt-1 text-[26px] font-semibold leading-[1.35] tracking-[-0.015em]">{run.question}</h1>
      </div>

      <FollowupBanner run={run} />

      {run.status === "needs_clarification" ? (
        <section className="card border-2 border-warn-border" aria-labelledby="clar-h">
          <SectionLabel>Cần làm rõ câu hỏi</SectionLabel>
          <h2 id="clar-h" className="mt-1 text-xl font-semibold">Hệ thống hỏi lại trước khi nghiên cứu</h2>
          <p className="mt-2">
            Câu hỏi chưa đủ rõ để viết một memo có căn cứ, nên hệ thống dừng ở bước brief.{" "}
            <strong>Chưa tìm tài liệu, chưa có claim, chưa có memo.</strong> Trả lời các câu dưới đây (tối đa 3 câu hỏi) để chạy
            tiếp.
          </p>
          {brief && brief.clarifying_questions.length > 0 ? (
            <ol className="mt-4 space-y-3">
              {brief.clarifying_questions.map((q, i) => (
                <li key={i} className="flex gap-3 rounded-lg border border-line bg-subtle p-4">
                  <span className="font-mono text-[13px] font-medium text-accent">H{i + 1}</span>
                  <span className="text-[16px]">{q}</span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="mt-4"><EmptyState title="Máy chủ không kèm câu hỏi làm rõ nào" /></div>
          )}
          <ClarifyForm runId={run.id} />
        </section>
      ) : !brief ? (
        <EmptyState title="Lần chạy này chưa có brief">Máy chủ không trả về brief.</EmptyState>
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

          <section className="card" aria-label="Câu hỏi con">
            <SectionLabel>Câu hỏi con ({brief.sub_questions.length})</SectionLabel>
            {brief.sub_questions.length === 0 ? (
              <div className="mt-4"><EmptyState title="Brief không có câu hỏi con nào" /></div>
            ) : (
              <ol className="mt-4 space-y-3">
                {brief.sub_questions.map((s) => (
                  <li key={s.id} className="rounded-lg border border-line bg-subtle p-4">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[13px] font-medium text-accent">{s.id}</span>
                      {s.core && <CoreBadge />}
                    </span>
                    <p className="mt-1 text-[16px]">{s.text}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Once research has run, leftover clarifying questions only confuse: they are not waiting for an answer. */}
          {brief.clarifying_questions.length > 0 && run.subs.length === 0 && (
            <section className="card" aria-labelledby="clar2-h">
              <SectionLabel>Câu hỏi làm rõ</SectionLabel>
              <h2 id="clar2-h" className="mt-1 text-xl font-semibold">Hệ thống còn muốn hỏi thêm</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                {brief.clarifying_questions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/runs/${id}/memo`} className="btn btn-primary">Xem memo</Link>
            <Link href={`/runs/${id}/evidence`} className="btn btn-secondary">Xem kho bằng chứng</Link>
          </div>
        </>
      )}
    </div>
  );
}
