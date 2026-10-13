"use client";

import { API_URL, ApiHttpError, ApiUnreachableError } from "@/lib/api";
import { Icon } from "./ui";

export function Loading({ what = "dữ liệu" }: { what?: string }) {
  return (
    <div role="status" aria-live="polite" className="card flex items-center gap-3 text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />
      Đang tải {what} từ máy chủ API...
    </div>
  );
}

export function UnreachableState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="alert" className="card border-danger-text/50">
      <p className="label-mono !text-danger-text">Lỗi kết nối</p>
      <h2 className="mt-1 text-xl font-semibold">Không kết nối được máy chủ API</h2>
      <p className="mt-2">
        Giao diện chỉ đọc dữ liệu từ backend tại <code className="font-mono text-[13px]">{API_URL}</code> và hiện không
        có phản hồi. Không có nội dung nào được thay thế bằng dữ liệu mẫu.
      </p>
      <p className="mt-3 font-semibold">Cách khởi động backend</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5">
        <li>
          Bật PostgreSQL (cần để mở đoạn gốc của claim):{" "}
          <code className="font-mono text-[13px]">docker compose up -d</code>
        </li>
        <li>
          Từ thư mục gốc của repo, chạy:{" "}
          <code className="font-mono text-[13px] break-all">.venv\Scripts\python -m uvicorn api.main:app --port 8000</code>
        </li>
        <li>
          Địa chỉ API đặt trong <code className="font-mono text-[13px]">ui/.env.local</code> (
          <code className="font-mono text-[13px]">NEXT_PUBLIC_API_URL</code>); backend chỉ cho phép trang chạy ở
          http://localhost:3000.
        </li>
      </ol>
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
  return (
    <div role="alert" className="card border-danger-text/50">
      <p className="label-mono !text-danger-text">Lỗi</p>
      <h2 className="mt-1 text-xl font-semibold">{title ?? (http?.status === 404 ? "Không tìm thấy" : "Máy chủ báo lỗi")}</h2>
      <p className="mt-2">
        {http ? (
          <>
            <span className="font-mono text-[13px]">HTTP {http.status}</span>: {http.detail}
          </>
        ) : (
          "Đã xảy ra lỗi không xác định khi tải dữ liệu."
        )}
      </p>
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
