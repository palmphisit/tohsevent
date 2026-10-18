import type { NextRequest } from "next/server";
import { parseJson, route } from "@/server/http";
import { uploadRequestSchema } from "@/server/schemas/uploads";
import { requireOpenEventBySlug } from "@/server/services/events";
import { requireGuestSession } from "@/server/services/guests";
import { createGuestUploads } from "@/server/services/photos";

/**
 * Step 1 of the guest upload flow. Returns presigned PUT URLs; the client uploads
 * both variants straight to R2 and then calls `/photos/:photoId/complete`.
 */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/uploads">) => {
  const { slug } = await ctx.params;
  const event = await requireOpenEventBySlug(slug);
  const session = await requireGuestSession(req, event);
  const { files } = await parseJson(req, uploadRequestSchema);

  const uploads = await createGuestUploads(event, session._id, files);
  return Response.json({ uploads }, { status: 201 });
});
