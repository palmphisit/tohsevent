import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseJson, parseObjectId, route } from "@/server/http";
import { requireOpenEventBySlug } from "@/server/services/events";
import { requireGuestSession } from "@/server/services/guests";
import { sendShoutout, shareablePhotos, SHOUTOUT_COOLDOWN_SEC } from "@/server/services/slideshow";

const bodySchema = z.object({ photoId: z.string().max(40), instagram: z.string().max(80) });

/** The guest's own photos they can send to the venue screen. */
export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/instagram">) => {
  const event = await requireOpenEventBySlug((await ctx.params).slug);
  const session = await requireGuestSession(req, event);
  return Response.json(
    { items: await shareablePhotos(event, session._id), cooldownSec: SHOUTOUT_COOLDOWN_SEC },
    { headers: { "Cache-Control": "no-store" } },
  );
});

/** Pops one of the guest's photos up on the slideshow with their Instagram @. */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/instagram">) => {
  const event = await requireOpenEventBySlug((await ctx.params).slug);
  const session = await requireGuestSession(req, event);
  const { photoId, instagram } = await parseJson(req, bodySchema);
  const result = await sendShoutout(event, session._id, parseObjectId(photoId, "photo_not_found"), instagram);
  return Response.json(result);
});
