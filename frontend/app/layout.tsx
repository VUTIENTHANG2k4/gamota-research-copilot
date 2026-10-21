import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { AuthGate } from "@/components/AuthGate";
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
        <main id="main">
          <AuthGate>{children}</AuthGate>
        </main>
        <div className="pb-10" />
      </body>
    </html>
  );
}
