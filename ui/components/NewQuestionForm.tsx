"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiHttpError, ApiUnreachableError } from "@/lib/api";
import { SectionLabel } from "./ui";
import { RunProgress } from "./RunProgress";

type Phase =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "running"; id: string; stage: string; since: number }
  | { kind: "failed"; title: string; text: string; runId?: string };

const MIN = 5;
const MAX = 400;
const POLL_MS = 3000;

function startErrorText(err: unknown): { title: string; text: string } {
  if (err instanceof ApiUnreachableError) {
    return {
      title: "Không kết nối được máy chủ",
      text: "Máy chủ không phản hồi nên câu hỏi chưa được gửi. Hãy thử lại sau.",
    };
  }
  if (err instanceof ApiHttpError) {
    if (err.status === 429) return { title: "Hệ thống đang bận", text: err.detail };
    if (err.status === 503) return { title: "Kho tài liệu chưa sẵn sàng", text: err.detail };
    if (err.status === 422) return { title: "Câu hỏi không hợp lệ", text: `Câu hỏi cần từ ${MIN} đến ${MAX} ký tự.` };
    return { title: "Máy chủ từ chối câu hỏi", text: `${err.detail} (HTTP ${err.status})` };
  }
  return { title: "Không gửi được câu hỏi", text: "Lỗi không xác định." };
}

export function NewQuestionForm({
  blockedReason,
  onStarted,
}: {
  /** When set, the form is disabled and this text says why (document store not ready). */
  blockedReason?: string;
  onStarted?: () => void;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const len = question.trim().length;
  const valid = len >= MIN && len <= MAX;
  const busy = phase.kind === "starting" || phase.kind === "running";
  const runId = phase.kind === "running" ? phase.id : null;

  // Poll the new run; when it leaves queued/running (done, error, needs clarification) open its page.
  useEffect(() => {
    if (!runId) return;
    let alive = true;
    const timer = setInterval(async () => {
      try {
        const r = await api.run(runId);
        if (!alive) return;
        if (r.status === "queued" || r.status === "running") {
          setPhase((p) => (p.kind === "running" ? { ...p, stage: r.stage } : p));
        } else {
          router.push(`/runs/${encodeURIComponent(runId)}`);
        }
      } catch (e) {
        if (!alive) return;
        if (e instanceof ApiUnreachableError) return; // keep trying; the run continues on the server
        setPhase({
          kind: "failed",
          title: "Không theo dõi được lần chạy",
          text: e instanceof ApiHttpError ? `${e.detail} (HTTP ${e.status})` : "Lỗi không xác định.",
        });
      }
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [runId, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy || blockedReason) return;
    setPhase({ kind: "starting" });
    try {
      const r = await api.startRun(question.trim());
      setPhase({ kind: "running", id: r.id, stage: "chờ xử lý", since: Date.now() });
      onStarted?.();
    } catch (err) {
      setPhase({ kind: "failed", ...startErrorText(err) });
    }
  }

  return (
    <section className="card" aria-labelledby="new-h">
      <SectionLabel>Câu hỏi mới</SectionLabel>
      <h1 id="new-h" className="mt-1 text-[26px] font-semibold leading-[1.35] tracking-[-0.015em]">
        Đặt một câu hỏi nghiên cứu thị trường game
      </h1>
      <p className="mt-2 text-muted">
        Hệ thống tìm trong kho 30 tài liệu cố định, trích các khẳng định (claim) kèm đoạn gốc, chấm hạng nguồn A đến D, đối
        soát mâu thuẫn rồi soạn memo một trang với mức chắc chắn và lý do. Khi chưa đủ căn cứ, memo ghi rõ &quot;Chưa đủ căn
        cứ&quot; thay vì đoán.
      </p>
      <form onSubmit={submit} className="mt-4">
        <label htmlFor="q" className="block text-[14px] font-semibold">Câu hỏi của bạn</label>
        <textarea
          id="q"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={busy || !!blockedReason}
          rows={3}
          maxLength={MAX + 100}
          aria-describedby="q-hint"
          className="mt-1 w-full resize-y rounded-lg border border-ink/50 bg-surface p-3 text-[15px] disabled:bg-subtle"
          placeholder="Ví dụ: Giới hạn thời gian chơi game của người dưới 18 tuổi theo quy định hiện hành là bao nhiêu?"
        />
        <p id="q-hint" className={`mt-1 text-[13px] ${len > 0 && !valid ? "font-semibold text-danger-text" : "text-muted"}`}>
          {len}/{MAX} ký tự. Cần từ {MIN} đến {MAX} ký tự. Chỉ nhập câu hỏi về thông tin công khai: model miễn phí ghi log sử
          dụng, không nhập dữ liệu nội bộ hay dữ liệu cá nhân.
        </p>
        <button type="submit" disabled={!valid || busy || !!blockedReason} className="btn btn-primary mt-3">
          {busy ? "Đang chạy..." : "Chạy nghiên cứu"}
        </button>
        {blockedReason && <p className="mt-2 text-[14px] font-medium text-warn-text">{blockedReason}</p>}
      </form>

      {phase.kind === "starting" && <p role="status" className="mt-4 text-muted">Đang gửi câu hỏi tới máy chủ...</p>}

      {phase.kind === "running" && (
        <div className="mt-4">
          <RunProgress stage={phase.stage} since={phase.since} title="Đang nghiên cứu câu hỏi của bạn" />
          <p className="mt-2 text-[14px]">
            <Link href={`/runs/${encodeURIComponent(phase.id)}`} className="font-semibold text-accent underline">
              Mở trang của lần chạy này
            </Link>{" "}
            (trang tự mở khi xong).
          </p>
        </div>
      )}

      {phase.kind === "failed" && (
        <div role="alert" className="mt-4 rounded-lg border border-danger-text/50 bg-danger-bg p-4 text-danger-text">
          <p className="font-semibold">{phase.title}</p>
          <pre className="mt-1 whitespace-pre-wrap break-words rounded border border-danger-text/30 bg-surface p-3 font-mono text-[13px] text-ink">
            {phase.text}
          </pre>
          <button type="button" className="btn btn-secondary mt-3 bg-surface" onClick={() => setPhase({ kind: "idle" })}>
            Đóng thông báo
          </button>
        </div>
      )}
    </section>
  );
}
