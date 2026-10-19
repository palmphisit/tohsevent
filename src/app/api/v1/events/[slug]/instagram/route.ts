import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseJson, parseObjectId, route } from "@/server/http";
import { requireOpenEventBySlug } from "@/server/services/events";
import { requireGuestSession } from "@/server/services/guests";
import { sendShoutout } from "@/server/services/slideshow";

const bodySchema = z.object({ photoId: z.string().max(40), instagram: z.string().max(80) });

/** Pops a photo the guest just uploaded up on the slideshow (once) with their Instagram @. */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/instagram">) => {
  const event = await requireOpenEventBySlug((await ctx.params).slug);
  const session = await requireGuestSession(req, event);
  const { photoId, instagram } = await parseJson(req, bodySchema);
  const result = await sendShoutout(event, session._id, parseObjectId(photoId, "photo_not_found"), instagram);
  return Response.json(result);
});
