import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "تدبّر — Tadabbur",
  description:
    "أداة التدبر القرآني — تطبيق منهجية فريد الأنصاري في التدبر والتدارس",
  keywords: ["تدبر", "قرآن", "تفسير", "tadabbur", "quran"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full pattern-bg">{children}</body>
    </html>
  );
}
