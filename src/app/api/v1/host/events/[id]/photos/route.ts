import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, parseObjectId, route } from "@/server/http";
import { requireEventMember } from "@/server/services/host-events";
import { HOST_PHOTO_VIEWS, listHostPhotos } from "@/server/services/moderation";

const querySchema = z.object({
  view: z.enum(HOST_PHOTO_VIEWS).default("guest"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(48),
});

/** All photos of the event for moderation, including hidden ones. */
export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/photos">) => {
  const { event } = await requireEventMember(req, (await ctx.params).id);
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) throw new HttpError(400, "invalid_query", z.prettifyError(parsed.error));
  const { view, cursor, limit } = parsed.data;
  return Response.json(
    await listHostPhotos(event, { view, limit, cursor: cursor ? parseObjectId(cursor, "invalid_cursor") : undefined }),
  );
});
