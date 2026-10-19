"use client";

import Link from "next/link";
import { localePath } from "@/lib/i18n";
import { useLocale } from "@/lib/use-locale";

const T = {
  en: { privacy: "Privacy policy", terms: "Terms of use" },
  th: { privacy: "นโยบายความเป็นส่วนตัว", terms: "ข้อกำหนดการใช้งาน" },
};

export function LegalFooter() {
  const locale = useLocale();
  const t = T[locale];
  return (
    <footer className="mt-auto px-4 py-6 text-center text-xs text-muted/80 print:hidden">
      <Link href={localePath(locale, "/privacy")} className="hover:text-ink/70">
        {t.privacy}
      </Link>
      <span className="mx-2">·</span>
      <Link href={localePath(locale, "/terms")} className="hover:text-ink/70">
        {t.terms}
      </Link>
    </footer>
  );
}
