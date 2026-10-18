import type { NextRequest } from "next/server";
import { audit } from "@/server/audit";
import { parseObjectId, route } from "@/server/http";
import { requireOpenEventBySlug } from "@/server/services/events";
import { requireGuestSession } from "@/server/services/guests";
import { deletePhoto } from "@/server/services/moderation";

/** A guest deletes a photo they uploaded (PDPA: erasure without waiting for the host). */
export const DELETE = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/photos/[photoId]">) => {
  const { slug, photoId } = await ctx.params;
  const event = await requireOpenEventBySlug(slug);
  const session = await requireGuestSession(req, event);
  const id = parseObjectId(photoId, "photo_not_found");
  await deletePhoto(event, id, { uploaderId: session._id });
  await audit({ eventId: event._id, actor: { type: "guest", id: session._id }, action: "photo.delete", target: id });
  return new Response(null, { status: 204 });
});
