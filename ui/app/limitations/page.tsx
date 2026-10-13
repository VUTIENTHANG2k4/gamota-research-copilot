"use client";

import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Banner, Icon, SectionLabel } from "@/components/ui";
import { ErrorState, Loading } from "@/components/states";
import { Markdown } from "@/components/Markdown";

export default function LimitationsPage() {
  const { state, reload } = useApi(() => api.limitations(), "limitations");

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-8 sm:py-8">
      <SectionLabel>Giới hạn đã biết</SectionLabel>
      <h1 className="mt-1 text-[26px] font-semibold leading-[1.35] tracking-[-0.015em]">
        Những gì bản MVP này chưa làm được
      </h1>
      <p className="mt-2 max-w-3xl text-muted">
        Danh sách này lấy từ báo cáo của evaluator (người chấm độc lập) và từ nhật ký tiến độ dự án. Nó được đặt ở trang
        riêng, luôn có link trên đầu mọi trang, vì một kết quả chỉ đáng tin khi biết nó không đáng tin ở đâu.
      </p>

      <div className="mt-6 space-y-6">
        {state.status === "loading" && <Loading what="danh sách giới hạn" />}
        {state.status === "error" && <ErrorState error={state.error} onRetry={reload} title="Không đọc được danh sách giới hạn" />}
        {state.status === "ok" && (
          <>
            <section aria-labelledby="fixed-h" className="rounded-xl border-2 border-warn-border bg-warn-bg p-5 text-warn-text sm:p-8">
              <p className="label-mono !text-warn-text">Luôn đúng ở mọi lần chạy</p>
              <h2 id="fixed-h" className="mt-1 text-xl font-semibold">Giới hạn cố định của MVP</h2>
              <ul className="mt-4 space-y-3">
                {state.data.fixed_statements.map((s, i) => (
                  <li key={i} className="flex gap-3 text-[16px] font-medium">
                    <span className="mt-1"><Icon name="alert" size={18} /></span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card" aria-labelledby="def-h">
              <SectionLabel>Lỗi đã biết</SectionLabel>
              <h2 id="def-h" className="mt-1 text-xl font-semibold">Lỗi và hạn chế quan sát được, xếp theo mức ảnh hưởng</h2>
              <p className="mt-1 text-[14px] text-muted">
                Nguyên văn mục 8 trong báo cáo kiểm thử. Chưa lỗi nào được sửa vì sửa sẽ làm vòng đo không còn hợp lệ.
              </p>
              {state.data.defects_markdown.trim() ? (
                <Markdown text={state.data.defects_markdown} className="mt-3" />
              ) : (
                <div className="mt-3">
                  <Banner tone="danger" title="API không trả về danh sách lỗi">
                    Không có nội dung thay thế được hiển thị. Hãy đọc trực tiếp tests/reports/{state.data.report_file}.
                  </Banner>
                </div>
              )}
            </section>

            <section className="card" aria-labelledby="nt-h">
              <SectionLabel>Không kiểm tra được</SectionLabel>
              <h2 id="nt-h" className="mt-1 text-xl font-semibold">Phần chưa được thử hoặc không thể kết luận</h2>
              {state.data.not_testable_markdown.trim() ? (
                <Markdown text={state.data.not_testable_markdown} className="mt-3" />
              ) : (
                <p className="mt-2 text-muted">API không trả về nội dung mục này.</p>
              )}
            </section>

            <section className="card" aria-labelledby="prog-h">
              <SectionLabel>Nhật ký tiến độ</SectionLabel>
              <h2 id="prog-h" className="mt-1 text-xl font-semibold">Trích từ docs/PROGRESS.md (tiếng Anh, nguyên văn)</h2>
              <p className="mt-1 text-[14px] text-muted">
                Phần này được giữ nguyên văn tiếng Anh vì nó là ghi chép nội bộ của đội, không dịch lại để tránh làm lệch ý.
              </p>
              <details className="mt-3">
                <summary className="cursor-pointer font-semibold">Mở danh sách lỗi mở và phần chưa kiểm</summary>
                <div className="mt-3 space-y-4">
                  {state.data.defects_from_progress ? (
                    <Markdown text={state.data.defects_from_progress} />
                  ) : (
                    <p className="text-muted">Không đọc được mục lỗi mở từ PROGRESS.md.</p>
                  )}
                  {state.data.not_checked && <Markdown text={state.data.not_checked} />}
                </div>
              </details>
            </section>

            <p className="text-[14px] text-muted">
              Nguồn: <span className="font-mono">tests/reports/{state.data.report_file}</span> và{" "}
              <span className="font-mono">docs/PROGRESS.md</span>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
