import { CalendarDays, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { planOf } from "@/server/models";
import { guestEventUrl } from "@/server/services/host-events";
import { countOpenReports } from "@/server/services/moderation";
import { CopyButton } from "../../_components/copy-button";
import { StatusBadge } from "../../_components/status-badge";
import { EventNav } from "./_components/event-nav";
import { loadEventPageForMember } from "./load-event";

/** Every page of an event shares this header: title, status, guest link and section tabs. */
export default function EventLayout({ children, params }: LayoutProps<"/dashboard/events/[id]">) {
  return (
    <>
      <Suspense fallback={<div className="h-[132px] border-b border-slate-200 bg-white" />}>
        <EventHeader params={params} />
      </Suspense>
      {children}
    </>
  );
}

async function EventHeader({ params }: Pick<LayoutProps<"/dashboard/events/[id]">, "params">) {
  const { id } = await params;
  const { event, role } = await loadEventPageForMember(id);
  const owner = role === "owner";
  const openReports = owner ? await countOpenReports(event) : 0;
  const guestUrl = guestEventUrl(event.slug);
  const date = event.date.toLocaleDateString("th-TH", { dateStyle: "long", timeZone: "UTC" });

  return (
    <div className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto w-full max-w-5xl px-4 pt-5">
        <Link href="/dashboard" className="text-xs text-slate-500 hover:text-slate-900">
          ← งานของฉัน
        </Link>
        <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">{event.title}</h1>
              <StatusBadge status={event.status} />
              <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-ink">
                {planOf(event).name}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <CalendarDays className="h-4 w-4" /> {date}
              {!owner && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">คุณเป็นช่างภาพ</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 sm:max-w-64">
              <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{guestUrl.replace(/^https?:\/\//, "")}</span>
              <CopyButton text={guestUrl} />
            </div>
            <a
              href={guestUrl}
              target="_blank"
              rel="noopener"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              <ExternalLink className="h-4 w-4" /> หน้าแขก
            </a>
          </div>
        </div>
        <div className="mt-3">
          <EventNav eventId={id} owner={owner} alerts={{ photos: openReports }} />
        </div>
      </div>
    </div>
  );
}
