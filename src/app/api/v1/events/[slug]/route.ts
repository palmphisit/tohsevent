import type { NextRequest } from "next/server";
import { route } from "@/server/http";
import { requireOpenEventBySlug, toPublicEvent } from "@/server/services/events";

export const GET = route(async (_req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]">) => {
  const { slug } = await ctx.params;
  const event = await requireOpenEventBySlug(slug);
  return Response.json({ event: toPublicEvent(event) });
});
