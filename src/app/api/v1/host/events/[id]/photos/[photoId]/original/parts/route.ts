import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseJson, parseObjectId, route } from "@/server/http";
import { requireEventMember } from "@/server/services/host-events";
import { ORIGINAL_LIMITS, signOriginalParts } from "@/server/services/originals";

const bodySchema = z.object({
  partNumbers: z.array(z.number().int().min(1)).min(1).max(ORIGINAL_LIMITS.maxSignPerRequest),
});

/** Presigned PUT URLs (1 hour) for the given part numbers. */
export const POST = route(
  async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/photos/[photoId]/original/parts">) => {
    const { id, photoId } = await ctx.params;
    const { host, event, role } = await requireEventMember(req, id);
    const { partNumbers } = await parseJson(req, bodySchema);
    const parts = await signOriginalParts(event, { id: host.id, role }, parseObjectId(photoId, "photo_not_found"), partNumbers);
    return Response.json({ parts });
  },
);
