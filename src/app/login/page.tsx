import { Check } from "lucide-react";
import { Suspense } from "react";
import { BrandLogo, BrandMark } from "@/components/brand";
import { LegalFooter } from "@/components/legal-footer";
import { connection } from "next/server";
import { googleEnabled } from "@/server/google";
import { GoogleSignIn } from "./google-sign-in";
import { LoginForm } from "./login-form";

export const metadata = { title: { absolute: "เข้าสู่ระบบ · Tohs Event" }, robots: { index: false, follow: false } };

const BENEFITS = [
  "สร้างงานและ QR Code ได้ในไม่ถึงนาที",
  "แขกอัปโหลดรูปและวิดีโอได้ทันที ไม่ต้องโหลดแอป",
  "ดูแล ซ่อน ลบ และดาวน์โหลดทุกรูปได้จากที่เดียว",
];

export default function LoginPage() {
  return (
    <div className="grid flex-1 md:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-sky-600 p-12 text-white md:flex md:flex-col md:justify-between">
        <div className="pointer-events-none absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-sky-400/30 blur-3xl" />
        <div className="flex items-center gap-2 text-lg font-semibold">
          <BrandMark className="h-9 w-9" /> Tohs Event
        </div>
        <div className="relative">
          <h2 className="text-3xl leading-snug font-semibold">รวมทุกรูปของงาน ไว้ในอัลบั้มเดียว</h2>
          <ul className="mt-8 space-y-3 text-blue-50">
            {BENEFITS.map((b) => (
              <li key={b} className="flex gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-sky-200" /> {b}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-blue-100">สำหรับเจ้าภาพ ออร์แกไนเซอร์ และช่างภาพ</p>
      </aside>

      <div className="flex flex-col bg-slate-50">
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
          <BrandLogo className="mb-8 md:hidden" />
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight">ยินดีต้อนรับ</h1>
            <p className="mt-1 text-sm text-slate-500">เข้าสู่ระบบหรือสร้างบัญชีเพื่อจัดการงานของคุณ</p>
            <Suspense>
              <GoogleSlot />
            </Suspense>
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </main>
        <LegalFooter />
      </div>
    </div>
  );
}

/** Shown only when Google OAuth is configured on the server (read at request time). */
async function GoogleSlot() {
  await connection();
  return googleEnabled() ? <GoogleSignIn /> : null;
}
