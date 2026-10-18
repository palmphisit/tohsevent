import Link from "next/link";
import { Suspense } from "react";
import { requireHostPage } from "@/server/auth";
import { listHostEvents } from "@/server/services/host-events";
import { StatusBadge } from "./_components/status-badge";

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">งานของฉัน</h1>
        <Link href="/dashboard/events/new" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
          + สร้างงานใหม่
        </Link>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <EventList />
      </Suspense>
    </main>
  );
}

async function EventList() {
  const host = await requireHostPage();
  const events = await listHostEvents(host.id);

  if (events.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 px-6 py-12 text-center">
        <p className="font-medium">ยังไม่มีงาน</p>
        <p className="mt-1 text-sm text-zinc-500">สร้างงานแรก แล้วนำ QR Code ไปวางในงานให้แขกสแกนแชร์รูป</p>
      </div>
    );
  }

  return (
    <ul className="mt-6 divide-y divide-zinc-200 rounded-2xl border border-zinc-200">
      {events.map((event) => (
        <li key={event.id}>
          <Link
            href={`/dashboard/events/${event.id}`}
            className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-zinc-50"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{event.title}</p>
              <p className="mt-0.5 text-sm text-zinc-500">
                {new Date(event.date).toLocaleDateString("th-TH", { dateStyle: "medium", timeZone: "UTC" })} ·{" "}
                {event.counters.photos} รูป · {event.counters.guests} แขก · {event.plan.name}
              </p>
            </div>
            <StatusBadge status={event.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ListSkeleton() {
  return <div className="mt-6 h-40 animate-pulse rounded-2xl bg-zinc-100" />;
}
