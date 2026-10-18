import type { NextRequest } from "next/server";
import { audit } from "@/server/audit";
import { route } from "@/server/http";
import { requireHostEvent } from "@/server/services/host-events";
import { notifyGuestsPhotosReady } from "@/server/services/notifications";

/** Email subscribed guests that the official photos are ready (each guest once). */
export const POST = route(
  async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/notify-guests">) => {
    const { host, event } = await requireHostEvent(req, (await ctx.params).id);
    const sent = await notifyGuestsPhotosReady(event);
    await audit({ eventId: event._id, actor: { type: "host", id: host.id }, action: "guests.notify", meta: { sent } });
    return Response.json({ sent });
  },
);
