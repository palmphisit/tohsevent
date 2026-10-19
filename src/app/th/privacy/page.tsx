import type { Metadata } from "next";
import { HtmlLang } from "@/components/html-lang";
import { languageAlternates } from "@/lib/site";
import { PrivacyTh } from "../../_site/privacy-th";

export const metadata: Metadata = { title: "นโยบายความเป็นส่วนตัว", alternates: languageAlternates("/privacy", "th") };

export default function PrivacyPageTh() {
  return (
    <>
      <HtmlLang lang="th" />
      <PrivacyTh />
    </>
  );
}
