import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { readGuestSession, setGuestCookie } from "@/server/guest-session";
import { clientIpHash, parseJson, route } from "@/server/http";
import type { GuestSessionDoc } from "@/server/models";
import { requireOpenEventBySlug } from "@/server/services/events";
import { findGuestSession, joinEvent, requireGuestSession, updateDisplayName } from "@/server/services/guests";

const joinSchema = z.object({
  displayName: z.string().trim().max(40).optional(),
  password: z.string().max(100).optional(),
});

function toPublicSession(session: GuestSessionDoc) {
  return { id: session._id.toHexString(), displayName: session.displayName, uploadCount: session.uploadCount };
}

/** Current guest session for this event (if the cookie is present and valid). */
export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/session">) => {
  const { slug } = await ctx.params;
  const event = await requireOpenEventBySlug(slug);
  const session = await requireGuestSession(req, event);
  return Response.json({ session: toPublicSession(session) });
});

/** Join the event as a guest: no account, just a signed per-event cookie. */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/session">) => {
  const { slug } = await ctx.params;
  const event = await requireOpenEventBySlug(slug);
  const input = await parseJson(req, joinSchema);

  // Re-joining with a valid cookie keeps the same session (and its upload quota).
  const claims = await readGuestSession(req, event._id.toHexString());
  const existing = claims && (await findGuestSession(event, claims.sessionId));
  const session = existing
    ? await updateDisplayName(existing, input.displayName)
    : await joinEvent(event, { ...input, ipHash: clientIpHash(req) });

  const res = NextResponse.json({ session: toPublicSession(session) }, { status: existing ? 200 : 201 });
  await setGuestCookie(res, { sessionId: session._id.toHexString(), eventId: event._id.toHexString() });
  return res;
});
