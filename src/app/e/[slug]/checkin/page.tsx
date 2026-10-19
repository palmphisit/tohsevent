import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CheckinScreen } from "@/components/checkin/checkin-screen";
import { verifyEventKey } from "@/server/event-keys";
import { findOpenEventBySlug } from "@/server/services/events";
import { registrationSettingsOf } from "@/server/services/registration";

export const metadata = { title: { absolute: "เช็กอินหน้างาน · Tohs Event" }, robots: { index: false, follow: false } };

/** Door staff check-in through the host's signed link (no account needed). */
export default function StaffCheckinPage({ params, searchParams }: PageProps<"/e/[slug]/checkin">) {
  return (
    <main className="min-h-dvh bg-slate-50">
      <Suspense fallback={null}>
        <Loader params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Loader({ params, searchParams }: PageProps<"/e/[slug]/checkin">) {
  const { slug } = await params;
  const { key } = await searchParams;
  await connection();
  const event = await findOpenEventBySlug(slug);
  if (!event) notFound();
  if (typeof key !== "string" || !verifyEventKey(event, "checkin", key)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <p className="text-xl font-semibold">ลิงก์เช็กอินไม่ถูกต้อง</p>
        <p className="mt-2 text-slate-500">ขอลิงก์เจ้าหน้าที่เช็กอินจากผู้จัดงาน (แท็บลงทะเบียนในหน้าจัดการงาน)</p>
      </div>
    );
  }
  const s = registrationSettingsOf(event);
  return (
    <CheckinScreen
      slug={event.slug}
      staffKey={key}
      title={event.title}
      ask={{ phone: s.askPhone, organization: s.askOrganization, partySize: s.askPartySize }}
    />
  );
}
