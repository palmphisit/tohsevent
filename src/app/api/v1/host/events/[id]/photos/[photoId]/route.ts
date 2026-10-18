import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseJson, parseObjectId, route } from "@/server/http";
import { requireHostEvent } from "@/server/services/host-events";
import { deletePhoto, moderatePhoto } from "@/server/services/moderation";

const patchSchema = z
  .object({ status: z.enum(["ready", "hidden"]), dismissReports: z.literal(true) })
  .partial()
  .refine((body) => body.status || body.dismissReports, "Nothing to update");

type Ctx = RouteContext<"/api/v1/host/events/[id]/photos/[photoId]">;

/** Hide / unhide a photo, or dismiss its reports. */
export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const { id, photoId } = await ctx.params;
  const { event } = await requireHostEvent(req, id);
  const action = await parseJson(req, patchSchema);
  const photo = await moderatePhoto(event, parseObjectId(photoId, "photo_not_found"), action);
  return Response.json({ photo });
});

/** Permanently removes the photo files from storage. */
export const DELETE = route(async (req: NextRequest, ctx: Ctx) => {
  const { id, photoId } = await ctx.params;
  const { event } = await requireHostEvent(req, id);
  await deletePhoto(event, parseObjectId(photoId, "photo_not_found"));
  return new Response(null, { status: 204 });
});
