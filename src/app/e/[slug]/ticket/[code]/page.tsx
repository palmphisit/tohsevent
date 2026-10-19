import type { Metadata } from "next";
import { TicketView } from "./ticket-view";

export const metadata: Metadata = { title: { absolute: "Event ticket · Tohs Event" }, robots: { index: false, follow: false } };

export default function TicketPage({ params }: PageProps<"/e/[slug]/ticket/[code]">) {
  return <TicketView params={params} locale="en" />;
}
