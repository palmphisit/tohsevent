import type { Metadata } from "next";
import { HtmlLang } from "@/components/html-lang";
import { languageAlternates } from "@/lib/site";
import { TermsTh } from "../../_site/terms-th";

export const metadata: Metadata = { title: "ข้อกำหนดการใช้งาน", alternates: languageAlternates("/terms", "th") };

export default function TermsPageTh() {
  return (
    <>
      <HtmlLang lang="th" />
      <TermsTh />
    </>
  );
}
