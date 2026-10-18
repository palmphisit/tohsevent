import type { NextRequest } from "next/server";
import { parseJson, route } from "@/server/http";
import { saveBrandingSchema } from "@/server/schemas/branding";
import { saveBranding, toBrandingEditorState } from "@/server/services/branding";
import { requireHostEvent } from "@/server/services/host-events";

export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/branding">) => {
  const { event } = await requireHostEvent(req, (await ctx.params).id);
  return Response.json({ branding: toBrandingEditorState(event) });
});

/** Save the guest-page branding (Premium only). */
export const PUT = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/branding">) => {
  const { event } = await requireHostEvent(req, (await ctx.params).id);
  const input = await parseJson(req, saveBrandingSchema);
  const branding = await saveBranding(event, input);
  return Response.json({ branding: toBrandingEditorState({ ...event, branding }) });
});
