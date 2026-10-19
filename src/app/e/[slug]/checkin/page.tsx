import type { Metadata } from "next";
import { StaffCheckinPage } from "./checkin-page";

export const metadata: Metadata = { title: { absolute: "Door check-in · Tohs Event" }, robots: { index: false, follow: false } };

/** Door staff check-in through the host's signed link (no account needed). */
export default function StaffCheckinRoute({ params, searchParams }: PageProps<"/e/[slug]/checkin">) {
  return <StaffCheckinPage params={params} searchParams={searchParams} locale="en" />;
}
