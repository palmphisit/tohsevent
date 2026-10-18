import { randomInt } from "node:crypto";
import { MongoServerError, ObjectId } from "mongodb";
import { requireHost, type Host } from "../auth";
import { collections } from "../db";
import { env } from "../env";
import { HttpError, parseObjectId } from "../http";
import { planOf, type EventDoc, type EventStatus } from "../models";
import { hashPassword } from "../password";
import { expiryFor, PLANS, type PlanTier } from "../plans";

const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes (i/l/1, o/0)
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/** What the signed-in user may do with an event. */
export type EventRole = "owner" | "photographer";

export function roleOf(event: EventDoc, userId: ObjectId): EventRole | null {
  if (event.ownerId?.equals(userId)) return "owner";
  return event.members?.find((m) => m.userId.equals(userId))?.role ?? null;
}

export interface HostEvent {
  id: string;
  /** The requesting user's role on this event. */
  role: EventRole;
  slug: string;
  title: string;
  date: string; // YYYY-MM-DD
  accessMode: EventDoc["access"]["mode"];
  guestUpload: boolean;
  status: EventStatus;
  counters: EventDoc["counters"];
  plan: {
    tier: PlanTier;
    name: string;
    maxGuests: number;
    maxPhotos: number;
    retentionDays: number;
    watermark: boolean;
  };
  usage: { guests: number; photos: number };
  /** ISO date-time the album closes to guests; null for legacy events without expiry. */
  expiresAt: string | null;
  guestUrl: string;
  createdAt: string;
}

export function guestEventUrl(slug: string): string {
  return `${env().APP_ORIGIN}/e/${slug}`;
}

export function toHostEvent(event: EventDoc, role: EventRole = "owner"): HostEvent {
  const plan = planOf(event);
  return {
    id: event._id.toHexString(),
    role,
    slug: event.slug,
    title: event.title,
    date: event.date.toISOString().slice(0, 10),
    accessMode: event.access.mode,
    guestUpload: event.settings.guestUpload,
    status: event.status,
    counters: event.counters,
    plan: {
      tier: plan.tier,
      name: plan.name,
      maxGuests: plan.maxGuests,
      maxPhotos: plan.maxPhotos,
      retentionDays: plan.retentionDays,
      watermark: plan.watermark,
    },
    usage: { guests: event.counters.guests, photos: event.usage?.photos ?? event.counters.photos },
    expiresAt: event.expiresAt?.toISOString() ?? null,
    guestUrl: guestEventUrl(event.slug),
    createdAt: event.createdAt.toISOString(),
  };
}

function randomSlug(length = 8): string {
  return Array.from({ length }, () => SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)]).join("");
}

/** Event dates are calendar days; store them as UTC midnight so they never shift across time zones. */
function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function isDuplicateKey(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000;
}

/** Events the user owns or was invited to. */
export async function listHostEvents(userId: ObjectId): Promise<HostEvent[]> {
  const { events } = await collections();
  const docs = await events
    .find({ $or: [{ ownerId: userId }, { "members.userId": userId }] })
    .sort({ date: -1, _id: -1 })
    .limit(200)
    .toArray();
  return docs.map((event) => toHostEvent(event, roleOf(event, userId) ?? "owner"));
}

/** The event if the user owns it or is a member, with their role; 404 otherwise. */
export async function getEventForMember(userId: ObjectId, eventId: ObjectId): Promise<{ event: EventDoc; role: EventRole }> {
  const { events } = await collections();
  const event = await events.findOne({ _id: eventId, $or: [{ ownerId: userId }, { "members.userId": userId }] });
  const role = event && roleOf(event, userId);
  if (!event || !role) throw new HttpError(404, "event_not_found");
  return { event, role };
}

export async function getHostEvent(ownerId: ObjectId, eventId: ObjectId): Promise<EventDoc> {
  const { events } = await collections();
  const event = await events.findOne({ _id: eventId, ownerId });
  if (!event) throw new HttpError(404, "event_not_found");
  return event;
}

