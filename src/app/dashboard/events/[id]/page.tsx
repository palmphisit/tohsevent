import { ChevronRight, CreditCard, Images, Palette } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { qrSvg } from "@/server/qr";
import { toHostEvent } from "@/server/services/host-events";
import { countOpenReports } from "@/server/services/moderation";
import { CopyButton } from "../../_components/copy-button";
import { EventForm } from "../../_components/event-form";
import { StatusBadge } from "../../_components/status-badge";
import { loadEventPageForMember } from "./load-event";
import { MembersPanel } from "./members-panel";

export default function HostEventPage({ params }: PageProps<"/dashboard/events/[id]">) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
        ← งานของฉัน
      </Link>
      <Suspense fallback={<div className="mt-4 h-96 animate-pulse rounded-2xl bg-slate-100" />}>
        <EventDetails params={params} />
      </Suspense>
    </main>
  );
}

async function EventDetails({ params }: Pick<PageProps<"/dashboard/events/[id]">, "params">) {
  const { id } = await params;
  const { event: doc, role } = await loadEventPageForMember(id);
  const event = toHostEvent(doc, role);
  const owner = role === "owner";
  const [svg, openReports] = await Promise.all([qrSvg(event.guestUrl), countOpenReports(doc)]);
  const qrBase = `/api/v1/host/events/${event.id}/qr`;

  return (
    <>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {new Date(event.date).toLocaleDateString("th-TH", { dateStyle: "long", timeZone: "UTC" })} ·{" "}
            {event.counters.photos} รูป · {event.counters.guests} แขก
          </p>
        </div>
        <StatusBadge status={event.status} />
      </div>
      {!owner && (
        <p className="mt-3 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          คุณเป็นช่างภาพของงานนี้: อัปโหลดรูป Official และไฟล์ต้นฉบับได้ ส่วนการตั้งค่างานเป็นของเจ้าภาพ
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {owner && (
          <>
            <ActionCard
              href={`/dashboard/events/${event.id}/plan`}
              icon={<CreditCard className="h-5 w-5" />}
              title={`แพ็กเกจ ${event.plan.name}`}
              text={`แขก ${event.usage.guests}/${event.plan.maxGuests} · รูป ${event.usage.photos}/${event.plan.maxPhotos}${
                event.expiresAt
                  ? ` · เปิดถึง ${new Date(event.expiresAt).toLocaleDateString("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" })}`
                  : ""
              }`}
              badge={event.plan.tier === "premium" ? undefined : "อัปเกรด"}
            />
            <ActionCard
              href={`/dashboard/events/${event.id}/branding`}
              icon={<Palette className="h-5 w-5" />}
              title="ปรับแต่งหน้างาน"
              text="สี ฟอนต์ โลโก้ รูปปก และผู้สนับสนุน (Premium)"
            />
          </>
        )}
        <ActionCard
          href={`/dashboard/events/${event.id}/photos`}
          icon={<Images className="h-5 w-5" />}
          title={owner ? "จัดการรูปภาพ" : "อัปโหลดรูป Official"}
          text={owner ? "ซ่อน/ลบรูป ดูรูปที่ถูกรายงาน อัปโหลดรูป Official" : "อัปโหลดรูปและไฟล์ต้นฉบับ ดาวน์โหลดอัลบั้ม"}
          alert={owner && openReports > 0 ? `${openReports} รายการรอตรวจ` : undefined}
        />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[280px_1fr]">
        <section className="rounded-2xl bg-white ring-1 ring-slate-200 p-4">
          <h2 className="text-sm font-medium">QR Code สำหรับแขก</h2>
          {/* SVG generated server-side by the qrcode library from our own URL */}
          <div className="mx-auto mt-3 w-full max-w-[240px]" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{event.guestUrl}</span>
            <CopyButton text={event.guestUrl} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <a href={`${qrBase}?format=png&size=1024`} className="rounded-lg border border-slate-300 px-3 py-2 text-center">
              ดาวน์โหลด PNG
            </a>
            <a href={`${qrBase}?format=svg`} className="rounded-lg border border-slate-300 px-3 py-2 text-center">
              ดาวน์โหลด SVG
            </a>
            <Link
              href={`/dashboard/events/${event.id}/poster`}
              className="col-span-2 rounded-lg bg-primary hover:bg-primary-hover px-3 py-2 text-center font-medium text-white"
            >
              พิมพ์โปสเตอร์ QR
            </Link>
            <a
              href={event.guestUrl}
              target="_blank"
              rel="noopener"
              className="col-span-2 px-3 py-1 text-center text-slate-500 underline"
            >
              เปิดหน้างานแบบที่แขกเห็น
            </a>
          </div>
        </section>

        {owner && (
          <div className="space-y-6">
            <section className="rounded-2xl bg-white ring-1 ring-slate-200 p-4 sm:p-6">
              <h2 className="mb-4 text-sm font-medium">ตั้งค่างาน</h2>
              <EventForm event={event} />
            </section>
            <MembersPanel eventId={event.id} />
          </div>
        )}
      </div>
    </>
  );
}

function ActionCard({
  href,
  icon,
  title,
  text,
  badge,
  alert,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  badge?: string;
  alert?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl bg-white px-4 py-4 ring-1 ring-slate-200 transition hover:shadow-sm hover:ring-blue-200"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block truncate text-sm text-slate-500">{text}</span>
      </span>
      {alert ? (
        <span className="shrink-0 rounded-full bg-red-600 px-2.5 py-1 text-xs font-medium text-white">{alert}</span>
      ) : badge ? (
        <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-white">{badge}</span>
      ) : (
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
      )}
    </Link>
  );
}
