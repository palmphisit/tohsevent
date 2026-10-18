import type { NextRequest } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { parseJson, parseObjectId, route } from "@/server/http";
import { REPORT_REASONS } from "@/server/models";
import { requireOpenEventBySlug } from "@/server/services/events";
import { requireGuestSession } from "@/server/services/guests";
import { reportPhoto } from "@/server/services/moderation";

const bodySchema = z.object({
  reason: z.enum(REPORT_REASONS),
  note: z.string().trim().max(500).optional(),
});

/** A guest asks the host to review a photo (inappropriate, or "I'm in it, please remove"). */
export const POST = route(
  async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/photos/[photoId]/report">) => {
    const { slug, photoId } = await ctx.params;
    const event = await requireOpenEventBySlug(slug);
    const session = await requireGuestSession(req, event);
    const input = await parseJson(req, bodySchema);
    const id = parseObjectId(photoId, "photo_not_found");
    await reportPhoto(event, id, session._id, input);
    await audit({
      eventId: event._id,
      actor: { type: "guest", id: session._id },
      action: "report.create",
      target: id,
      meta: { reason: input.reason },
    });
    return new Response(null, { status: 204 });
  },
);
