"use client";

import { useEffect, useState } from "react";
import { formatElapsed } from "@/lib/text";

/** Seconds since `sinceMs` (epoch ms), ticking every second. */
export function useElapsed(sinceMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, Math.floor((now - sinceMs) / 1000));
}

/** Progress of a running job: the stage text from the API and the time waited. A run takes minutes. */
export function RunProgress({
  stage,
  since,
  title,
  note,
}: {
  stage: string;
  since: string | number;
  title: string;
  note?: string;
}) {
  const ms = typeof since === "number" ? since : Date.parse(since);
  const known = !Number.isNaN(ms);
  const elapsed = useElapsed(known ? ms : 0);
  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-line bg-surface p-5 sm:p-8">
      <p className="label-mono">Đang xử lý</p>
      <h1 className="mt-1 flex items-center gap-3 text-[22px] font-semibold">
        <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />
        {title}
      </h1>
      <p className="mt-2 text-[16px]">
        Bước hiện tại: <strong>{stage || "đang chờ"}</strong>
      </p>
      <p className="mt-1 text-[14px] text-muted">
        {known && (
          <>
            Đã chờ <span className="font-mono tabular">{formatElapsed(elapsed)}</span>.{" "}
          </>
        )}
        Một lần chạy thường mất vài phút
        {note ? `; ${note}` : ""}. Trang tự cập nhật, bạn có thể rời đi và quay lại từ danh sách Câu hỏi.
      </p>
    </div>
  );
}
