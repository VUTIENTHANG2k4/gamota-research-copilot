"use client";

import { API_URL, ApiHttpError, ApiUnreachableError, type Health } from "@/lib/api";
import { Icon } from "./ui";

export function Loading({ what = "dữ liệu" }: { what?: string }) {
  return (
    <div role="status" aria-live="polite" className="card flex items-center gap-3 text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />
      Đang tải {what} từ máy chủ...
    </div>
  );
}

export function UnreachableState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="alert" className="card border-2 border-danger-text/60">
      <p className="label-mono !text-danger-text">Lỗi kết nối</p>
      <h2 className="mt-1 text-xl font-semibold">Không kết nối được máy chủ (backend)</h2>
      <p className="mt-2">
        Giao diện không nhận được phản hồi từ máy chủ tại <code className="font-mono text-[13px] break-all">{API_URL}</code>.
        Máy chủ có thể đang tắt hoặc đang khởi động lại, hoặc địa chỉ cấu hình sai. Chưa có dữ liệu nào được hiển thị
        thay thế.
      </p>
      <p className="mt-2 text-[14px] text-muted">
        Nếu bạn đang tự chạy hệ thống: bật backend rồi thử lại. Địa chỉ máy chủ lấy từ biến{" "}
        <code className="font-mono text-[13px]">NEXT_PUBLIC_API_URL</code> (xem ui/README.md).
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-primary mt-4">
          Thử kết nối lại
        </button>
      )}
    </div>
  );
}

export function ErrorState({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  if (error instanceof ApiUnreachableError) return <UnreachableState onRetry={onRetry} />;
  const http = error instanceof ApiHttpError ? error : null;
  const dbDown = http?.status === 503;
  return (
    <div role="alert" className="card border-2 border-danger-text/60">
      <p className="label-mono !text-danger-text">{dbDown ? "Cơ sở dữ liệu không sẵn sàng" : "Lỗi"}</p>
      <h2 className="mt-1 text-xl font-semibold">
        {title ?? (http?.status === 404 ? "Không tìm thấy" : dbDown ? "Máy chủ chưa dùng được cơ sở dữ liệu" : "Máy chủ báo lỗi")}
      </h2>
      <p className="mt-2">
        {http ? (
          <>
            <span className="font-mono text-[13px]">HTTP {http.status}</span>: {http.detail}
          </>
        ) : (
          "Đã xảy ra lỗi không xác định khi tải dữ liệu."
        )}
      </p>
      {dbDown && (
        <p className="mt-1 text-[14px] text-muted">
          Lịch sử, kết quả đã lưu và đoạn gốc đều nằm trong cơ sở dữ liệu nên chưa mở được. Hãy thử lại sau.
        </p>
      )}
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-secondary mt-4">
          Thử lại
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border-[1.5px] border-dashed border-ink/60 bg-surface p-6">
      <div className="flex items-start gap-3">
        <span className="mt-1 text-muted"><Icon name="dashed-circle" size={22} /></span>
        <div>
          <p className="text-[17px] font-semibold">{title}</p>
          {children && <div className="mt-1 text-muted">{children}</div>}
        </div>
      </div>
    </div>
  );
}

/** Document store not ready (GET /api/health corpus.state). Questions cannot be started until it is ready. */
export function CorpusNotReady({ corpus, onRetry }: { corpus: Health["corpus"]; onRetry: () => void }) {
  const failed = corpus.state === "error";
  return (
    <div role="alert" className={`rounded-xl border-2 p-5 ${failed ? "border-danger-text bg-danger-bg text-danger-text" : "border-warn-border bg-warn-bg text-warn-text"}`}>
      <p className="flex items-center gap-2 text-[17px] font-semibold">
        <Icon name="alert" size={18} />
        {failed ? "Kho tài liệu bị lỗi khi nạp" : "Kho tài liệu đang được nạp"}
      </p>
      {failed ? (
        <>
          <p className="mt-1 text-[14px]">Máy chủ báo lỗi, nguyên văn:</p>
          <pre className="mt-1 whitespace-pre-wrap break-words rounded border border-danger-text/30 bg-surface p-2 font-mono text-[13px] text-ink">
            {corpus.error ?? "(không kèm nội dung lỗi)"}
          </pre>
          <p className="mt-2 text-[14px]">Chưa thể bắt đầu câu hỏi mới. Báo cho người vận hành máy chủ, rồi thử lại.</p>
        </>
      ) : (
        <p className="mt-1 text-[14px]">
          Máy chủ vừa khởi động và đang nạp 30 tài liệu vào cơ sở dữ liệu ({corpus.state === "ingesting" ? "đang nạp" : "đang khởi động"}).
          Chưa thể bắt đầu câu hỏi mới, và đoạn gốc của claim có thể chưa mở được. Hãy thử lại sau ít phút.
        </p>
      )}
      <button type="button" onClick={onRetry} className="btn btn-secondary mt-3 bg-surface">
        Kiểm tra lại
      </button>
    </div>
  );
}
