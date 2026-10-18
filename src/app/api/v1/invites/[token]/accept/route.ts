import type { NextRequest } from "next/server";
import { audit } from "@/server/audit";
import { requireHost } from "@/server/auth";
import { route } from "@/server/http";
import { acceptInvite } from "@/server/services/members";

/** The signed-in user joins the event as a photographer. */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/invites/[token]/accept">) => {
  const host = await requireHost(req);
  const event = await acceptInvite((await ctx.params).token, host.id);
  await audit({ eventId: event._id, actor: { type: "host", id: host.id }, action: "member.join" });
  return Response.json({ eventId: event._id.toHexString() });
});
