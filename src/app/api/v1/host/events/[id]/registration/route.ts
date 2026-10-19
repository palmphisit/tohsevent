import type { NextRequest } from "next/server";
import { audit } from "@/server/audit";
import { parseJson, route } from "@/server/http";
import { registrationSettingsSchema } from "@/server/schemas/registration";
import { requireHostEvent } from "@/server/services/host-events";
import { saveRegistrationSettings } from "@/server/services/registration";

/** Turn registration on/off and choose what to ask (owner). */
export const PUT = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/registration">) => {
  const { host, event } = await requireHostEvent(req, (await ctx.params).id);
  const settings = await saveRegistrationSettings(event, await parseJson(req, registrationSettingsSchema));
  await audit({ eventId: event._id, actor: { type: "host", id: host.id }, action: "registration.settings" });
  return Response.json({ settings });
});
