"use client";

import Link from "next/link";
import { api, type RunSummary } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Banner, SectionLabel } from "@/components/ui";
import { EmptyState, ErrorState, Loading } from "@/components/states";
import { NewQuestionForm } from "@/components/NewQuestionForm";

function RunRow({ r }: { r: RunSummary }) {
  return (
    <li>
      <Link
        href={`/runs/${encodeURIComponent(r.key)}`}
        className="block rounded-lg border border-line bg-surface p-4 no-underline hover:border-accent hover:bg-subtle"
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-[13px] font-medium text-accent">{r.label}</span>
          <span className="text-[13px] text-muted">{r.origin_note}</span>
        </div>
        <p className="mt-1 text-[16px] font-medium">{r.question}</p>
      </Link>
    </li>
  );
}

export default function BriefPage() {
  const { state, reload } = useApi(() => api.runs(), "runs");

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-6 max-w-3xl">
        <SectionLabel>Bước 1: Brief</SectionLabel>
        <h1 className="mt-1 text-[26px] font-semibold leading-[1.35] tracking-[-0.015em]">
          Bắt đầu từ một câu hỏi nghiên cứu
        </h1>
        <p className="mt-2 text-muted">
          Chọn một câu hỏi đã có kết quả lưu, hoặc nhập câu hỏi mới. Hệ thống biến câu hỏi thành brief (bản tóm tắt
          nhiệm vụ: quyết định cần hỗ trợ, phạm vi, các câu hỏi con), rồi đi qua kho bằng chứng và đối soát mâu thuẫn để ra
          memo (bản ghi nhớ một trang).
        </p>
      </div>

      <div className="mb-6">
        <Banner tone="warn" title="Bản MVP, kết quả chưa đầy đủ">
          Các câu hỏi bên dưới là kết quả đã lưu từ lần chạy kiểm thử P4, không phải chạy mới. Trong kho nguồn có tài liệu
          SYNTHETIC (tự soạn để thử hệ thống) và nhiều câu hỏi con vẫn ở trạng thái &quot;Chưa đủ căn cứ&quot;. Xem trang{" "}
          <Link href="/limitations" className="font-semibold underline">Giới hạn đã biết</Link>.
        </Banner>
      </div>

      <div className="grid gap-6 min-[1060px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] min-[1060px]:items-start">
        <section className="card" aria-labelledby="saved-h">
          <SectionLabel>Câu hỏi đã lưu</SectionLabel>
          <h2 id="saved-h" className="mt-1 text-xl font-semibold">Chọn một câu hỏi để xem kết quả</h2>
          <div className="mt-4">
            {state.status === "loading" && <Loading what="danh sách câu hỏi" />}
            {state.status === "error" && <ErrorState error={state.error} onRetry={reload} />}
            {state.status === "ok" && state.data.length === 0 && (
              <EmptyState title="Chưa có lần chạy nào được lưu">
                API trả về danh sách rỗng. Không có dữ liệu mẫu nào được hiển thị thay thế.
              </EmptyState>
            )}
            {state.status === "ok" && state.data.length > 0 && (
              <ul className="space-y-3">
                {state.data.map((r) => <RunRow key={r.key} r={r} />)}
              </ul>
            )}
          </div>
        </section>

        <NewQuestionForm />
      </div>
    </div>
  );
}
