import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireCheckinAccess } from "@/server/checkin-access";
import { parseJson, parseObjectId, route } from "@/server/http";
import { requireOpenEventBySlug } from "@/server/services/events";
import { undoCheckIn } from "@/server/services/registration";

/** Undo a mistaken check-in (wrong guest tapped). */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/checkin/undo">) => {
  const event = await requireOpenEventBySlug((await ctx.params).slug);
  const { key, id } = await parseJson(req, z.object({ key: z.string().max(64).optional(), id: z.string() }));
  await requireCheckinAccess(req, event, key);
  return Response.json({ registration: await undoCheckIn(event, parseObjectId(id, "registration_not_found")) });
});
