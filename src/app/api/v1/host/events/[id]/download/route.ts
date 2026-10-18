import type { NextRequest } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { HttpError, route } from "@/server/http";
import { albumZip } from "@/server/services/archive";
import { requireEventMember } from "@/server/services/host-events";

const querySchema = z.object({
  source: z.enum(["guest", "official"]),
  part: z.coerce.number().int().min(1).max(1000).default(1),
});

/** ZIP of the event's visible photos, in parts of ZIP_PART_SIZE (host only). */
export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/download">) => {
  const { host, event } = await requireEventMember(req, (await ctx.params).id);
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) throw new HttpError(400, "invalid_query", z.prettifyError(parsed.error));
  const { source, part } = parsed.data;
  const response = await albumZip(event, source, part);
  await audit({ eventId: event._id, actor: { type: "host", id: host.id }, action: "album.download", meta: { source, part } });
  return response;
});
