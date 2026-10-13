"use client";

import { createContext, useContext, type ReactNode } from "react";
import { api, type Run } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { ErrorState, Loading } from "./states";
import { Banner } from "./ui";

interface RunCtx {
  run: Run;
  originNote: string;
  origin: "saved" | "live";
}

const Ctx = createContext<RunCtx | null>(null);

export function useRun(): RunCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRun must be used inside RunProvider");
  return v;
}

async function loadRun(key: string) {
  const run = await api.run(key);
  // The origin note comes from the API list; if the list fails we fall back to the key prefix.
  let note: { origin: "saved" | "live"; origin_note: string } | undefined;
  try {
    note = (await api.runs()).find((r) => r.key === key);
  } catch {
    note = undefined;
  }
  const origin: "saved" | "live" = note?.origin ?? (key.startsWith("live-") ? "live" : "saved");
  const originNote =
    note?.origin_note ??
    (origin === "live"
      ? "Chạy trực tiếp: kết quả mới của pipeline, không phải kết quả đã lưu."
      : "Kết quả đã lưu từ lần chạy kiểm thử P4 (vòng 1), không phải chạy mới.");
  return { run, origin, originNote };
}

/** Loads one run and shows the run header strip (question + data origin) above every run page. */
export function RunProvider({ runKey, children }: { runKey: string; children: ReactNode }) {
  const { state, reload } = useApi(() => loadRun(runKey), runKey);

  if (state.status === "loading") {
    return (
      <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-8">
        <Loading what="kết quả của lần chạy" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-8">
        <ErrorState error={state.error} onRetry={reload} title="Không mở được lần chạy này" />
      </div>
    );
  }

  const { run, origin, originNote } = state.data;
  return (
    <Ctx.Provider value={{ run, origin, originNote }}>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-1 px-4 py-3 sm:px-8 md:flex-row md:items-baseline md:gap-6">
          <p className="min-w-0 text-[15px]">
            <span className="label-mono mr-2">Câu hỏi {run.key}</span>
            <span className="font-medium">{run.question}</span>
          </p>
          <p
            className={`inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-[13px] font-medium md:ml-auto ${
              origin === "saved"
                ? "border-warn-border bg-warn-bg text-warn-text"
                : "border-accent bg-subtle text-accent"
            }`}
          >
            {originNote}
          </p>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-8 sm:py-8">
        {run.needs_clarification && (
          <div className="mb-6">
            <Banner tone="warn" title="Chưa chạy nghiên cứu nào cho câu hỏi này">
              Câu hỏi còn mơ hồ nên hệ thống chỉ hỏi lại. Kho bằng chứng, đối soát và memo không có nội dung vì
              chưa có truy xuất hay trích claim.
            </Banner>
          </div>
        )}
        {children}
      </div>
    </Ctx.Provider>
  );
}