/** Route-handler helper for owner-only actions: the signed-in owner and their event, or 401/404. */
export async function requireHostEvent(req: Request, id: string): Promise<{ host: Host; event: EventDoc }> {
  const host = await requireHost(req);
  const event = await getHostEvent(host.id, parseObjectId(id, "event_not_found"));
  return { host, event };
}

/** Route-handler helper for actions photographers may also do (uploads, viewing, downloads). */
export async function requireEventMember(
  req: Request,
  id: string,
): Promise<{ host: Host; event: EventDoc; role: EventRole }> {
  const host = await requireHost(req);
  const { event, role } = await getEventForMember(host.id, parseObjectId(id, "event_not_found"));
  return { host, event, role };
}

export interface CreateEventInput {
  title: string;
  date: string;
  slug?: string;
  accessMode: EventDoc["access"]["mode"];
  password?: string;
}

export async function createHostEvent(ownerId: ObjectId, input: CreateEventInput): Promise<EventDoc> {
  if (input.accessMode === "password" && !input.password) {
    throw new HttpError(400, "password_required", "A password is required for password-protected events");
  }
  const { events } = await collections();
  const now = new Date();
  const date = parseDay(input.date);
  const base: Omit<EventDoc, "_id" | "slug"> = {
    ownerId,
    title: input.title,
    date,
    access:
      input.accessMode === "password"
        ? { mode: "password", passwordHash: await hashPassword(input.password!) }
        : { mode: "public" },
    settings: { guestUpload: true, moderation: "post", maxPhotosPerGuest: PLANS.free.maxPhotosPerGuest },
    status: "live",
    // Every event starts on the Free plan; upgrading extends the expiry (see billing.ts).
    plan: { tier: "free", upgradedAt: null },
    expiresAt: expiryFor(date, "free", now),
    counters: { photos: 0, guests: 0 },
    usage: { photos: 0 },
    purgedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  // A custom slug must be free; a random one is retried on the (rare) collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const event: EventDoc = { _id: new ObjectId(), slug: input.slug ?? randomSlug(), ...base };
    try {
      await events.insertOne(event);
      return event;
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      if (input.slug) throw new HttpError(409, "slug_taken", "This link is already in use");
    }
  }
  throw new HttpError(500, "slug_generation_failed");
}

export interface UpdateEventInput {
  title?: string;
  date?: string;
  accessMode?: EventDoc["access"]["mode"];
  password?: string;
  guestUpload?: boolean;
  status?: Extract<EventStatus, "live" | "closed">;
}

export async function updateHostEvent(ownerId: ObjectId, eventId: ObjectId, input: UpdateEventInput): Promise<EventDoc> {
  const current = await getHostEvent(ownerId, eventId);
  if (current.status === "expired" && input.status !== undefined) {
    throw new HttpError(409, "event_expired", "This album has expired; upgrade the plan to reopen it");
  }
  const set: Record<string, unknown> = { updatedAt: new Date() };

  if (input.title !== undefined) set.title = input.title;
  if (input.date !== undefined) {
    const date = parseDay(input.date);
    set.date = date;
    set.expiresAt = expiryFor(date, planOf(current).tier);
  }
  if (input.guestUpload !== undefined) set["settings.guestUpload"] = input.guestUpload;
  if (input.status !== undefined) set.status = input.status;

  const mode = input.accessMode ?? current.access.mode;
  if (mode === "public") {
    if (current.access.mode !== "public") set.access = { mode: "public" };
  } else if (input.password) {
    set.access = { mode: "password", passwordHash: await hashPassword(input.password) };
  } else if (current.access.mode !== "password") {
    throw new HttpError(400, "password_required", "A password is required for password-protected events");
  }

  const { events } = await collections();
  const updated = await events.findOneAndUpdate({ _id: eventId, ownerId }, { $set: set }, { returnDocument: "after" });
  if (!updated) throw new HttpError(404, "event_not_found");
  return updated;
}
