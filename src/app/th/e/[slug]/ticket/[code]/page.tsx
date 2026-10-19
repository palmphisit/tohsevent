import type { Metadata } from "next";
import { TicketView } from "@/app/e/[slug]/ticket/[code]/ticket-view";
import { HtmlLang } from "@/components/html-lang";

export const metadata: Metadata = { title: { absolute: "บัตรเข้างาน · Tohs Event" }, robots: { index: false, follow: false } };

export default function TicketPageTh({ params }: PageProps<"/th/e/[slug]/ticket/[code]">) {
  return (
    <>
      <HtmlLang lang="th" />
      <TicketView params={params} locale="th" />
    </>
  );
}
