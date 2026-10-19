import type { NextRequest } from "next/server";
import { audit } from "@/server/audit";
import { parseJson, route } from "@/server/http";
import { saveAppearanceSchema } from "@/server/schemas/appearance";
import { saveAppearance } from "@/server/services/appearance";
import { requireHostEvent } from "@/server/services/host-events";

/** Save how the guest page looks (owner only, every plan). */
export const PUT = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/appearance">) => {
  const { host, event } = await requireHostEvent(req, (await ctx.params).id);
  const appearance = await saveAppearance(event, await parseJson(req, saveAppearanceSchema));
  await audit({ eventId: event._id, actor: { type: "host", id: host.id }, action: "appearance.update" });
  return Response.json({ appearance });
});
