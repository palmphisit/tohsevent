import type { NextRequest } from "next/server";
import { parseObjectId, route } from "@/server/http";
import { requireHostEvent } from "@/server/services/host-events";
import { listInstagramShares } from "@/server/services/slideshow";

/** Owner only: photos guests sent to the screen with Instagram share (kept out of the album). */
export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/instagram-shares">) => {
  const { event } = await requireHostEvent(req, (await ctx.params).id);
  const cursor = req.nextUrl.searchParams.get("cursor");
  const page = await listInstagramShares(event, {
    cursor: cursor ? parseObjectId(cursor, "invalid_cursor") : undefined,
    limit: 30,
  });
  return Response.json(page, { headers: { "Cache-Control": "no-store" } });
});
