import type { Metadata } from "next";
import { languageAlternates, SITE_COPY } from "@/lib/site";
import { Landing } from "./_site/landing";

export const metadata: Metadata = {
  title: { absolute: SITE_COPY.en.title },
  description: SITE_COPY.en.description,
  alternates: languageAlternates("/", "en"),
  openGraph: { locale: SITE_COPY.en.ogLocale, url: "/", title: SITE_COPY.en.title, description: SITE_COPY.en.description },
};

export default function Home() {
  return <Landing locale="en" />;
}
