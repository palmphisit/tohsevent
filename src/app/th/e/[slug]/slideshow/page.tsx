import type { Metadata } from "next";
import { SlideshowPage } from "@/app/e/[slug]/slideshow/slideshow-page";
import { HtmlLang } from "@/components/html-lang";

export const metadata: Metadata = { title: { absolute: "Slideshow · Tohs Event" }, robots: { index: false, follow: false } };

export default function SlideshowRouteTh({ params, searchParams }: PageProps<"/th/e/[slug]/slideshow">) {
  return (
    <>
      <HtmlLang lang="th" />
      <SlideshowPage params={params} searchParams={searchParams} locale="th" />
    </>
  );
}
