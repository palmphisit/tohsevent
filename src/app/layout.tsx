import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "Tohs Event",
  description: "แชร์รูปในงานอีเวนต์ด้วย QR Code — ไม่ต้องโหลดแอป ไม่ต้องสมัครสมาชิก",
  appleWebApp: { capable: true, title: "Tohs Event", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#18181b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${notoSansThai.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
