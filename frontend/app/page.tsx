"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiUnreachableError, type Health } from "@/lib/api";
import { History } from "@/components/History";
import { NewQuestionForm } from "@/components/NewQuestionForm";
import { CorpusNotReady, Loading, UnreachableState } from "@/components/states";

type HealthLoad = { kind: "loading" } | { kind: "ok"; health: Health } | { kind: "unreachable" } | { kind: "http"; text: string };

export default function HomePage() {
  const [health, setHealth] = useState<HealthLoad>({ kind: "loading" });
  const [tick, setTick] = useState(0);
  const [historyToken, setHistoryToken] = useState(0);

  useEffect(() => {
    let alive = true;
    api.health().then(
      (h) => alive && setHealth({ kind: "ok", health: h }),
      (e) => {
        if (!alive) return;
        setHealth(e instanceof ApiUnreachableError ? { kind: "unreachable" } : { kind: "http", text: e instanceof Error ? e.message : "Lỗi không xác định" });
      },
    );
    return () => {
      alive = false;
    };
  }, [tick]);

  // While the document store is loading, check again every few seconds so the page unlocks by itself.
  const notReady = health.kind === "ok" && health.health.corpus.state !== "ready";
  const loadingStore = notReady && health.health.corpus.state !== "error";
  useEffect(() => {
    if (!loadingStore) return;
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, [loadingStore]);

  const recheck = useCallback(() => {
    setHealth({ kind: "loading" });
    setTick((n) => n + 1);
    setHistoryToken((n) => n + 1);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-8 px-4 py-6 sm:px-8 sm:py-8">
      {health.kind === "loading" && <Loading what="trạng thái máy chủ" />}
      {health.kind === "unreachable" && <UnreachableState onRetry={recheck} />}
      {health.kind === "http" && (
        <div role="alert" className="card border-2 border-danger-text/60">
          <p className="font-semibold">Máy chủ báo lỗi khi kiểm tra trạng thái</p>
          <p className="mt-1">{health.text}</p>
          <button type="button" className="btn btn-secondary mt-3" onClick={recheck}>Thử lại</button>
        </div>
      )}
      {health.kind === "ok" && notReady && <CorpusNotReady corpus={health.health.corpus} onRetry={recheck} />}

      {health.kind !== "unreachable" && (
        <>
          <NewQuestionForm
            blockedReason={
              health.kind === "ok" && notReady
                ? "Chưa thể gửi câu hỏi vì kho tài liệu chưa sẵn sàng (xem thông báo phía trên)."
                : undefined
            }
            onStarted={() => setHistoryToken((n) => n + 1)}
          />
          <History reloadToken={historyToken} />
        </>
      )}
    </div>
  );
}
