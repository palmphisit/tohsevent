import type { NextRequest } from "next/server";
import { parseObjectId, route } from "@/server/http";
import { requireOpenEventBySlug } from "@/server/services/events";
import { requireGuestSession } from "@/server/services/guests";
import { completeGuestUpload } from "@/server/services/photos";

/** Step 3 of the guest upload flow: verify the objects in R2 and publish the photo. */
export const POST = route(
  async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/photos/[photoId]/complete">) => {
    const { slug, photoId } = await ctx.params;
    const event = await requireOpenEventBySlug(slug);
    const session = await requireGuestSession(req, event);
    const photo = await completeGuestUpload(event, session._id, parseObjectId(photoId, "photo_not_found"));
    return Response.json({ photo });
  },
);
