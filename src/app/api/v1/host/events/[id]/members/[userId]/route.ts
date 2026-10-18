import type { NextRequest } from "next/server";
import { audit } from "@/server/audit";
import { parseObjectId, route } from "@/server/http";
import { requireHostEvent } from "@/server/services/host-events";
import { removeMember } from "@/server/services/members";

export const DELETE = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/members/[userId]">) => {
  const { id, userId } = await ctx.params;
  const { host, event } = await requireHostEvent(req, id);
  const target = parseObjectId(userId, "member_not_found");
  await removeMember(event, target);
  await audit({ eventId: event._id, actor: { type: "host", id: host.id }, action: "member.remove", target });
  return new Response(null, { status: 204 });
});
