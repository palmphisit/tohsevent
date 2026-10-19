import { ClipboardCheck, ExternalLink, Footprints, QrCode, ScanLine, Ticket, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { emailEnabled } from "@/server/email";
import { planOf } from "@/server/models";
import { qrSvg } from "@/server/qr";
import { eventInfoOf } from "@/server/services/event-info";
import {
  listRegistrations,
  registrationLinks,
  registrationSettingsOf,
  registrationStats,
} from "@/server/services/registration";
import { CopyButton } from "../../../_components/copy-button";
import { loadHostEventPage } from "../load-event";
import { AttendeeList } from "./attendee-list";
import { InfoEditor } from "./info-editor";
import { Panels } from "./panels";
import { SettingsForm } from "./settings-form";

export default function RegistrationPage({ params }: PageProps<"/dashboard/events/[id]/registration">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-12">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-100" />}>
        <RegistrationLoader params={params} />
      </Suspense>
    </main>
  );
}

const n = (v: number) => v.toLocaleString("th-TH");

async function RegistrationLoader({ params }: Pick<PageProps<"/dashboard/events/[id]/registration">, "params">) {
  const { id } = await params;
  const event = await loadHostEventPage(id);
  const settings = registrationSettingsOf(event);
  const links = registrationLinks(event);
  const [stats, items, onsiteQr] = await Promise.all([
    registrationStats(event),
    listRegistrations(event, { filter: "all" }),
    qrSvg(links.onsite, 1),
  ]);
  const pct = stats.headcount > 0 ? Math.round((stats.checkedInHeadcount / stats.headcount) * 100) : 0;

  const cards = [
    { icon: Ticket, label: "ลงทะเบียน", value: n(stats.registrations), sub: `${n(stats.headcount)} คน จากที่รับ ${n(stats.capacity)}` },
    { icon: ClipboardCheck, label: "เข้างานแล้ว", value: n(stats.checkedInHeadcount), sub: `${pct}% ของผู้ลงทะเบียน` },
    { icon: Footprints, label: "ลงทะเบียนหน้างาน", value: n(stats.onsite), sub: "walk-in" },
    { icon: Users, label: "ที่ว่าง", value: n(Math.max(0, stats.capacity - stats.headcount)), sub: "คน" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">ลงทะเบียนและเช็กอิน</h1>
          <p className="text-sm text-slate-500">ให้แขกลงทะเบียนล่วงหน้า รับบัตร QR และบันทึกเวลาเข้างานที่หน้างาน</p>
        </div>
        <Link
          href={`/dashboard/events/${id}/checkin`}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-hover"
        >
          <ScanLine className="h-4 w-4" /> เปิดหน้าเช็กอิน
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Icon className="h-4 w-4 text-primary" /> {label}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
            <p className="text-xs text-slate-500">{sub}</p>
          </div>
        ))}
      </div>

      {!settings.enabled && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ยังปิดรับลงทะเบียนอยู่ เปิดได้ที่แท็บ “ตั้งค่า” ด้านล่าง (หน้ารายละเอียดงานแสดงได้แม้ไม่เปิดลงทะเบียน)
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <section className="min-w-0 space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
          <LinkRow
            title="หน้ารายละเอียดงาน + ลงทะเบียน"
            hint="ส่งให้แขกล่วงหน้า (LINE, อีเมล, การ์ดเชิญ)"
            url={links.page}
          />
          <LinkRow
            title="ลิงก์เจ้าหน้าที่เช็กอิน"
            hint="ให้ทีมหน้างานเปิดบนมือถือ สแกน QR ได้โดยไม่ต้องมีบัญชี · อย่าแชร์ให้แขก"
            url={links.staff}
          />
        </section>
        <section className="rounded-2xl bg-white p-4 text-center ring-1 ring-slate-200">
          <p className="flex items-center justify-center gap-1.5 text-sm font-medium">
            <QrCode className="h-4 w-4 text-primary" /> QR ลงทะเบียนหน้างาน
          </p>
          {/* SVG generated server-side by the qrcode library from our own URL */}
          <div className="mx-auto mt-2 w-40 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: onsiteQr }} />
          <p className="mt-1 text-xs text-slate-500">วางที่ทางเข้า แขกสแกนลงทะเบียนเองและบันทึกเวลาเข้างานทันที</p>
          <a href={links.onsite} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary underline">
            <ExternalLink className="h-3.5 w-3.5" /> เปิดดู
          </a>
        </section>
      </div>

      <Panels
        panels={[
          { id: "list", label: "รายชื่อ", content: <AttendeeList eventId={id} initial={{ items, stats }} emailAvailable={emailEnabled()} /> },
          {
            id: "settings",
            label: "ตั้งค่า",
            content: <SettingsForm eventId={id} initial={settings} maxGuests={planOf(event).maxGuests} />,
          },
          { id: "info", label: "รายละเอียดงาน", content: <InfoEditor eventId={id} initial={eventInfoOf(event)} /> },
        ]}
      />
    </div>
  );
}

function LinkRow({ title, hint, url }: { title: string; hint: string; url: string }) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-slate-500">{hint}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{url}</span>
          <CopyButton text={url} />
        </div>
        <a href={url} target="_blank" rel="noopener" className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50" aria-label="เปิด">
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
