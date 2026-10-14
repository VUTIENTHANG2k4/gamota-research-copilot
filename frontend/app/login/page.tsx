"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiHttpError, ApiUnreachableError } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { SectionLabel } from "@/components/ui";

function nextPath(): string {
  const n = new URLSearchParams(window.location.search).get("next") ?? "/";
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/login") ? n : "/";
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    api.authConfig().then((c) => setDisabled(!c.enabled), () => undefined);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      saveSession(await api.login(username.trim(), password));
      window.location.assign(nextPath());
    } catch (err) {
      setError(
        err instanceof ApiUnreachableError
          ? "Không kết nối được máy chủ. Máy chủ có thể đang khởi động, hãy thử lại sau ít phút."
          : err instanceof ApiHttpError
            ? err.detail
            : "Đăng nhập không thành công.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[440px] px-4 py-12">
      <SectionLabel>Đăng nhập</SectionLabel>
      <h1 className="mt-1 text-2xl font-semibold">Trợ lý nghiên cứu thị trường game</h1>
      <p className="mt-2 text-muted">
        Bản MVP/prototype. Tài khoản do người triển khai cấp; chưa có đăng ký hay khôi phục mật khẩu.
      </p>
      {disabled ? (
        <div className="card mt-6">
          <p>Máy chủ này không bật đăng nhập.</p>
          <Link href="/" className="btn btn-primary mt-4 inline-block">
            Vào trang chủ
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="card mt-6 space-y-4">
          <label className="block">
            <span className="text-[14px] font-medium">Tên đăng nhập</span>
            <input
              className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="text-[14px] font-medium">Mật khẩu</span>
            <input
              type="password"
              className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <p role="alert" className="text-[14px] text-danger-text">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary w-full" disabled={busy || !username || !password}>
            {busy ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      )}
    </div>
  );
}
