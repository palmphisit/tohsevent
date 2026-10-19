import type { Metadata } from "next";
import { InfoPage } from "./info-page";

export const metadata: Metadata = { title: { absolute: "Event details · Tohs Event" }, robots: { index: false, follow: false } };

export default function EventInfoPage({ params, searchParams }: PageProps<"/e/[slug]/info">) {
  return <InfoPage params={params} searchParams={searchParams} locale="en" />;
}
