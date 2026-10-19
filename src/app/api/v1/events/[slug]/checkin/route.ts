import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireCheckinAccess } from "@/server/checkin-access";
import { HttpError, parseJson, parseObjectId, route } from "@/server/http";
import { requireOpenEventBySlug } from "@/server/services/events";
import { checkIn, codeFromScan, listRegistrations, registrationStats } from "@/server/services/registration";

const listQuery = z.object({
  key: z.string().max(64).optional(),
  q: z.string().max(100).optional(),
  filter: z.enum(["all", "in", "out"]).default("all"),
});

/** Door list: search guests and see live counts (staff key or event member). */
export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/checkin">) => {
  const event = await requireOpenEventBySlug((await ctx.params).slug);
  const parsed = listQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) throw new HttpError(400, "invalid_query", "Invalid query");
  const query = parsed.data;
  await requireCheckinAccess(req, event, query.key);
  const [items, stats] = await Promise.all([
    listRegistrations(event, { q: query.q, filter: query.filter, limit: 100 }),
    registrationStats(event),
  ]);
  return Response.json({ items, stats }, { headers: { "Cache-Control": "no-store" } });
});

const checkInBody = z.object({
  key: z.string().max(64).optional(),
  /** Scanned QR text (ticket URL) or a typed code. */
  scan: z.string().max(300).optional(),
  id: z.string().optional(),
});

/** Check a guest in by scanned ticket or from the list. Records the arrival time. */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/checkin">) => {
  const event = await requireOpenEventBySlug((await ctx.params).slug);
  const body = await parseJson(req, checkInBody);
  const by = await requireCheckinAccess(req, event, body.key);
  if (body.id) return Response.json(await checkIn(event, { id: parseObjectId(body.id, "registration_not_found") }, by));
  const code = body.scan ? codeFromScan(body.scan) : null;
  if (!code) throw new HttpError(400, "invalid_ticket", "This QR code is not a Tohs Event ticket");
  return Response.json(await checkIn(event, { code }, by));
});
