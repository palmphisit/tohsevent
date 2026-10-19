import type { Metadata } from "next";
import { AlbumPage } from "@/app/e/[slug]/album-page";
import { HtmlLang } from "@/components/html-lang";

export const metadata: Metadata = { title: { absolute: "อัลบั้มรูปในงาน · Tohs Event" }, robots: { index: false, follow: false } };

export default function EventPageTh({ params }: PageProps<"/th/e/[slug]">) {
  return (
    <>
      <HtmlLang lang="th" />
      <AlbumPage params={params} locale="th" />
    </>
  );
}
