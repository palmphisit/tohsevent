import type { NextRequest } from "next/server";
import { route } from "@/server/http";
import { eventInfoOf } from "@/server/services/event-info";
import { requireOpenEventBySlug } from "@/server/services/events";
import { guestEventUrl } from "@/server/services/host-events";

const esc = (text: string) => text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);

/** "Add to calendar": an .ics file with the event's date, times and place (Bangkok time). */
export const GET = route(async (_req: NextRequest, ctx: RouteContext<"/e/[slug]/calendar.ics">) => {
  const event = await requireOpenEventBySlug((await ctx.params).slug);
  const info = eventInfoOf(event);
  const day = event.date.toISOString().slice(0, 10).replace(/-/g, "");
  const at = (hhmm: string) => `${day}T${hhmm.replace(":", "")}00`;
  const nextDay = new Date(event.date.getTime() + 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
  const when = info.startTime
    ? [`DTSTART;TZID=Asia/Bangkok:${at(info.startTime)}`, `DTEND;TZID=Asia/Bangkok:${at(info.endTime ?? info.startTime)}`]
    : [`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${nextDay}`];
  const place = [info.venueName, info.address].filter(Boolean).join(", ");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tohs Event//TH",
    "BEGIN:VEVENT",
    `UID:${event._id.toHexString()}@tohsevent.com`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    ...when,
    `SUMMARY:${esc(event.title)}`,
    ...(place ? [`LOCATION:${esc(place)}`] : []),
    ...(info.location ? [`GEO:${info.location.lat};${info.location.lng}`] : []),
    `DESCRIPTION:${esc([info.description, guestEventUrl(event.slug)].filter(Boolean).join("\n\n"))}`,
    `URL:${guestEventUrl(event.slug)}/info`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
    },
  });
});
