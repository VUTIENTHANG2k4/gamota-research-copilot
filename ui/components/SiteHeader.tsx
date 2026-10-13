"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const STEPS = [
  { slug: "", label: "Brief" },
  { slug: "/evidence", label: "Kho bằng chứng" },
  { slug: "/reconcile", label: "Đối soát" },
  { slug: "/memo", label: "Memo" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const m = pathname.match(/^\/runs\/([^/]+)(\/[^/]*)?/);
  const runKey = m ? decodeURIComponent(m[1]) : null;
  const sub = m?.[2] ?? "";
  const onPage = (p: string) => pathname === p || pathname.startsWith(p + "/");

  return (
    <header className="border-b border-line bg-surface">
      <a href="#main" className="skip-link">Bỏ qua, đến nội dung chính</a>
      <div className="mx-auto flex w-full max-w-[1360px] flex-wrap items-center gap-x-6 gap-y-2 px-4 pt-3 sm:px-8">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <span className="font-mono text-[15px] font-medium text-ink">gamota-research-copilot</span>
          <span
            className="rounded border border-accent px-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-accent"
            title="MVP / prototype, không phải sản phẩm hoàn chỉnh"
          >
            MVP
          </span>
        </Link>
        <nav aria-label="Trang phụ" className="ml-auto flex flex-wrap items-center gap-x-5 text-[14px] font-medium">
          <Link
            href="/test-results"
            aria-current={onPage("/test-results") ? "page" : undefined}
            className={`py-2 ${onPage("/test-results") ? "text-accent underline decoration-2 underline-offset-8" : "text-ink hover:text-accent"}`}
          >
            Kết quả kiểm thử
          </Link>
          <Link
            href="/limitations"
            aria-current={onPage("/limitations") ? "page" : undefined}
            className={`rounded border px-2.5 py-1.5 ${
              onPage("/limitations")
                ? "border-warn-border bg-warn-bg text-warn-text"
                : "border-warn-border bg-warn-bg/60 text-warn-text hover:bg-warn-bg"
            }`}
          >
            Giới hạn đã biết
          </Link>
        </nav>
      </div>
      <nav aria-label="Các bước" className="mx-auto mt-1 flex w-full max-w-[1360px] gap-1 overflow-x-auto px-4 sm:px-8">
        {STEPS.map((s, i) => {
          const href = runKey ? `/runs/${encodeURIComponent(runKey)}${s.slug}` : s.slug === "" ? "/" : null;
          const active = runKey ? sub === s.slug : pathname === "/" && s.slug === "";
          const cls = `whitespace-nowrap border-b-[3px] px-3 py-2.5 text-[14px] ${
            active ? "border-accent font-semibold text-accent" : "border-transparent text-ink"
          }`;
          const label = (
            <>
              <span className="mr-1.5 font-mono text-[12px] text-muted">{i + 1}</span>
              {s.label}
            </>
          );
          return href ? (
            <Link key={s.label} href={href} aria-current={active ? "step" : undefined} className={`${cls} hover:text-accent`}>
              {label}
            </Link>
          ) : (
            <span
              key={s.label}
              className={`${cls} cursor-not-allowed text-muted`}
              title="Chọn một câu hỏi ở bước Brief trước"
            >
              {label}
            </span>
          );
        })}
      </nav>
    </header>
  );
}
