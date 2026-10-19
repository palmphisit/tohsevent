import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseJson, parseObjectId, route } from "@/server/http";
import { requireHostEvent } from "@/server/services/host-events";
import { cancelRegistration, checkIn, undoCheckIn } from "@/server/services/registration";

/** Owner actions on one registration: check in, undo check-in, cancel. */
export const PATCH = route(
  async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/registrations/[regId]">) => {
    const { id, regId } = await ctx.params;
    const { host, event } = await requireHostEvent(req, id);
    const { action } = await parseJson(req, z.object({ action: z.enum(["checkin", "undo", "cancel"]) }));
    const target = parseObjectId(regId, "registration_not_found");
    if (action === "checkin") return Response.json((await checkIn(event, { id: target }, host.id.toHexString())));
    if (action === "undo") return Response.json({ registration: await undoCheckIn(event, target) });
    return Response.json({ registration: await cancelRegistration(event, target) });
  },
);
