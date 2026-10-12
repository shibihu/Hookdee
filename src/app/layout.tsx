import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hookdee — สคริปต์ที่ยังเป็นเสียงของคุณ",
  description: "เครื่องมือช่วยรีวิวและพัฒนาสคริปต์วิดีโอสั้นให้เป็นธรรมชาติในแบบของคุณ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
