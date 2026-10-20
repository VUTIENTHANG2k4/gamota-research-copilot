"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { api, ApiHttpError, type Level, type ReviewState, type Run, type Verdict } from "@/lib/api";
import { errorText, formatDateTime } from "@/lib/text";
import { ErrorState, Loading } from "./states";
import { RunProgress } from "./RunProgress";
import { Icon } from "./ui";

const POLL_MS = 3000;

/** What the last review decision did to the confidence of each sub-question (computed by the backend). */
export interface DecisionResult {
  claimId: string;
  state: ReviewState;
  changes: { subId: string; from: Verdict; to: Verdict }[];
}

interface RunCtx {
  run: Run;
  /** Verdict of each sub-question when this page was opened (to show how review decisions moved it). */
  openedVerdicts: Record<string, Verdict>;
  lastDecision: DecisionResult | null;
  reviewBusy: boolean;
  reviewError: string | null;
  review: (claimId: string, state: ReviewState) => Promise<void>;
  /** Fetch the run again now (used after POST /memo). */
  refresh: () => void;
}

const Ctx = createContext<RunCtx | null>(null);

export function useRun(): RunCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRun must be used inside RunProvider");
  return v;
}

function levelChanged(a: Level, b: Level) {
  return a !== b;
}

type Load = { kind: "loading" } | { kind: "error"; error: unknown } | { kind: "ok"; run: Run };

/** Loads one run, keeps polling while a job is running, and shows the question strip above every run page. */
export function RunProvider({ runId, children }: { runId: string; children: ReactNode }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [tick, setTick] = useState(0);
  const [opened, setOpened] = useState<Record<string, Verdict>>({});
  const [lastDecision, setLastDecision] = useState<DecisionResult | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const capture = useCallback((r: Run) => {
    // Remember the verdicts the first time sub-questions appear, to show later how review decisions moved them.
    setOpened((o) => (Object.keys(o).length > 0 ? o : Object.fromEntries(r.subs.map((s) => [s.id, s.verdict]))));
  }, []);

  const run = load.kind === "ok" ? load.run : null;
  const needsPolling = !!run && (run.status === "queued" || run.status === "running" || run.memo_status === "running");

  // Initial load, and manual refresh.
  useEffect(() => {
    let alive = true;
    api.run(runId).then(
      (r) => {
        if (!alive) return;
        setLoad({ kind: "ok", run: r });
        capture(r);
      },
      (error) => alive && setLoad({ kind: "error", error }),
    );
    return () => {
      alive = false;
    };
  }, [runId, tick, capture]);

  // Poll while the pipeline or a memo rewrite is running. A failed poll keeps the last known run on screen.
  useEffect(() => {
    if (!needsPolling) return;
    let alive = true;
    const timer = setInterval(() => {
      api.run(runId).then(
        (r) => {
          if (!alive) return;
          setLoad({ kind: "ok", run: r });
          capture(r);
        },
        () => undefined,
      );
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [needsPolling, runId, capture]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const review = useCallback(
    async (claimId: string, state: ReviewState) => {
      if (!run) return;
      setReviewBusy(true);
      setReviewError(null);
      try {
        const next = await api.review(runId, claimId, state);
        const changes = next.subs
          .map((s) => {
            const before = run.subs.find((x) => x.id === s.id)?.verdict;
            return before ? { subId: s.id, from: before, to: s.verdict } : null;
          })
          .filter((c): c is { subId: string; from: Verdict; to: Verdict } => c !== null && levelChanged(c.from.level, c.to.level));
        setLastDecision({ claimId, state, changes });
        setLoad({ kind: "ok", run: next });
      } catch (e) {
        setReviewError(
          e instanceof ApiHttpError && e.status === 404
            ? `${e.detail} Lần chạy hoặc claim này có thể đã bị xóa.`
            : errorText(e),
        );
      } finally {
        setReviewBusy(false);
      }
    },
    [run, runId],
  );

  const value = useMemo<RunCtx | null>(
    () =>
      run
        ? { run, openedVerdicts: opened, lastDecision, reviewBusy, reviewError, review, refresh }
        : null,
    [run, opened, lastDecision, reviewBusy, reviewError, review, refresh],
  );

  if (load.kind === "loading") {
    return (
      <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-8">
        <Loading what="lần chạy" />
      </div>
    );
  }
  if (load.kind === "error" || !value || !run) {
    return (
      <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-8">
        <ErrorState
          error={load.kind === "error" ? load.error : null}
          onRetry={refresh}
          title="Không mở được lần chạy này"
        />
        <p className="mt-4">
          <Link href="/" className="font-semibold text-accent underline">Về danh sách câu hỏi</Link>
        </p>
      </div>
    );
  }

  const inProgress = run.status === "queued" || run.status === "running";

  return (
    <Ctx.Provider value={value}>
      <div className="no-print border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-1 px-4 py-3 sm:px-8 md:flex-row md:items-baseline md:gap-6">
          <p className="min-w-0 text-[15px]">
            <span className="label-mono mr-2">Câu hỏi</span>
            <span className="font-medium">{run.question}</span>
          </p>
          <p className="shrink-0 text-[13px] text-muted md:ml-auto">
            Tạo lúc {formatDateTime(run.created_at)}
            {run.parent_id && (
              <>
                {run.context ? " · nghiên cứu tiếp từ " : " · làm rõ từ "}
                <Link
                  href={`/runs/${encodeURIComponent(run.parent_id)}${run.context ? "/memo" : ""}`}
                  className="font-medium text-accent underline"
                >
                  lần chạy trước
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-8 sm:py-8">
        {inProgress ? (
          <RunProgress stage={run.stage} since={run.created_at} title="Đang nghiên cứu câu hỏi này" />
        ) : run.status === "error" ? (
          <section role="alert" className="rounded-xl border-2 border-danger-text bg-danger-bg p-5 text-danger-text sm:p-8">
            <p className="label-mono !text-danger-text">Lần chạy kết thúc bằng lỗi</p>
            <h1 className="mt-1 flex items-center gap-2 text-[22px] font-semibold">
              <Icon name="alert" size={22} /> Không có kết quả cho câu hỏi này
            </h1>
            <p className="mt-2 text-[14px]">
              Nội dung lỗi từ máy chủ, nguyên văn. Hệ thống không tạo kết quả thay thế; bạn có thể thử đặt lại câu hỏi từ
              trang <Link href="/" className="font-semibold underline">Câu hỏi</Link>.
            </p>
            <pre className="mt-2 whitespace-pre-wrap break-words rounded border border-danger-text/30 bg-surface p-3 font-mono text-[13px] text-ink">
              {run.error ?? "(máy chủ không kèm nội dung lỗi)"}
            </pre>
          </section>
        ) : (
          children
        )}
      </div>
    </Ctx.Provider>
  );
}
