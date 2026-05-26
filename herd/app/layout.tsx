import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "멘토링 운영 대시보드",
  description: "Hecto Innovation HR Mentoring Dashboard",
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
