import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SlideshowView } from "@/components/slideshow/slideshow-view";
import { guestCookieName, verifyGuestToken } from "@/server/guest-session";
import { qrSvg } from "@/server/qr";
import { findOpenEventBySlug, toPublicEvent } from "@/server/services/events";
import { guestEventUrl } from "@/server/services/host-events";
import { slideshowSettings, verifySlideshowKey } from "@/server/services/slideshow";

export const metadata = { title: { absolute: "Slideshow · Tohs Event" }, robots: { index: false, follow: false } };

/** Venue screen (TV / projector): photos flow in next to a QR code and the event details. */
export default function SlideshowPage({ params, searchParams }: PageProps<"/e/[slug]/slideshow">) {
  return (
    <main className="h-dvh w-full overflow-hidden bg-slate-950">
      <Suspense fallback={null}>
        <SlideshowLoader params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SlideshowLoader({ params, searchParams }: Pick<PageProps<"/e/[slug]/slideshow">, "params" | "searchParams">) {
  const { slug } = await params;
  const { key } = await searchParams;
  await connection();
  const event = await findOpenEventBySlug(slug);
  if (!event) notFound();

  const apiKey = typeof key === "string" && verifySlideshowKey(event, key) ? key : null;
  if (event.access.mode !== "public" && !apiKey) {
    const eventId = event._id.toHexString();
    const guest = await verifyGuestToken((await cookies()).get(guestCookieName(eventId))?.value, eventId);
    if (!guest) return <KeyRequired />;
  }

  const guestUrl = guestEventUrl(event.slug);
  return (
    <SlideshowView
      slug={event.slug}
      apiKey={apiKey}
      event={toPublicEvent(event)}
      settings={slideshowSettings(event)}
      qrSvg={await qrSvg(guestUrl)}
      guestUrl={guestUrl}
      interactive
    />
  );
}

function KeyRequired() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
      <p className="text-2xl font-semibold">งานนี้ใช้รหัสผ่าน</p>
      <p className="max-w-md text-slate-300">
        เปิด Slideshow จากลิงก์ในหน้าจัดการงาน (เมนู &quot;Slideshow บนจอ&quot;) ลิงก์นั้นมีกุญแจสำหรับเปิดบนจอในงานโดยไม่ต้องใส่รหัส
      </p>
    </div>
  );
}
