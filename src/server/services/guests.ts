import { ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import { collections } from "../db";
import { readGuestSession } from "../guest-session";
import { HttpError } from "../http";
import { planOf, type EventDoc, type GuestSessionDoc } from "../models";
import { LEGAL } from "../../lib/legal";
import { verifyPassword } from "../password";

/** Guest session as sent to the browser. */
export function toPublicSession(session: GuestSessionDoc) {
  return {
    id: session._id.toHexString(),
    displayName: session.displayName,
    uploadCount: session.uploadCount,
    notifyEmail: session.notify?.email ?? null,
  };
}

export async function findGuestSession(event: EventDoc, sessionId: string): Promise<GuestSessionDoc | null> {
  if (!ObjectId.isValid(sessionId)) return null;
  const { guestSessions } = await collections();
  return guestSessions.findOne({ _id: new ObjectId(sessionId), eventId: event._id });
}

/** Creates a guest session after checking the event password (if any). */
export async function joinEvent(
  event: EventDoc,
  input: { displayName?: string; password?: string; consent?: boolean; ipHash: string | null },
): Promise<GuestSessionDoc> {
  if (!input.consent) {
    throw new HttpError(400, "consent_required", "Accept the privacy policy before joining");
  }
  if (event.access.mode === "password") {
    const ok = !!input.password && !!event.access.passwordHash && (await verifyPassword(input.password, event.access.passwordHash));
    if (!ok) throw new HttpError(401, "invalid_password", "Incorrect event password");
  }

  const { events, guestSessions } = await collections();
  // Atomically take a guest slot so concurrent joins cannot exceed the plan's limit.
  const reserved = await events.findOneAndUpdate(
    { _id: event._id, "counters.guests": { $lt: planOf(event).maxGuests } },
    { $inc: { "counters.guests": 1 }, $set: { updatedAt: new Date() } },
  );
  if (!reserved) throw new HttpError(403, "event_full", "This event has reached its guest limit");

  const session: GuestSessionDoc = {
    _id: new ObjectId(),
    eventId: event._id,
    displayName: input.displayName?.trim() || null,
    uploadCount: 0,
    ipHash: input.ipHash,
    consent: { version: LEGAL.version, at: new Date() },
    createdAt: new Date(),
  };
  await guestSessions.insertOne(session);
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
