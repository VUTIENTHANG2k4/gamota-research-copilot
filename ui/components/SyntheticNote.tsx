"use client";

import { useAbout } from "@/lib/useAbout";
import { Banner } from "./ui";

/** Standing line about SYNTHETIC documents; the counts come from GET /api/about. */
export function SyntheticNote({ compact = false }: { compact?: boolean }) {
  const about = useAbout();
  const text = about
    ? `Kho gồm ${about.corpus.synthetic} tài liệu SYNTHETIC (tự soạn); chúng không bao giờ được dùng để kết luận`
    : "Kho có các tài liệu SYNTHETIC (tự soạn); chúng không bao giờ được dùng để kết luận";
  if (compact) {
    return (
      <p className="rounded border border-warn-border bg-warn-bg px-3 py-1.5 text-[13px] font-medium text-warn-text">{text}.</p>
    );
  }
  return (
    <Banner tone="warn" title={text}>
      Claim từ tài liệu SYNTHETIC luôn mang nhãn SYNTHETIC và không được tính vào mức chắc chắn.
    </Banner>
  );
}
