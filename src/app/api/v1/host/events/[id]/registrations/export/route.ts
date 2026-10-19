import type { NextRequest } from "next/server";
import { audit } from "@/server/audit";
import { route } from "@/server/http";
import { requireHostEvent } from "@/server/services/host-events";
import { registrationsCsv } from "@/server/services/registration";

/** Download all registrations with check-in times as CSV (owner). */
export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/registrations/export">) => {
  const { host, event } = await requireHostEvent(req, (await ctx.params).id);
  await audit({ eventId: event._id, actor: { type: "host", id: host.id }, action: "registration.export" });
  return new Response(await registrationsCsv(event), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tohsevent-${event.slug}-registrations.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
