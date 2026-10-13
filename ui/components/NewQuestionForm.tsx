"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiHttpError, ApiUnreachableError } from "@/lib/api";
import { SectionLabel } from "./ui";

type Phase =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "running"; jobId: string; key: string; stage: string; startedAt: number }
  | { kind: "failed"; title: string; text: string; jobError: boolean };

const MIN = 5;
const MAX = 400;
const POLL_MS = 3000;

export function NewQuestionForm() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);

  const len = question.trim().length;
  const valid = len >= MIN && len <= MAX;
  const busy = phase.kind === "starting" || phase.kind === "running";

  const jobId = phase.kind === "running" ? phase.jobId : null;
  const jobKey = phase.kind === "running" ? phase.key : null;
  const startedAt = phase.kind === "running" ? phase.startedAt : 0;

  // Poll the job until it is done or has failed. The error text is shown exactly as the API returns it.
  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const job = await api.job(jobId);
        if (!alive) return;
        if (job.status === "done") {
          router.push(`/runs/${encodeURIComponent(jobKey ?? job.key)}`);
          return;
        }
        if (job.status === "error") {
          setPhase({ kind: "failed", title: "Lần chạy trực tiếp kết thúc bằng lỗi", text: job.error ?? "(API không kèm nội dung lỗi)", jobError: true });
          return;
        }
        setPhase((p) => (p.kind === "running" ? { ...p, stage: job.stage } : p));
      } catch (e) {
        if (!alive) return;
        const text =
          e instanceof ApiUnreachableError
            ? "Mất kết nối tới máy chủ API khi đang chờ kết quả. Lần chạy có thể vẫn đang chạy trên backend nhưng giao diện không theo dõi được nữa."
            : e instanceof ApiHttpError && e.status === 404
              ? "Máy chủ không còn nhớ tác vụ này (backend có thể đã khởi động lại). Không có kết quả."
              : e instanceof ApiHttpError
                ? `HTTP ${e.status}: ${e.detail}`
                : "Lỗi không xác định khi theo dõi tác vụ.";
        setPhase({ kind: "failed", title: "Không theo dõi được lần chạy", text, jobError: false });
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, 1000);
    const clock = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(clock);
    };
  }, [jobId, jobKey, startedAt, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setPhase({ kind: "starting" });
    setElapsed(0);
    try {
      const r = await api.startRun(question.trim());
      setPhase({ kind: "running", jobId: r.job_id, key: r.key, stage: "bắt đầu", startedAt: Date.now() });
    } catch (err) {
      const text =
        err instanceof ApiUnreachableError
          ? "Không kết nối được máy chủ API. Khởi động backend từ thư mục gốc repo: .venv\\Scripts\\python -m uvicorn api.main:app --port 8000 (và docker compose up -d cho PostgreSQL)."
          : err instanceof ApiHttpError
            ? `HTTP ${err.status}: ${err.detail}`
            : "Lỗi không xác định khi gửi câu hỏi.";
      setPhase({ kind: "failed", title: "Không bắt đầu được lần chạy", text, jobError: false });
    }
  }

  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <section className="card" aria-labelledby="new-h">
      <SectionLabel>Câu hỏi mới (chạy trực tiếp)</SectionLabel>
      <h2 id="new-h" className="mt-1 text-xl font-semibold">Nhập câu hỏi của bạn</h2>
      <p className="mt-2 text-[14px] text-muted">
        Chạy trực tiếp mất vài phút và dùng model miễn phí có giới hạn lượt gọi mỗi ngày, nên có thể kết thúc bằng lỗi
        (ví dụ hết quota). Khi đó giao diện hiện đúng nội dung lỗi và không tạo kết quả thay thế. Model miễn phí ghi log sử
        dụng: chỉ nhập câu hỏi về dữ liệu công khai, không nhập dữ liệu nội bộ hay dữ liệu cá nhân.
      </p>
      <form onSubmit={submit} className="mt-4">
        <label htmlFor="q" className="block text-[14px] font-semibold">Câu hỏi nghiên cứu</label>
        <textarea
          id="q"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={busy}
          rows={4}
          maxLength={MAX + 100}
          aria-describedby="q-hint"
          className="mt-1 w-full resize-y rounded-lg border border-ink/50 bg-surface p-3 text-[15px] disabled:bg-subtle"
          placeholder="Ví dụ: Thị trường game casual tại Việt Nam năm 2025 có quy mô bao nhiêu?"
        />
        <p id="q-hint" className={`mt-1 text-[13px] ${len > 0 && !valid ? "font-semibold text-danger-text" : "text-muted"}`}>
          {len}/{MAX} ký tự. Cần từ {MIN} đến {MAX} ký tự.
        </p>
        <button type="submit" disabled={!valid || busy} className="btn btn-primary mt-3">
          {busy ? "Đang chạy..." : "Chạy nghiên cứu"}
        </button>
      </form>

      {phase.kind === "starting" && (
        <p role="status" className="mt-4 text-muted">Đang gửi câu hỏi tới máy chủ...</p>
      )}

      {phase.kind === "running" && (
        <div role="status" aria-live="polite" className="mt-4 rounded-lg border border-line bg-subtle p-4">
          <p className="flex items-center gap-2 font-semibold">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />
            Đang chạy: {phase.stage}
          </p>
          <p className="mt-1 text-[14px] text-muted">
            Đã chờ {mm}:{ss}. Một lần chạy thường mất vài phút; đừng đóng trang này. Mã tác vụ{" "}
            <span className="font-mono">{phase.jobId}</span>.
          </p>
        </div>
      )}

      {phase.kind === "failed" && (
        <div role="alert" className="mt-4 rounded-lg border border-danger-text/50 bg-danger-bg p-4 text-danger-text">
          <p className="font-semibold">{phase.title}</p>
          <p className="mt-1 text-[13px]">Nội dung lỗi từ máy chủ, nguyên văn:</p>
          <pre className="mt-1 whitespace-pre-wrap break-words rounded border border-danger-text/30 bg-surface p-3 font-mono text-[13px] text-ink">
            {phase.text}
          </pre>
          {phase.jobError && (
            <p className="mt-2">
              Chạy trực tiếp cần quota của model miễn phí. Nếu quota đã hết hoặc model quá tải, lần chạy sẽ kết thúc bằng
              lỗi như trên và không có kết quả nào được tạo. Bạn vẫn xem được các câu hỏi đã lưu ở cột bên cạnh.
            </p>
          )}
          <button type="button" className="btn btn-secondary mt-3 bg-surface" onClick={() => setPhase({ kind: "idle" })}>
            Đóng thông báo
          </button>
        </div>
      )}
    </section>
  );
}
