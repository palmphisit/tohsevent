import type { ObjectId } from "mongodb";
import { collections } from "../db";
import { HttpError } from "../http";
import type { EventDoc } from "../models";

/** Shape of an event that is safe to send to guests. */
export interface PublicEvent {
  id: string;
  slug: string;
  title: string;
  date: string;
  accessMode: EventDoc["access"]["mode"];
  guestUpload: boolean;
}

export function toPublicEvent(event: EventDoc): PublicEvent {
  return {
    id: event._id.toHexString(),
    slug: event.slug,
    title: event.title,
    date: event.date.toISOString(),
    accessMode: event.access.mode,
    guestUpload: event.settings.guestUpload,
  };
}

function isOpen(event: EventDoc, now = new Date()): boolean {
  return event.status === "live" && (!event.expiresAt || event.expiresAt > now);
}

export async function findOpenEventBySlug(slug: string): Promise<EventDoc | null> {
  const { events } = await collections();
  const event = await events.findOne({ slug: slug.toLowerCase() });
  return event && isOpen(event) ? event : null;
}

export async function requireOpenEventBySlug(slug: string): Promise<EventDoc> {
  const event = await findOpenEventBySlug(slug);
  if (!event) throw new HttpError(404, "event_not_found", "Event not found or no longer available");
  return event;
}

export async function incrementEventCounter(eventId: ObjectId, field: keyof EventDoc["counters"], by = 1) {
  const { events } = await collections();
  await events.updateOne({ _id: eventId }, { $inc: { [`counters.${field}`]: by }, $set: { updatedAt: new Date() } });
}
