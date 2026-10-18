import type { NextRequest } from "next/server";
import { audit } from "@/server/audit";
import { parseJson, route } from "@/server/http";
import { saveSlideshowSchema } from "@/server/schemas/slideshow";
import { requireHostEvent } from "@/server/services/host-events";
import { saveSlideshow, slideshowSettings, slideshowUrl } from "@/server/services/slideshow";

export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/slideshow">) => {
  const { event } = await requireHostEvent(req, (await ctx.params).id);
  return Response.json({ slideshow: slideshowSettings(event), url: slideshowUrl(event) });
});

/** Save the venue-screen slideshow settings (owner only, every plan). */
export const PUT = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/slideshow">) => {
  const { host, event } = await requireHostEvent(req, (await ctx.params).id);
  const input = await parseJson(req, saveSlideshowSchema);
  const slideshow = await saveSlideshow(event, input);
  await audit({ eventId: event._id, actor: { type: "host", id: host.id }, action: "slideshow.update" });
  return Response.json({ slideshow });
});
