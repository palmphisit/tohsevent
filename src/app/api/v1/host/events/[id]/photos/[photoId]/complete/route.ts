import type { NextRequest } from "next/server";
import { parseObjectId, route } from "@/server/http";
import { requireEventMember } from "@/server/services/host-events";
import { completeUpload } from "@/server/services/photos";

/** Step 3 of the official upload flow: verify the objects in R2 and publish the photo. */
export const POST = route(
  async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/photos/[photoId]/complete">) => {
    const { id, photoId } = await ctx.params;
    const { host, event } = await requireEventMember(req, id);
    const photo = await completeUpload(event, host.id, parseObjectId(photoId, "photo_not_found"));
    return Response.json({ photo });
  },
);
