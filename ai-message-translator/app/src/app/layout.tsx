import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI 已讀不回翻譯機",
  description:
    "上傳 LINE 聊天截圖或貼上對話，AI 幫你翻譯潛台詞、評估興趣指數、提供回覆建議",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-TW"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Global navigation bar */}
        <nav className="w-full bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link
              href="/"
              className="text-lg font-bold text-gray-900 hover:text-indigo-600 transition-colors"
            >
              AI 已讀不回翻譯機
            </Link>
            <div className="flex items-center gap-4 text-sm font-medium">
              <Link
                href="/"
                className="text-gray-600 hover:text-indigo-600 transition-colors"
              >
                分析
              </Link>
              <Link
                href="/history"
                className="text-gray-600 hover:text-indigo-600 transition-colors"
              >
                歷史紀錄
              </Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
