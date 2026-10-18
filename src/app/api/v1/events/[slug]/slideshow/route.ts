import type { NextRequest } from "next/server";
import { z } from "zod";
import { readGuestSession } from "@/server/guest-session";
import { HttpError, route } from "@/server/http";
import { SLIDESHOW_SOURCES } from "@/server/models";
import { requireOpenEventBySlug } from "@/server/services/events";
import { listSlideshowPhotos, slideshowSettings, verifySlideshowKey } from "@/server/services/slideshow";

const querySchema = z.object({
  key: z.string().max(64).optional(),
  /** Defaults to the saved setting; the dashboard preview passes its draft value. */
  sources: z.enum(SLIDESHOW_SOURCES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(60),
});

/** Photos for the venue slideshow: newest first, both sources merged, plus the saved settings. */
export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/slideshow">) => {
  const { slug } = await ctx.params;
  const event = await requireOpenEventBySlug(slug);
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) throw new HttpError(400, "invalid_query", z.prettifyError(parsed.error));
  const { key, sources, limit } = parsed.data;

  if (event.access.mode !== "public" && !verifySlideshowKey(event, key)) {
    const guest = await readGuestSession(req, event._id.toHexString());
    if (!guest) throw new HttpError(401, "slideshow_key_required", "Open the slideshow from the host dashboard link");
  }

  // Settings ride along so a running venue screen picks up the host's changes without a reload.
  const settings = slideshowSettings(event);
  const page = await listSlideshowPhotos(event, { sources: sources ?? settings.sources, limit });
  return Response.json({ ...page, settings }, { headers: { "Cache-Control": "no-store" } });
});
