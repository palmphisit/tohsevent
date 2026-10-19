import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SlideshowView } from "@/components/slideshow/slideshow-view";
import type { Locale } from "@/lib/i18n";
import { guestCookieName, verifyGuestToken } from "@/server/guest-session";
import { qrSvg } from "@/server/qr";
import { findOpenEventBySlug, toPublicEvent } from "@/server/services/events";
import { guestEventUrl } from "@/server/services/host-events";
import { slideshowSettings, verifySlideshowKey } from "@/server/services/slideshow";

/** Venue screen (TV / projector): photos flow in next to a QR code and the event details. */
type RouteProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export function SlideshowPage({ params, searchParams, locale }: RouteProps & { locale: Locale }) {
  return (
    <main className="h-dvh w-full overflow-hidden bg-slate-950">
      <Suspense fallback={null}>
        <SlideshowLoader params={params} searchParams={searchParams} locale={locale} />
      </Suspense>
    </main>
  );
}

async function SlideshowLoader({ params, searchParams, locale }: RouteProps & { locale: Locale }) {
  const { slug } = await params;
  const { key } = await searchParams;
  await connection();
  const event = await findOpenEventBySlug(slug);
  if (!event) notFound();

  const apiKey = typeof key === "string" && verifySlideshowKey(event, key) ? key : null;
  if (event.access.mode !== "public" && !apiKey) {
    const eventId = event._id.toHexString();
    const guest = await verifyGuestToken((await cookies()).get(guestCookieName(eventId))?.value, eventId);
    if (!guest) return <KeyRequired locale={locale} />;
  }

  const guestUrl = guestEventUrl(event);
  return (
    <SlideshowView
      slug={event.slug}
      apiKey={apiKey}
      event={toPublicEvent(event)}
      settings={slideshowSettings(event)}
      qrSvg={await qrSvg(guestUrl, 1)}
      guestUrl={guestUrl}
      interactive
    />
  );
}

const COPY = {
  en: {
    title: "This event uses a password",
    text: "Open the slideshow from the link in the event dashboard (\u201cSlideshow\u201d). That link carries a key that opens it on the venue screen without the password.",
  },
  th: {
    title: "งานนี้ใช้รหัสผ่าน",
    text: "เปิด Slideshow จากลิงก์ในหน้าจัดการงาน (เมนู \u201cSlideshow บนจอ\u201d) ลิงก์นั้นมีกุญแจสำหรับเปิดบนจอในงานโดยไม่ต้องใส่รหัส",
  },
};

function KeyRequired({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
      <p className="text-2xl font-semibold">{t.title}</p>
      <p className="max-w-md text-slate-300">{t.text}</p>
    </div>
  );
}
