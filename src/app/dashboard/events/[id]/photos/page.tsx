import Link from "next/link";
import { Suspense } from "react";
import { planOf } from "@/server/models";
import { downloadableCounts, ZIP_PART_SIZE } from "@/server/services/archive";
import { emailEnabled } from "@/server/email";
import { countOpenReports } from "@/server/services/moderation";
import { originalsAvailable } from "@/server/services/originals";
import { pendingNotificationCount } from "@/server/services/notifications";
import { loadEventPageForMember } from "../load-event";
import { NotifyGuestsButton } from "./notify-guests-button";
import { PhotoModeration } from "./photo-moderation";

export default function EventPhotosPage({ params }: PageProps<"/dashboard/events/[id]/photos">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-zinc-100" />}>
        <PhotosLoader params={params} />
      </Suspense>
    </main>
  );
}

async function PhotosLoader({ params }: Pick<PageProps<"/dashboard/events/[id]/photos">, "params">) {
  const { id } = await params;
  const { event, role } = await loadEventPageForMember(id);
  const owner = role === "owner";
  const [openReports, counts, waitingForEmail] = await Promise.all([
    countOpenReports(event),
    downloadableCounts(event),
    owner && emailEnabled() ? pendingNotificationCount(event) : Promise.resolve(null),
  ]);

  return (
    <>
      <Link href={`/dashboard/events/${id}`} className="text-sm text-zinc-500 hover:text-zinc-900">
        ← {event.title}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">จัดการรูปภาพ</h1>
      <DownloadPanel eventId={id} counts={counts} />
      {waitingForEmail !== null && <NotifyGuestsButton eventId={id} pending={waitingForEmail} />}
      <PhotoModeration
        eventId={id}
        openReports={owner ? openReports : 0}
        watermark={planOf(event).watermark}
        canModerate={owner}
        originals={originalsAvailable(event)}
      />
    </>
  );
}

function DownloadPanel({ eventId, counts }: { eventId: string; counts: { guest: number; official: number } }) {
  const sources = [
    { source: "official", label: "รูป Official", count: counts.official },
    { source: "guest", label: "รูปจากแขก", count: counts.guest },
  ].filter((s) => s.count > 0);
  if (sources.length === 0) return null;

  return (
    <details className="mt-4 rounded-2xl border border-zinc-200 px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium">ดาวน์โหลดทั้งอัลบั้ม (ZIP)</summary>
      <p className="mt-2 text-xs text-zinc-500">
        ไฟล์ความละเอียดเต็มที่แสดงในงาน (ไม่มีลายน้ำ) แบ่งไฟล์ละ {ZIP_PART_SIZE} รูป · ไม่รวมรูปที่ซ่อนไว้
      </p>
      <div className="mt-3 space-y-3">
        {sources.map(({ source, label, count }) => {
          const parts = Math.ceil(count / ZIP_PART_SIZE);
          return (
            <div key={source}>
              <p className="text-sm">
                {label} · {count.toLocaleString("th-TH")} รูป
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {Array.from({ length: parts }, (_, i) => {
                  const from = i * ZIP_PART_SIZE + 1;
                  const to = Math.min(count, (i + 1) * ZIP_PART_SIZE);
                  return (
                    <a
                      key={i}
                      href={`/api/v1/host/events/${eventId}/download?source=${source}&part=${i + 1}`}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
                    >
                      {parts === 1 ? "ดาวน์โหลด" : `รูป ${from}–${to}`}
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
