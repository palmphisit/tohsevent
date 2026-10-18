import type { NextRequest } from "next/server";
import { audit } from "@/server/audit";
import { route } from "@/server/http";
import { requireHostEvent } from "@/server/services/host-events";
import { createInvite, listMembers } from "@/server/services/members";

/** Members (photographers) and pending invites (owner only). */
export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/members">) => {
  const { event } = await requireHostEvent(req, (await ctx.params).id);
  return Response.json(await listMembers(event));
});

/** Creates a photographer invite link. */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/members">) => {
  const { host, event } = await requireHostEvent(req, (await ctx.params).id);
  const invite = await createInvite(event, host.id);
  await audit({ eventId: event._id, actor: { type: "host", id: host.id }, action: "member.invite" });
  return Response.json(invite, { status: 201 });
});
