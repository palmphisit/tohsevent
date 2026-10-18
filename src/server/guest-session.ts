import { jwtVerify, SignJWT } from "jose";
import type { NextRequest, NextResponse } from "next/server";
import { env } from "./env";

// Guests never create accounts: each event gets its own signed, httpOnly cookie
// holding the guestSessions _id. Scoping per event keeps sessions isolated.
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface GuestClaims {
  sessionId: string;
  eventId: string;
}

export function guestCookieName(eventId: string): string {
  return `tg_${eventId}`;
}

function key(): Uint8Array {
  return new TextEncoder().encode(env().SESSION_SECRET);
}

export async function setGuestCookie(res: NextResponse, claims: GuestClaims): Promise<void> {
  const token = await new SignJWT({ eid: claims.eventId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sessionId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key());

  res.cookies.set(guestCookieName(claims.eventId), token, {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function verifyGuestToken(token: string | undefined, eventId: string): Promise<GuestClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.eid !== eventId || typeof payload.sub !== "string") return null;
    return { sessionId: payload.sub, eventId };
  } catch {
    return null;
  }
}

export function readGuestSession(req: NextRequest, eventId: string): Promise<GuestClaims | null> {
  return verifyGuestToken(req.cookies.get(guestCookieName(eventId))?.value, eventId);
}
