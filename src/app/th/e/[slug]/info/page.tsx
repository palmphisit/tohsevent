import type { Metadata } from "next";
import { InfoPage } from "@/app/e/[slug]/info/info-page";
import { HtmlLang } from "@/components/html-lang";

export const metadata: Metadata = { title: { absolute: "รายละเอียดงาน · Tohs Event" }, robots: { index: false, follow: false } };

export default function EventInfoPageTh({ params, searchParams }: PageProps<"/th/e/[slug]/info">) {
  return (
    <>
      <HtmlLang lang="th" />
      <InfoPage params={params} searchParams={searchParams} locale="th" />
    </>
  );
}
