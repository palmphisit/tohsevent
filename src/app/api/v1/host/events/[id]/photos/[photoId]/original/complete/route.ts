import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseJson, parseObjectId, route } from "@/server/http";
import { requireEventMember } from "@/server/services/host-events";
import { completeOriginalUpload } from "@/server/services/originals";

const bodySchema = z.object({
  parts: z.array(z.object({ partNumber: z.number().int().min(1), etag: z.string().min(1).max(200) })).min(1).max(10_000),
});

/** Assembles the uploaded parts and verifies the stored size. */
export const POST = route(
  async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/photos/[photoId]/original/complete">) => {
    const { id, photoId } = await ctx.params;
    const { host, event, role } = await requireEventMember(req, id);
    const { parts } = await parseJson(req, bodySchema);
    await completeOriginalUpload(event, { id: host.id, role }, parseObjectId(photoId, "photo_not_found"), parts);
    return new Response(null, { status: 204 });
  },
);
