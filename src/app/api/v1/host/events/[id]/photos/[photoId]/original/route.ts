import type { NextRequest } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { parseJson, parseObjectId, route } from "@/server/http";
import { requireEventMember } from "@/server/services/host-events";
import {
  ORIGINAL_CONTENT_TYPES,
  ORIGINAL_LIMITS,
  originalDownloadUrl,
  startOriginalUpload,
} from "@/server/services/originals";

type Ctx = RouteContext<"/api/v1/host/events/[id]/photos/[photoId]/original">;

const startSchema = z.object({
  contentType: z.enum(ORIGINAL_CONTENT_TYPES),
  bytes: z.number().int().positive().max(ORIGINAL_LIMITS.maxBytes),
  filename: z.string().trim().min(1).max(200),
});

/** Starts (or resumes) the multipart upload of a photo's original file. */
export const POST = route(async (req: NextRequest, ctx: Ctx) => {
  const { id, photoId } = await ctx.params;
  const { host, event, role } = await requireEventMember(req, id);
  const input = await parseJson(req, startSchema);
  const result = await startOriginalUpload(event, { id: host.id, role }, parseObjectId(photoId, "photo_not_found"), input);
  return Response.json(result, { status: 201 });
});

/** Redirects to a 10-minute download link for the original. */
export const GET = route(async (req: NextRequest, ctx: Ctx) => {
  const { id, photoId } = await ctx.params;
  const { host, event } = await requireEventMember(req, id);
  const target = parseObjectId(photoId, "photo_not_found");
  const url = await originalDownloadUrl(event, target);
  await audit({ eventId: event._id, actor: { type: "host", id: host.id }, action: "original.download", target });
  return Response.redirect(url, 302);
});
