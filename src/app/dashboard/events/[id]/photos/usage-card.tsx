import { CalendarClock, HardDrive, Images, Users, Video } from "lucide-react";
import Link from "next/link";
import type { EventUsage } from "@/server/services/usage";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

const n = (value: number) => value.toLocaleString("th-TH");

/** Color of a usage bar: calm until the album nears its limit. */
function tone(ratio: number) {
  if (ratio >= 0.95) return { bar: "bg-red-500", text: "text-red-600" };
  if (ratio >= 0.8) return { bar: "bg-amber-500", text: "text-amber-600" };
  return { bar: "bg-primary", text: "text-primary" };
}

function Meter({ label, icon, used, max }: { label: string; icon: React.ReactNode; used: number; max: number }) {
  const ratio = max > 0 ? Math.min(1, used / max) : 0;
  const t = tone(ratio);
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-slate-600">
          {icon}
          {label}
        </span>
        <span>
          <span className="font-semibold text-slate-900">{n(used)}</span>
          <span className="text-slate-400"> / {n(max)}</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${Math.max(ratio * 100, used > 0 ? 1.5 : 0)}%` }} />
      </div>
    </div>
  );
}

/** Photos page: what the album uses of its package and what is left. */
export function UsageCard({ eventId, usage, owner }: { eventId: string; usage: EventUsage; owner: boolean }) {
  const left = Math.max(0, usage.files.max - usage.files.used);
  const ratio = usage.files.max > 0 ? usage.files.used / usage.files.max : 0;
  const t = tone(ratio);
  // eslint-disable-next-line react-hooks/purity -- server component rendered per request
  const daysLeft = usage.expiresAt ? Math.ceil((usage.expiresAt.getTime() - Date.now()) / 86_400_000) : null;

  return (
    <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4 sm:w-64 sm:shrink-0">
          <div
            className="grid h-20 w-20 shrink-0 place-items-center rounded-full"
            style={{
              background: `conic-gradient(var(--ring-color) ${Math.min(100, ratio * 100)}%, #e2e8f0 0)`,
              ["--ring-color" as string]: ratio >= 0.95 ? "#ef4444" : ratio >= 0.8 ? "#f59e0b" : "#2563eb",
            }}
          >
            <div className="grid h-[62px] w-[62px] place-items-center rounded-full bg-white">
              <span className={`text-lg font-semibold ${t.text}`}>{Math.round(ratio * 100)}%</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500">
              แพ็กเกจ <span className="font-medium text-slate-700">{usage.plan.name}</span>
            </p>
            <p className="mt-0.5 text-xl font-semibold text-slate-900">เหลือ {n(left)} ไฟล์</p>
            <p className="text-xs text-slate-500">ใช้ไป {n(usage.files.used)} จาก {n(usage.files.max)} ไฟล์</p>
          </div>
        </div>

        <div className="grid flex-1 gap-4">
          <Meter label="รูปและวิดีโอ" icon={<Images className="h-4 w-4" />} used={usage.files.used} max={usage.files.max} />
          <Meter label="แขก" icon={<Users className="h-4 w-4" />} used={usage.guests.used} max={usage.guests.max} />
          <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
            <span className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-2">
              <HardDrive className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0 leading-tight">
                <span className="block font-medium text-slate-800">{formatBytes(usage.bytes)}</span>
                ขนาดไฟล์
              </span>
            </span>
            <span className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-2">
              <Video className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0 leading-tight">
                <span className="block font-medium text-slate-800">{n(usage.videos)}</span>
                วิดีโอ
              </span>
            </span>
            <span className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-2">
              <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0 leading-tight">
                <span className="block font-medium text-slate-800">
                  {daysLeft === null ? "ไม่จำกัด" : daysLeft > 0 ? `${n(daysLeft)} วัน` : "ปิดแล้ว"}
                </span>
                เปิดอัลบั้มอีก
              </span>
            </span>
          </div>
        </div>
      </div>

      {owner && usage.plan.tier !== "premium" && ratio >= 0.8 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>{left === 0 ? "อัลบั้มเต็มแล้ว แขกอัปโหลดเพิ่มไม่ได้" : "พื้นที่ใกล้เต็มแล้ว"} อัปเกรดเพื่อรับไฟล์ได้มากขึ้น</span>
          <Link href={`/dashboard/events/${eventId}/plan`} className="rounded-lg bg-amber-500 px-3 py-1.5 font-medium text-white">
            ดูแพ็กเกจ
          </Link>
        </div>
      )}
    </section>
  );
}
