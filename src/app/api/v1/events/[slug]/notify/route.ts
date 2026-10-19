import type { NextRequest } from "next/server";
import { z } from "zod";
import { LOCALES } from "@/lib/i18n";
import { parseJson, route } from "@/server/http";
import { requireOpenEventBySlug } from "@/server/services/events";
import { requireGuestSession } from "@/server/services/guests";
import { subscribeGuest, unsubscribeGuest } from "@/server/services/notifications";

const bodySchema = z.object({ email: z.email().max(200), locale: z.enum(LOCALES).optional() });

/** Opt in to "official photos are ready" email for this event. */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/notify">) => {
  const event = await requireOpenEventBySlug((await ctx.params).slug);
  const session = await requireGuestSession(req, event);
  const { email, locale } = await parseJson(req, bodySchema);
  await subscribeGuest(session, email, locale ?? event.language ?? "th");
  return Response.json({ notifyEmail: email.trim().toLowerCase() });
});

export const DELETE = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/notify">) => {
  const event = await requireOpenEventBySlug((await ctx.params).slug);
  const session = await requireGuestSession(req, event);
  await unsubscribeGuest(session._id);
  return new Response(null, { status: 204 });
});
