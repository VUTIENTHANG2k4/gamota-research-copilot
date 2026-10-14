"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, type RunStatus, type RunSummary } from "@/lib/api";
import { MEMO_STATUS_VI, RUN_STATUS_VI, errorText, formatDateTime } from "@/lib/text";
import { EmptyState, ErrorState, Loading } from "./states";
import { Icon, SectionLabel, toneClass } from "./ui";

const POLL_MS = 5000;

const STATUS_TONE: Record<RunStatus, "ok" | "warn" | "danger" | "neutral"> = {
  queued: "neutral",
  running: "neutral",
  done: "ok",
  error: "danger",
  needs_clarification: "warn",
};

function Chip({ tone, children }: { tone: "ok" | "warn" | "danger" | "neutral"; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[13px] font-semibold ${toneClass(tone)}`}>
      {children}
    </span>
  );
}

function Row({ r, onDeleted }: { r: RunSummary; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const active = r.status === "queued" || r.status === "running";

  async function remove() {
    setBusy(true);
    setErr(null);
    try {
      await api.deleteRun(r.id);
      onDeleted();
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={STATUS_TONE[r.status]}>
          {active && <span className="h-3 w-3 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />}
          {r.status === "error" && <Icon name="alert" size={13} />}
          {RUN_STATUS_VI[r.status]}
        </Chip>
        {r.memo_status !== "none" && (
          <Chip tone={r.memo_status === "fresh" ? "ok" : r.memo_status === "stale" || r.memo_status === "error" ? "warn" : "neutral"}>
            {MEMO_STATUS_VI[r.memo_status]}
          </Chip>
        )}
        <span className="text-[13px] text-muted">
          {formatDateTime(r.created_at)}
          {r.created_by && <> · người hỏi: {r.created_by}</>}
        </span>
        {r.parent_id && (
          <span className="text-[13px] text-muted">
            · làm rõ từ{" "}
            <Link href={`/runs/${encodeURIComponent(r.parent_id)}`} className="text-accent underline">lần chạy trước</Link>
          </span>
        )}
      </div>
      <p className="mt-2 text-[16px] font-medium">{r.question}</p>
      {active && <p className="mt-1 text-[14px] text-muted">Bước hiện tại: {r.stage}</p>}
      {r.status === "error" && (
        <div className="mt-2">
          <p className="text-[13px] font-semibold text-danger-text">Nội dung lỗi từ máy chủ, nguyên văn:</p>
          <pre className="mt-1 whitespace-pre-wrap break-words rounded border border-danger-text/30 bg-danger-bg p-2 font-mono text-[13px] text-ink">
            {r.error ?? "(máy chủ không kèm nội dung lỗi)"}
          </pre>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href={`/runs/${encodeURIComponent(r.id)}`} className="btn btn-secondary !min-h-10">
          {active ? "Xem tiến độ" : r.status === "needs_clarification" ? "Trả lời câu hỏi làm rõ" : r.has_result ? "Mở kết quả" : "Mở"}
        </Link>
        {!confirming ? (
          <button type="button" className="btn !min-h-10 border-danger-text text-danger-text hover:bg-danger-bg" onClick={() => setConfirming(true)}>
            Xóa
          </button>
        ) : (
          <>
            <span className="text-[14px] font-medium">Xóa khỏi lịch sử?</span>
            <button type="button" disabled={busy} className="btn !min-h-10 border-danger-text bg-danger-bg text-danger-text" onClick={remove}>
              {busy ? "Đang xóa..." : "Xóa hẳn"}
            </button>
            <button type="button" disabled={busy} className="btn btn-secondary !min-h-10" onClick={() => setConfirming(false)}>
              Giữ lại
            </button>
          </>
        )}
      </div>
      {err && <p role="alert" className="mt-2 text-[14px] font-semibold text-danger-text">Không xóa được: {err}</p>}
    </li>
  );
}

type Load = { kind: "loading" } | { kind: "error"; error: unknown } | { kind: "ok"; runs: RunSummary[] };

/** Persistent history (GET /api/runs). Refreshes itself while any run is queued or running. */
export function History({ reloadToken }: { reloadToken: number }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    api.runs().then(
      (runs) => alive && setLoad({ kind: "ok", runs }),
      (error) => alive && setLoad({ kind: "error", error }),
    );
    return () => {
      alive = false;
    };
  }, [tick, reloadToken]);

  const anyActive = load.kind === "ok" && load.runs.some((r) => r.status === "queued" || r.status === "running");
  useEffect(() => {
    if (!anyActive) return;
    let alive = true;
    const timer = setInterval(() => {
      api.runs().then((runs) => alive && setLoad({ kind: "ok", runs }), () => undefined);
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [anyActive]);

  return (
    <section aria-labelledby="hist-h" className="space-y-4">
      <div>
        <SectionLabel>Lịch sử</SectionLabel>
        <h2 id="hist-h" className="mt-1 text-xl font-semibold">Các câu hỏi đã hỏi</h2>
        <p className="text-[14px] text-muted">Lưu trên máy chủ, vẫn còn sau khi đóng trang. Quyết định duyệt claim cũng được lưu.</p>
      </div>
      {load.kind === "loading" && <Loading what="lịch sử câu hỏi" />}
      {load.kind === "error" && (
        <ErrorState
          error={load.error}
          onRetry={() => {
            setLoad({ kind: "loading" });
            refresh();
          }}
          title="Không tải được lịch sử câu hỏi"
        />
      )}
      {load.kind === "ok" && load.runs.length === 0 && (
        <EmptyState title="Chưa có câu hỏi nào">
          Lịch sử trống. Đặt câu hỏi đầu tiên ở khung phía trên; không có câu hỏi mẫu hay số liệu mẫu nào được thêm vào.
        </EmptyState>
      )}
      {load.kind === "ok" && load.runs.length > 0 && (
        <ul className="space-y-3">
          {load.runs.map((r) => <Row key={r.id} r={r} onDeleted={refresh} />)}
        </ul>
      )}
    </section>
  );
}
