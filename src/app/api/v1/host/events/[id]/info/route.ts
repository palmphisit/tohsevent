import type { NextRequest } from "next/server";
import { audit } from "@/server/audit";
import { parseJson, route } from "@/server/http";
import { eventInfoSchema } from "@/server/schemas/registration";
import { saveEventInfo } from "@/server/services/event-info";
import { requireHostEvent } from "@/server/services/host-events";

/** Save the event details: description, times, venue, map pin and schedule (owner). */
export const PUT = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/info">) => {
  const { host, event } = await requireHostEvent(req, (await ctx.params).id);
  const info = await saveEventInfo(event, await parseJson(req, eventInfoSchema));
  await audit({ eventId: event._id, actor: { type: "host", id: host.id }, action: "event_info.update" });
  return Response.json({ info });
});
