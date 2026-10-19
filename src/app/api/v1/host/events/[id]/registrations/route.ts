import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, route } from "@/server/http";
import { requireHostEvent } from "@/server/services/host-events";
import { listRegistrations, registrationStats } from "@/server/services/registration";

const query = z.object({
  q: z.string().max(100).optional(),
  filter: z.enum(["all", "in", "out", "cancelled"]).default("all"),
});

/** Attendee list for the dashboard (owner). */
export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/registrations">) => {
  const { event } = await requireHostEvent(req, (await ctx.params).id);
  const parsed = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) throw new HttpError(400, "invalid_query", "Invalid query");
  const { q, filter } = parsed.data;
  const [items, stats] = await Promise.all([listRegistrations(event, { q, filter }), registrationStats(event)]);
  return Response.json({ items, stats }, { headers: { "Cache-Control": "no-store" } });
});
