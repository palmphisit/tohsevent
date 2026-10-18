import Link from "next/link";
import { Suspense } from "react";
import { qrSvg } from "@/server/qr";
import { toPublicEvent } from "@/server/services/events";
import { guestEventUrl } from "@/server/services/host-events";
import { slideshowKey, slideshowSettings, slideshowUrl } from "@/server/services/slideshow";
import { loadHostEventPage } from "../load-event";
import { SlideshowEditor } from "./slideshow-editor";

export default function EventSlideshowPage({ params }: PageProps<"/dashboard/events/[id]/slideshow">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-100" />}>
        <SlideshowLoader params={params} />
      </Suspense>
    </main>
  );
}

async function SlideshowLoader({ params }: Pick<PageProps<"/dashboard/events/[id]/slideshow">, "params">) {
  const { id } = await params;
  const event = await loadHostEventPage(id);
  const guestUrl = guestEventUrl(event.slug);

  return (
    <>
      <Link href={`/dashboard/events/${id}`} className="text-sm text-slate-500 hover:text-slate-900">
        ← {event.title}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Slideshow บนจอ</h1>
      <p className="mt-1 text-sm text-slate-500">
        เปิดบนคอมหรือทีวีที่ต่อจอในงาน รูปที่แขกอัปโหลดจะไหลขึ้นจออัตโนมัติ พร้อม QR ให้ทุกคนสแกนร่วมแชร์รูป
      </p>
      <SlideshowEditor
        eventId={id}
        slug={event.slug}
        apiKey={slideshowKey(event)}
        url={slideshowUrl(event)}
        event={toPublicEvent(event)}
        initial={slideshowSettings(event)}
        qrSvg={await qrSvg(guestUrl)}
        guestUrl={guestUrl}
      />
    </>
  );
}
