import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, parseJson, parseObjectId, route } from "@/server/http";
import { requireHostEvent } from "@/server/services/host-events";
import { sendTicketEmail } from "@/server/services/notifications";
import { cancelRegistration, checkIn, findById, toHostRegistration, undoCheckIn } from "@/server/services/registration";

/** Owner actions on one registration: check in, undo check-in, cancel, email the ticket again. */
export const PATCH = route(
  async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/registrations/[regId]">) => {
    const { id, regId } = await ctx.params;
    const { host, event } = await requireHostEvent(req, id);
    const { action } = await parseJson(req, z.object({ action: z.enum(["checkin", "undo", "cancel", "email"]) }));
    const target = parseObjectId(regId, "registration_not_found");
    if (action === "checkin") return Response.json((await checkIn(event, { id: target }, host.id.toHexString())));
    if (action === "email") {
      const reg = await findById(event, target);
      if (!(await sendTicketEmail(event, reg))) throw new HttpError(409, "no_email", "This registration has no email address");
      return Response.json({ registration: toHostRegistration(await findById(event, target)) });
    }
    if (action === "undo") return Response.json({ registration: await undoCheckIn(event, target) });
    return Response.json({ registration: await cancelRegistration(event, target) });
  },
);
