import { ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import { collections } from "../db";
import { readGuestSession } from "../guest-session";
import { HttpError } from "../http";
import type { EventDoc, GuestSessionDoc } from "../models";
import { verifyPassword } from "../password";
import { incrementEventCounter } from "./events";

export async function findGuestSession(event: EventDoc, sessionId: string): Promise<GuestSessionDoc | null> {
  if (!ObjectId.isValid(sessionId)) return null;
  const { guestSessions } = await collections();
  return guestSessions.findOne({ _id: new ObjectId(sessionId), eventId: event._id });
}

/** Creates a guest session after checking the event password (if any). */
export async function joinEvent(
  event: EventDoc,
  input: { displayName?: string; password?: string; ipHash: string | null },
): Promise<GuestSessionDoc> {
  if (event.access.mode === "password") {
    const ok = !!input.password && !!event.access.passwordHash && (await verifyPassword(input.password, event.access.passwordHash));
    if (!ok) throw new HttpError(401, "invalid_password", "Incorrect event password");
  }

  const session: GuestSessionDoc = {
    _id: new ObjectId(),
    eventId: event._id,
    displayName: input.displayName?.trim() || null,
    uploadCount: 0,
    ipHash: input.ipHash,
    createdAt: new Date(),
  };
  const { guestSessions } = await collections();
  await guestSessions.insertOne(session);
  await incrementEventCounter(event._id, "guests");
  return session;
}

export async function updateDisplayName(session: GuestSessionDoc, displayName: string | undefined) {
  if (displayName === undefined) return session;
  const name = displayName.trim() || null;
  if (name === session.displayName) return session;
  const { guestSessions } = await collections();
  await guestSessions.updateOne({ _id: session._id }, { $set: { displayName: name } });
  return { ...session, displayName: name };
}

/** Resolves the caller's guest session for this event from the signed cookie, or throws 401. */
export async function requireGuestSession(req: NextRequest, event: EventDoc): Promise<GuestSessionDoc> {
  const claims = await readGuestSession(req, event._id.toHexString());
  const session = claims && (await findGuestSession(event, claims.sessionId));
  if (!session) throw new HttpError(401, "no_session", "Join the event first");
  return session;
}
