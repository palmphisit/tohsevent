import type { Metadata } from "next";
import { StaffCheckinPage } from "@/app/e/[slug]/checkin/checkin-page";
import { HtmlLang } from "@/components/html-lang";

export const metadata: Metadata = { title: { absolute: "เช็กอินหน้างาน · Tohs Event" }, robots: { index: false, follow: false } };

export default function StaffCheckinRouteTh({ params, searchParams }: PageProps<"/th/e/[slug]/checkin">) {
  return (
    <>
      <HtmlLang lang="th" />
      <StaffCheckinPage params={params} searchParams={searchParams} locale="th" />
    </>
  );
}
