import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hookdee — สคริปต์ที่ยังเป็นเสียงของคุณ",
  description:
    "รีวิว Hook, จังหวะ, ความชัดเจน และภาษาไทยของสคริปต์วิดีโอสั้น พร้อมแนวทางปรับให้พูดได้เป็นธรรมชาติ",
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
