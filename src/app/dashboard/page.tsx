import { CalendarDays, Camera, ImageIcon, Plus, Printer, QrCode, Radio, Share2, Users } from "lucide-react";
import { ObjectId } from "mongodb";
import Link from "next/link";
import { Suspense } from "react";
import { requireHostPage } from "@/server/auth";
import { eventPreviews, listHostEvents } from "@/server/services/host-events";
import { StatusBadge } from "./_components/status-badge";

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">งานของฉัน</h1>
          <p className="mt-1 text-sm text-slate-500">สร้างงาน แชร์ QR และดูแลรูปทั้งหมดได้จากที่นี่</p>
        </div>
        <Link
          href="/dashboard/events/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" /> สร้างงานใหม่
        </Link>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <EventList />
      </Suspense>
    </main>
  );
}

/** Mosaic of up to 4 latest photos: one big tile on the left, the rest filling the right. */
function tileClass(i: number, count: number): string {
  if (count === 1) return "col-span-4 row-span-2";
  if (i === 0) return "col-span-2 row-span-2";
  if (count === 2) return "col-span-2 row-span-2";
  if (count === 3) return "col-span-2";
  return i === 1 ? "col-span-2" : "";
}

async function EventList() {
  const host = await requireHostPage();
  const events = await listHostEvents(host.id);
  if (events.length === 0) return <Onboarding />;
  const previews = await eventPreviews(events.map((e) => new ObjectId(e.id)));

  const live = events.filter((e) => e.status === "live").length;
  const totals = [
    { icon: CalendarDays, label: "งานทั้งหมด", value: events.length },
    { icon: Radio, label: "เปิดรับรูปอยู่", value: live },
    { icon: ImageIcon, label: "รูปและวิดีโอ", value: events.reduce((sum, e) => sum + e.counters.photos, 0) },
    { icon: Users, label: "แขกทั้งหมด", value: events.reduce((sum, e) => sum + e.counters.guests, 0) },
  ];

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {totals.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Icon className="h-4 w-4 text-primary" /> {label}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{value.toLocaleString("th-TH")}</p>
          </div>
        ))}
      </div>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => {
          const thumbs = previews.get(event.id) ?? [];
          return (
            <li key={event.id} className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:shadow-md hover:ring-blue-200">
              <Link href={`/dashboard/events/${event.id}`} className="block">
                <div className="relative grid h-36 grid-cols-4 grid-rows-2 gap-0.5 overflow-hidden bg-slate-100">
                  {thumbs.length > 0 ? (
                    thumbs.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN
                      <img
                        key={src}
                        src={src}
                        alt=""
                        loading="lazy"
                        className={`h-full w-full object-cover ${tileClass(i, thumbs.length)}`}
                      />
                    ))
                  ) : (
                    <div className="col-span-4 row-span-2 grid place-items-center bg-gradient-to-br from-primary to-accent text-white/90">
                      <QrCode className="h-10 w-10" />
                    </div>
                  )}
                  <span className="absolute top-2 right-2">
                    <StatusBadge status={event.status} />
                  </span>
                </div>
                <div className="p-4">
                  <p className="truncate font-semibold group-hover:text-primary">{event.title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                    <CalendarDays className="h-4 w-4" />
                    {new Date(event.date).toLocaleDateString("th-TH", { dateStyle: "long", timeZone: "UTC" })}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <ImageIcon className="h-4 w-4 text-primary" /> {event.counters.photos.toLocaleString("th-TH")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-primary" /> {event.counters.guests.toLocaleString("th-TH")}
                    </span>
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-ink">{event.plan.name}</span>
                    {event.role === "photographer" && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                        <Camera className="h-3.5 w-3.5" /> ช่างภาพ
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Onboarding() {
  const steps = [
    { icon: Plus, title: "สร้างงาน", text: "ตั้งชื่องานและวันที่ ใช้เวลาไม่ถึงนาที" },
    { icon: Printer, title: "พิมพ์ QR วางในงาน", text: "ดาวน์โหลดโปสเตอร์ QR พร้อมพิมพ์ วางบนโต๊ะหรือหน้างาน" },
    { icon: Share2, title: "แขกสแกนแชร์รูป", text: "รูปทุกใบขึ้นในอัลบั้มทันที ดูแลและดาวน์โหลดได้ที่นี่" },
  ];
  return (
    <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <QrCode className="h-7 w-7" />
      </span>
      <h2 className="mt-4 text-xl font-semibold">เริ่มงานแรกของคุณ</h2>
      <p className="mt-1 text-slate-500">ใช้ฟรีสำหรับงานไม่เกิน 50 แขก อัปเกรดได้ทุกเมื่อ</p>
      <ol className="mx-auto mt-8 grid max-w-3xl gap-4 text-left sm:grid-cols-3">
        {steps.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="rounded-2xl bg-slate-50 p-5">
            <span className="flex items-center gap-2 text-sm font-medium text-primary">
              <Icon className="h-4 w-4" /> ขั้นที่ {i + 1}
            </span>
            <p className="mt-2 font-semibold">{title}</p>
            <p className="mt-1 text-sm text-slate-500">{text}</p>
          </li>
        ))}
      </ol>
      <Link
        href="/dashboard/events/new"
        className="mt-8 inline-flex items-center gap-1.5 rounded-xl bg-primary px-6 py-3 font-medium text-white hover:bg-primary-hover"
      >
        <Plus className="h-4 w-4" /> สร้างงานแรก
      </Link>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-64 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />
      ))}
    </div>
  );
}
