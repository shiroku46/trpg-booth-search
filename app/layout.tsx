import type { Metadata } from "next";
import "./style.css";
export const metadata: Metadata = {
  title: "TRPGシナリオ検索（固定デモ）",
  description: "合成フィクスチャだけを使う検索デモ",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
