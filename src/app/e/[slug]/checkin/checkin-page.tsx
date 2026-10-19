import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CheckinScreen } from "@/components/checkin/checkin-screen";
import type { Locale } from "@/lib/i18n";

const COPY = {
  en: { title: "This check-in link isn't valid", text: "Ask the organizer for the staff check-in link (Registration tab in the event dashboard)." },
  th: { title: "ลิงก์เช็กอินไม่ถูกต้อง", text: "ขอลิงก์เจ้าหน้าที่เช็กอินจากผู้จัดงาน (แท็บลงทะเบียนในหน้าจัดการงาน)" },
};
import { verifyEventKey } from "@/server/event-keys";
import { findOpenEventBySlug } from "@/server/services/events";
import { registrationSettingsOf } from "@/server/services/registration";

/** Door staff check-in through the host's signed link (no account needed). */
type RouteProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export function StaffCheckinPage({ params, searchParams, locale }: RouteProps & { locale: Locale }) {
  return (
    <main className="min-h-dvh bg-slate-50">
      <Suspense fallback={null}>
        <Loader params={params} searchParams={searchParams} locale={locale} />
      </Suspense>
    </main>
  );
}

async function Loader({ params, searchParams, locale }: RouteProps & { locale: Locale }) {
  const { slug } = await params;
  const { key } = await searchParams;
  await connection();
  const event = await findOpenEventBySlug(slug);
  if (!event) notFound();
  if (typeof key !== "string" || !verifyEventKey(event, "checkin", key)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <p className="text-xl font-semibold">{COPY[locale].title}</p>
        <p className="mt-2 text-slate-500">{COPY[locale].text}</p>
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
