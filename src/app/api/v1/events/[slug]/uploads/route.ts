import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseJson, route } from "@/server/http";
import { UPLOAD_CONTENT_TYPES, UPLOAD_LIMITS } from "@/server/models";
import { requireOpenEventBySlug } from "@/server/services/events";
import { requireGuestSession } from "@/server/services/guests";
import { createGuestUploads } from "@/server/services/photos";

const fileSchema = z.object({
  contentType: z.enum(UPLOAD_CONTENT_TYPES),
  bytes: z.object({
    display: z.number().int().positive().max(UPLOAD_LIMITS.maxBytes.display),
    thumb: z.number().int().positive().max(UPLOAD_LIMITS.maxBytes.thumb),
  }),
  width: z.number().int().positive().max(20_000),
  height: z.number().int().positive().max(20_000),
  takenAt: z.iso.datetime().optional(),
});

const bodySchema = z.object({
  files: z.array(fileSchema).min(1).max(UPLOAD_LIMITS.maxFilesPerRequest),
});

/**
 * Step 1 of the guest upload flow. Returns presigned PUT URLs; the client uploads
 * both variants straight to R2 and then calls `/photos/:photoId/complete`.
 */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/uploads">) => {
  const { slug } = await ctx.params;
  const event = await requireOpenEventBySlug(slug);
  const session = await requireGuestSession(req, event);
  const { files } = await parseJson(req, bodySchema);

  const uploads = await createGuestUploads(event, session._id, files);
  return Response.json({ uploads }, { status: 201 });
});
