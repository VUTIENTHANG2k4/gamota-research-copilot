"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Icon, SectionLabel, SyntheticTag } from "@/components/ui";
import { ErrorState, Loading } from "@/components/states";

export default function LimitationsPage() {
  const { state, reload } = useApi(() => api.about(), "about");

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-6 sm:px-8 sm:py-8">
      <SectionLabel>Giới hạn đã biết</SectionLabel>
      <h1 className="mt-1 text-[26px] font-semibold leading-[1.35] tracking-[-0.015em]">
        Công cụ này chưa làm được gì, và dùng nó thế nào cho đúng
      </h1>
      <p className="mt-2 text-muted">
        Đây là bản MVP (prototype), không phải sản phẩm hoàn chỉnh. Một kết quả chỉ đáng tin khi bạn biết nó không đáng tin ở
        đâu, nên danh sách dưới đây luôn có link trên đầu mọi trang.
      </p>

      <div className="mt-6 space-y-6">
        {state.status === "loading" && <Loading what="danh sách giới hạn" />}
        {state.status === "error" && (
          <ErrorState error={state.error} onRetry={reload} title="Không đọc được danh sách giới hạn" />
        )}
        {state.status === "ok" && (
          <>
            <section aria-labelledby="corpus-h" className="card">
              <SectionLabel>Kho tài liệu</SectionLabel>
              <h2 id="corpus-h" className="mt-1 text-xl font-semibold">Kho cố định, không tự cập nhật</h2>
              <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-line bg-subtle p-3">
                  <dd className="text-[28px] font-semibold tabular">{state.data.corpus.documents}</dd>
                  <dt className="text-[13px] text-muted">tài liệu trong kho</dt>
                </div>
                <div className="rounded-lg border border-warn-border bg-warn-bg p-3 text-warn-text">
                  <dd className="text-[28px] font-semibold tabular">{state.data.corpus.synthetic}</dd>
                  <dt className="text-[13px]">tài liệu <SyntheticTag className="align-middle" /> (tự soạn)</dt>
                </div>
                <div className="rounded-lg border border-line bg-subtle p-3">
                  <dd className="text-[28px] font-semibold tabular">{state.data.corpus.real}</dd>
                  <dt className="text-[13px] text-muted">tài liệu thật</dt>
                </div>
              </dl>
              <p className="mt-3 text-[14px]">
                Hệ thống chỉ biết những gì có trong kho này. Câu hỏi nằm ngoài kho sẽ nhận &quot;Chưa đủ căn cứ&quot; thay vì một
                con số ước đoán.
              </p>
            </section>

            <section
              aria-labelledby="lim-h"
              className="rounded-xl border-2 border-warn-border bg-warn-bg p-5 text-warn-text sm:p-8"
            >
              <p className="label-mono !text-warn-text">Hãy đọc trước khi dùng kết quả</p>
              <h2 id="lim-h" className="mt-1 text-xl font-semibold">Giới hạn của bản MVP</h2>
              {state.data.limitations.length === 0 ? (
                <p className="mt-3 font-medium">Máy chủ không trả về danh sách giới hạn nào. Hãy coi mọi kết quả là chưa được kiểm chứng.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {state.data.limitations.map((s, i) => (
                    <li key={i} className="flex gap-3 text-[16px] font-medium">
                      <span className="mt-1"><Icon name="alert" size={18} /></span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-[14px]">
              <Link href="/" className="font-semibold text-accent underline">Về trang Câu hỏi</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
