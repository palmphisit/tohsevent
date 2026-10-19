import type { Metadata } from "next";
import { HtmlLang } from "@/components/html-lang";
import { languageAlternates, SITE_COPY } from "@/lib/site";
import { Landing } from "../_site/landing";

export const metadata: Metadata = {
  title: { absolute: SITE_COPY.th.title },
  description: SITE_COPY.th.description,
  alternates: languageAlternates("/", "th"),
  openGraph: { locale: SITE_COPY.th.ogLocale, url: "/th", title: SITE_COPY.th.title, description: SITE_COPY.th.description },
};

export default function HomeTh() {
  return (
    <>
      <HtmlLang lang="th" />
      <Landing locale="th" />
    </>
  );
}
