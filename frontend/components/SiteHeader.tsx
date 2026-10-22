"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, currentSession, onSessionChange } from "@/lib/auth";

const STEPS = [
  { slug: "", label: "Brief" },
  { slug: "/evidence", label: "Kho bằng chứng" },
  { slug: "/reconcile", label: "Đối soát" },
  { slug: "/memo", label: "Memo" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const m = pathname.match(/^\/runs\/([^/]+)(\/[^/]*)?/);
  const runId = m ? decodeURIComponent(m[1]) : null;
  const sub = m?.[2] ?? "";
  const onHome = pathname === "/" || !!m;
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setUser(currentSession()?.username ?? null);
    read();
    return onSessionChange(read);
  }, [pathname]);

  return (
    <header className="no-print border-b border-line bg-surface">
      <a href="#main" className="skip-link">Bỏ qua, đến nội dung chính</a>
      <div className="mx-auto flex w-full max-w-[1360px] flex-wrap items-center gap-x-6 gap-y-1 px-4 pt-3 sm:px-8">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <span className="font-mono text-[15px] font-medium text-ink">gamota-research-copilot</span>
          <span
            className="rounded border border-accent px-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-accent"
            title="MVP / prototype, không phải sản phẩm hoàn chỉnh"
          >
            MVP
          </span>
        </Link>
        <nav aria-label="Trang chính" className="ml-auto flex flex-wrap items-center gap-x-4 text-[14px] font-medium">
          <Link
            href="/"
            aria-current={pathname === "/" ? "page" : undefined}
            className={`py-2 ${onHome ? "text-accent underline decoration-2 underline-offset-8" : "text-ink hover:text-accent"}`}
          >
            Câu hỏi
          </Link>
          {user && (
            <span className="flex items-center gap-2 text-[14px] font-normal text-muted">
              <span>
                Đăng nhập: <span className="font-medium text-ink">{user}</span>
              </span>
              <button
                type="button"
                className="text-accent underline underline-offset-4 hover:no-underline"
                onClick={() => {
                  clearSession();
                  router.push("/login");
                }}
              >
                Đăng xuất
              </button>
            </span>
          )}
        </nav>
      </div>
      {runId ? (
        <nav aria-label="Các bước" className="mx-auto mt-1 flex w-full max-w-[1360px] items-center gap-1 overflow-x-auto px-4 sm:px-8">
          <Link
            href="/"
            className="mr-2 inline-flex items-center gap-1 whitespace-nowrap rounded border border-ink/40 px-2.5 py-1 text-[14px] font-medium text-ink hover:border-accent hover:text-accent"
          >
            <span aria-hidden>←</span> Về trang câu hỏi
          </Link>
          {STEPS.map((s, i) => {
            const active = sub === s.slug;
            return (
              <Link
                key={s.label}
                href={`/runs/${encodeURIComponent(runId)}${s.slug}`}
                aria-current={active ? "step" : undefined}
                className={`whitespace-nowrap border-b-[3px] px-3 py-2.5 text-[14px] hover:text-accent ${
                  active ? "border-accent font-semibold text-accent" : "border-transparent text-ink"
                }`}
              >
                <span className="mr-1.5 font-mono text-[12px] text-muted">{i + 1}</span>
                {s.label}
              </Link>
            );
          })}
        </nav>
      ) : (
        <div className="h-3" />
      )}
    </header>
  );
}
