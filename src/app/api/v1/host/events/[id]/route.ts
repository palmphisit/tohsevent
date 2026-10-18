import type { NextRequest } from "next/server";
import { requireHost } from "@/server/auth";
import { parseJson, parseObjectId, route } from "@/server/http";
import { updateEventSchema } from "@/server/schemas/events";
import { requireHostEvent, toHostEvent, updateHostEvent } from "@/server/services/host-events";

export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]">) => {
  const { event } = await requireHostEvent(req, (await ctx.params).id);
  return Response.json({ event: toHostEvent(event) });
});

export const PATCH = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]">) => {
  const host = await requireHost(req);
  const { id } = await ctx.params;
  const input = await parseJson(req, updateEventSchema);
  const event = await updateHostEvent(host.id, parseObjectId(id, "event_not_found"), input);
  return Response.json({ event: toHostEvent(event) });
});
