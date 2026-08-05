import type { Metadata, Viewport } from "next";

import "./style.css";

export const metadata: Metadata = {
  title: "TRPGシナリオ検索 | Fixture Archive",
  description:
    "合成した全年齢フィクスチャを条件検索する、読み取り専用のTRPGシナリオ検索アーカイブです。",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
    noimageindex: true,
    nosnippet: true,
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#17483f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
