import type { Metadata } from "next";
import { SlideshowPage } from "./slideshow-page";

export const metadata: Metadata = { title: { absolute: "Slideshow · Tohs Event" }, robots: { index: false, follow: false } };

/** Venue screen (TV / projector): photos flow in next to a QR code and the event details. */
export default function SlideshowRoute({ params, searchParams }: PageProps<"/e/[slug]/slideshow">) {
  return <SlideshowPage params={params} searchParams={searchParams} locale="en" />;
}
