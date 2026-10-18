import type { NextRequest } from "next/server";
import { parseObjectId, route } from "@/server/http";
import { requireHostEvent } from "@/server/services/host-events";
import { revokeInvite } from "@/server/services/members";

export const DELETE = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/invites/[inviteId]">) => {
  const { id, inviteId } = await ctx.params;
  const { event } = await requireHostEvent(req, id);
  await revokeInvite(event, parseObjectId(inviteId, "invite_not_found"));
  return new Response(null, { status: 204 });
});
