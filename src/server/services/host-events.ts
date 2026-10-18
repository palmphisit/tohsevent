import { randomInt } from "node:crypto";
import { MongoServerError, ObjectId } from "mongodb";
import { collections } from "../db";
import { env } from "../env";
import { HttpError } from "../http";
import type { EventDoc, EventStatus } from "../models";
import { hashPassword } from "../password";

const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes (i/l/1, o/0)
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const DEFAULT_MAX_PHOTOS_PER_GUEST = 200;

export interface HostEvent {
  id: string;
  slug: string;
  title: string;
  date: string; // YYYY-MM-DD
  accessMode: EventDoc["access"]["mode"];
  guestUpload: boolean;
  status: EventStatus;
  counters: EventDoc["counters"];
  guestUrl: string;
  createdAt: string;
}

export function guestEventUrl(slug: string): string {
  return `${env().APP_ORIGIN}/e/${slug}`;
}

export function toHostEvent(event: EventDoc): HostEvent {
  return {
    id: event._id.toHexString(),
    slug: event.slug,
    title: event.title,
    date: event.date.toISOString().slice(0, 10),
    accessMode: event.access.mode,
    guestUpload: event.settings.guestUpload,
    status: event.status,
    counters: event.counters,
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

export async function listHostEvents(ownerId: ObjectId): Promise<HostEvent[]> {
  const { events } = await collections();
  const docs = await events.find({ ownerId }).sort({ date: -1, _id: -1 }).limit(200).toArray();
  return docs.map(toHostEvent);
}

export async function getHostEvent(ownerId: ObjectId, eventId: ObjectId): Promise<EventDoc> {
  const { events } = await collections();
  const event = await events.findOne({ _id: eventId, ownerId });
  if (!event) throw new HttpError(404, "event_not_found");
  return event;
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
  const base: Omit<EventDoc, "_id" | "slug"> = {
    ownerId,
    title: input.title,
    date: parseDay(input.date),
    access:
      input.accessMode === "password"
        ? { mode: "password", passwordHash: await hashPassword(input.password!) }
        : { mode: "public" },
    settings: { guestUpload: true, moderation: "post", maxPhotosPerGuest: DEFAULT_MAX_PHOTOS_PER_GUEST },
    status: "live",
    expiresAt: null,
    counters: { photos: 0, guests: 0 },
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
  const set: Record<string, unknown> = { updatedAt: new Date() };

  if (input.title !== undefined) set.title = input.title;
  if (input.date !== undefined) set.date = parseDay(input.date);
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
