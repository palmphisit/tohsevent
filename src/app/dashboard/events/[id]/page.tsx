import { Check, Download, Images, MonitorPlay, Palette, Printer, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { qrSvg } from "@/server/qr";
import { toHostEvent } from "@/server/services/host-events";
import { CopyButton } from "../../_components/copy-button";
import { EventForm } from "../../_components/event-form";
import { loadEventPageForMember } from "./load-event";
import { MembersPanel } from "./members-panel";

export default function HostEventPage({ params }: PageProps<"/dashboard/events/[id]">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-12">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-100" />}>
        <EventOverview params={params} />
      </Suspense>
    </main>
  );
}

const n = (value: number) => value.toLocaleString("th-TH");

async function EventOverview({ params }: Pick<PageProps<"/dashboard/events/[id]">, "params">) {
  const { id } = await params;
  const { event: doc, role } = await loadEventPageForMember(id);
  const event = toHostEvent(doc, role);
  const owner = role === "owner";
  const svg = await qrSvg(event.guestUrl);
  const qrBase = `/api/v1/host/events/${event.id}/qr`;
  const base = `/dashboard/events/${event.id}`;
  // eslint-disable-next-line react-hooks/purity -- server component rendered per request
  const daysLeft = event.expiresAt ? Math.ceil((new Date(event.expiresAt).getTime() - Date.now()) / 86_400_000) : null;
  const filesPct = Math.min(100, Math.round((event.usage.photos / event.plan.maxPhotos) * 100));

  const stats = [
    { icon: Images, label: "รูปและวิดีโอที่แสดง", value: n(event.counters.photos), sub: `ใช้พื้นที่ ${filesPct}% ของแพ็กเกจ` },
    { icon: Users, label: "แขกที่เข้าร่วม", value: n(event.counters.guests), sub: `จากสูงสุด ${n(event.plan.maxGuests)} คน` },
    {
      icon: Download,
      label: "อัลบั้มเปิดอีก",
      value: daysLeft === null ? "—" : daysLeft > 0 ? `${n(daysLeft)} วัน` : "ปิดแล้ว",
      sub: event.expiresAt
        ? new Date(event.expiresAt).toLocaleDateString("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" })
        : "",
    },
  ];

  const steps = [
    { done: false, href: `${base}/poster`, icon: Printer, title: "พิมพ์โปสเตอร์ QR", text: "วางบนโต๊ะหรือหน้างานให้แขกสแกน" },
    { done: !!doc.appearance || !!doc.branding, href: `${base}/branding`, icon: Palette, title: "ปรับแต่งหน้าแขก", text: "ธีม รูปปก และการจัดเรียงรูป" },
    { done: !!doc.slideshow, href: `${base}/slideshow`, icon: MonitorPlay, title: "เตรียม Slideshow", text: "ให้รูปไหลขึ้นจอในงาน" },
    { done: (doc.members?.length ?? 0) > 0, href: "#members", icon: UserPlus, title: "เชิญช่างภาพ", text: "ให้อัปโหลดรูป Official ได้" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Icon className="h-4 w-4 text-primary" /> {label}
            </p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
            <p className="text-xs text-slate-500">{sub}</p>
          </div>
        ))}
      </div>

      {owner && event.counters.photos === 0 && (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
          <h2 className="font-semibold">เตรียมงานให้พร้อม</h2>
          <p className="text-sm text-slate-500">ทำตามนี้ก่อนวันงาน แขกจะเริ่มแชร์รูปได้ทันทีที่สแกน QR</p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ done, href, icon: Icon, title, text }) => (
              <li key={title}>
                <Link
                  href={href}
                  className="flex h-full items-start gap-3 rounded-xl p-3 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:ring-blue-200"
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${done ? "bg-emerald-100 text-emerald-700" : "bg-primary-soft text-primary"}`}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-xs text-slate-500">{text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 md:self-start">
          <h2 className="font-semibold">QR Code สำหรับแขก</h2>
          <p className="text-xs text-slate-500">แขกสแกนแล้วอัปโหลดและเซฟรูปได้ทันที ไม่ต้องโหลดแอป</p>
          {/* SVG generated server-side by the qrcode library from our own URL */}
          <div className="mx-auto mt-3 w-full max-w-[230px]" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{event.guestUrl}</span>
            <CopyButton text={event.guestUrl} />
          </div>
          <Link
            href={`${base}/poster`}
            className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <Printer className="h-4 w-4" /> พิมพ์โปสเตอร์ QR
          </Link>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <a href={`${qrBase}?format=png&size=1024`} className="rounded-xl border border-slate-300 px-3 py-2 text-center hover:bg-slate-50">
              PNG
            </a>
            <a href={`${qrBase}?format=svg`} className="rounded-xl border border-slate-300 px-3 py-2 text-center hover:bg-slate-50">
              SVG
            </a>
          </div>
        </section>

        {owner ? (
          <div className="space-y-6">
            <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
              <h2 className="mb-4 font-semibold">ตั้งค่างาน</h2>
              <EventForm event={event} />
            </section>
            <div id="members" className="scroll-mt-24">
              <MembersPanel eventId={event.id} />
            </div>
          </div>
        ) : (
          <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 md:self-start">
            <h2 className="font-semibold">คุณเป็นช่างภาพของงานนี้</h2>
            <p className="mt-1 text-sm text-slate-500">
              อัปโหลดรูป Official และไฟล์ต้นฉบับ ดาวน์โหลดอัลบั้ม หรือส่งไปที่ Google Drive ได้ในแท็บรูปภาพ
            </p>
            <Link
              href={`${base}/photos`}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
            >
              <Images className="h-4 w-4" /> ไปที่รูปภาพ
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
