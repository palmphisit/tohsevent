import { Check } from "lucide-react";
import { Suspense } from "react";
import { BrandLogo, BrandMark } from "@/components/brand";
import { LegalFooter } from "@/components/legal-footer";
import { connection } from "next/server";
import { googleEnabled } from "@/server/google";
import { GoogleSignIn } from "../login/google-sign-in";
import { LanguageSwitch } from "@/components/language-switch";
import { localePath, type Locale } from "@/lib/i18n";
import { LoginForm } from "../login/login-form";


const COPY = {
  en: {
    benefits: [
      "Create an event and QR code in under a minute",
      "Guests upload photos and videos instantly, no app needed",
      "Moderate, hide, delete and download every photo in one place",
    ],
    tagline: "Every photo of your event, in one album",
    audience: "For hosts, organizers and photographers",
    welcome: "Welcome",
    intro: "Sign in or create an account to manage your events",
  },
  th: {
    benefits: [
      "สร้างงานและ QR Code ได้ในไม่ถึงนาที",
      "แขกอัปโหลดรูปและวิดีโอได้ทันที ไม่ต้องโหลดแอป",
      "ดูแล ซ่อน ลบ และดาวน์โหลดทุกรูปได้จากที่เดียว",
    ],
    tagline: "รวมทุกรูปของงาน ไว้ในอัลบั้มเดียว",
    audience: "สำหรับเจ้าภาพ ออร์แกไนเซอร์ และช่างภาพ",
    welcome: "ยินดีต้อนรับ",
    intro: "เข้าสู่ระบบหรือสร้างบัญชีเพื่อจัดการงานของคุณ",
  },
};

export function LoginView({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  return (
    <div className="grid flex-1 md:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-sky-600 p-12 text-white md:flex md:flex-col md:justify-between">
        <div className="pointer-events-none absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-sky-400/30 blur-3xl" />
        <div className="flex items-center gap-2 text-lg font-semibold">
          <BrandMark className="h-9 w-9" /> Tohs Event
        </div>
        <div className="relative">
          <h2 className="text-3xl leading-snug font-semibold">{t.tagline}</h2>
          <ul className="mt-8 space-y-3 text-blue-50">
            {t.benefits.map((b) => (
              <li key={b} className="flex gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-sky-200" /> {b}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-blue-100">{t.audience}</p>
      </aside>

      <div className="flex flex-col bg-slate-50">
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
          <div className="mb-8 flex items-center justify-between gap-3">
            <BrandLogo href={localePath(locale, "/")} className="md:hidden" />
            <Suspense>
              <LanguageSwitch className="ml-auto" />
            </Suspense>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight">{t.welcome}</h1>
            <p className="mt-1 text-sm text-slate-500">{t.intro}</p>
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
