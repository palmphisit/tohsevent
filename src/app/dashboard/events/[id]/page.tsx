import Link from "next/link";
import { Suspense } from "react";
import { qrSvg } from "@/server/qr";
import { toHostEvent } from "@/server/services/host-events";
import { countOpenReports } from "@/server/services/moderation";
import { CopyButton } from "../../_components/copy-button";
import { EventForm } from "../../_components/event-form";
import { StatusBadge } from "../../_components/status-badge";
import { loadHostEventPage } from "./load-event";

export default function HostEventPage({ params }: PageProps<"/dashboard/events/[id]">) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← งานของฉัน
      </Link>
      <Suspense fallback={<div className="mt-4 h-96 animate-pulse rounded-2xl bg-zinc-100" />}>
        <EventDetails params={params} />
      </Suspense>
    </main>
  );
}

async function EventDetails({ params }: Pick<PageProps<"/dashboard/events/[id]">, "params">) {
  const { id } = await params;
  const doc = await loadHostEventPage(id);
  const event = toHostEvent(doc);
  const [svg, openReports] = await Promise.all([qrSvg(event.guestUrl), countOpenReports(doc)]);
  const qrBase = `/api/v1/host/events/${event.id}/qr`;

  return (
    <>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {new Date(event.date).toLocaleDateString("th-TH", { dateStyle: "long", timeZone: "UTC" })} ·{" "}
            {event.counters.photos} รูป · {event.counters.guests} แขก
          </p>
        </div>
        <StatusBadge status={event.status} />
      </div>

      <Link
        href={`/dashboard/events/${event.id}/photos`}
        className="mt-6 flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-4 hover:bg-zinc-50"
      >
        <span>
          <span className="block font-medium">จัดการรูปภาพ</span>
          <span className="block text-sm text-zinc-500">ซ่อน/ลบรูป, ดูรูปที่ถูกรายงาน, อัปโหลดรูป Official</span>
        </span>
        {openReports > 0 ? (
          <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-medium text-white">
            {openReports} รายการรอตรวจ
          </span>
        ) : (
          <span className="text-zinc-400">›</span>
        )}
      </Link>

      <div className="mt-6 grid gap-6 md:grid-cols-[280px_1fr]">
        <section className="rounded-2xl border border-zinc-200 p-4">
          <h2 className="text-sm font-medium">QR Code สำหรับแขก</h2>
          {/* SVG generated server-side by the qrcode library from our own URL */}
          <div className="mx-auto mt-3 w-full max-w-[240px]" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs text-zinc-600">{event.guestUrl}</span>
            <CopyButton text={event.guestUrl} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <a href={`${qrBase}?format=png&size=1024`} className="rounded-lg border border-zinc-300 px-3 py-2 text-center">
              ดาวน์โหลด PNG
            </a>
            <a href={`${qrBase}?format=svg`} className="rounded-lg border border-zinc-300 px-3 py-2 text-center">
              ดาวน์โหลด SVG
            </a>
            <Link
              href={`/dashboard/events/${event.id}/poster`}
              className="col-span-2 rounded-lg bg-zinc-900 px-3 py-2 text-center font-medium text-white"
            >
              พิมพ์โปสเตอร์ QR
            </Link>
            <a
              href={event.guestUrl}
              target="_blank"
              rel="noopener"
              className="col-span-2 px-3 py-1 text-center text-zinc-500 underline"
            >
              เปิดหน้างานแบบที่แขกเห็น
            </a>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 p-4 sm:p-6">
          <h2 className="mb-4 text-sm font-medium">ตั้งค่างาน</h2>
          <EventForm event={event} />
        </section>
      </div>
    </>
  );
}
