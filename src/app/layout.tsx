import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "لوحة تحكم مدير الإدارة",
  description: "لوحة تحكم بصلاحيات لإدارة المدراء وإدخال البيانات",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
