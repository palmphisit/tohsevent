import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";
import type { EventDoc } from "./models";

// Signed per-event links for people without an account: door staff checking guests in,
// and the on-site sign-up poster. The key is an HMAC of the event id and the purpose.

export type EventKeyPurpose = "checkin" | "onsite";

export function eventKey(event: Pick<EventDoc, "_id">, purpose: EventKeyPurpose): string {
  return createHmac("sha256", env().SESSION_SECRET)
    .update(`${purpose}:${event._id.toHexString()}`)
    .digest("base64url")
    .slice(0, 22);
}

export function verifyEventKey(event: Pick<EventDoc, "_id">, purpose: EventKeyPurpose, key: string | null | undefined): boolean {
  if (!key) return false;
  const expected = Buffer.from(eventKey(event, purpose));
  const given = Buffer.from(key);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
