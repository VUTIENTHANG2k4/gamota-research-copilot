import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "gamota-research-copilot (MVP)",
  description: "Trợ lý nghiên cứu thị trường game: memo một trang, mọi con số dẫn về đoạn gốc. Bản MVP/prototype.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${inter.variable} ${plexMono.variable}`}>
      <body className="min-h-screen">
        <SiteHeader />
        <main id="main">{children}</main>
        <footer className="no-print mx-auto mt-4 w-full max-w-[1360px] px-4 pb-10 text-[13px] text-muted sm:px-8">
          Bản MVP/prototype do AI hỗ trợ soạn. Mọi con số lấy từ máy chủ và kho 30 tài liệu cố định; tài liệu SYNTHETIC là
          tài liệu tự soạn để thử hệ thống, không dùng để kết luận.
        </footer>
      </body>
    </html>
  );
}
