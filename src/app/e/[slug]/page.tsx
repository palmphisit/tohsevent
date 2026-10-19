import type { Metadata } from "next";
import { AlbumPage } from "./album-page";

// Guest albums are private: keep them out of search engines.
export const metadata: Metadata = { title: { absolute: "Event album · Tohs Event" }, robots: { index: false, follow: false } };

export default function EventPage({ params }: PageProps<"/e/[slug]">) {
  return <AlbumPage params={params} locale="en" />;
}
