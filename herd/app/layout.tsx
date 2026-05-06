import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "행사 참석 현황 대시보드",
  description: "HR Event Response Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
