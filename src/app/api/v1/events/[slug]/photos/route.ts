import type { NextRequest } from "next/server";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { readGuestSession } from "@/server/guest-session";
import { HttpError, parseObjectId, route } from "@/server/http";
import { requireOpenEventBySlug } from "@/server/services/events";
import { requireGuestSession } from "@/server/services/guests";
import { listEventPhotos } from "@/server/services/photos";

const querySchema = z.object({
  source: z.enum(["guest", "official"]).default("guest"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/photos">) => {
  const { slug } = await ctx.params;
  const event = await requireOpenEventBySlug(slug);
  // Password-protected galleries are only visible to guests who joined with the password.
  const viewer =
    event.access.mode !== "public"
      ? (await requireGuestSession(req, event))._id
      : await readGuestSession(req, event._id.toHexString()).then((c) => (c ? new ObjectId(c.sessionId) : undefined));

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) throw new HttpError(400, "invalid_query", z.prettifyError(parsed.error));
  const { source, cursor, limit } = parsed.data;

  const page = await listEventPhotos(event, {
    source,
    viewerId: viewer,
    limit,
    cursor: cursor ? parseObjectId(cursor, "invalid_cursor") : undefined,
  });
  return Response.json(page);
});
