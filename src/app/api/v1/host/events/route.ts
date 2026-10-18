import { requireHost } from "@/server/auth";
import { parseJson, route } from "@/server/http";
import { createEventSchema } from "@/server/schemas/events";
import { createHostEvent, listHostEvents, toHostEvent } from "@/server/services/host-events";

export const GET = route(async (req: Request) => {
  const host = await requireHost(req);
  return Response.json({ events: await listHostEvents(host.id) });
});

export const POST = route(async (req: Request) => {
  const host = await requireHost(req);
  const input = await parseJson(req, createEventSchema);
  const event = await createHostEvent(host.id, input);
  return Response.json({ event: toHostEvent(event) }, { status: 201 });
});
