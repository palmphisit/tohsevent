import type { ObjectId } from "mongodb";
import { collections } from "../db";
import { HttpError } from "../http";
import { planOf, type EventDoc } from "../models";
import { emailEnabled } from "../email";
import { appearanceOf, type Appearance } from "./appearance";
import { eventInfoOf, hasEventInfo } from "./event-info";
import { toPublicBranding, type PublicBranding } from "./branding";

/** Shape of an event that is safe to send to guests. */
export interface PublicEvent {
  id: string;
  slug: string;
  title: string;
  date: string;
  accessMode: EventDoc["access"]["mode"];
  guestUpload: boolean;
  /** Free plan: guests' uploads must include a watermarked copy (see lib/image.ts). */
  watermark: boolean;
  /** Premium custom look; null means the default Tohs Event style. */
  branding: PublicBranding | null;
  /** Guests can ask for an email when official photos are ready. */
  notifyAvailable: boolean;
  /** The event has details (schedule, venue, map) or open registration: link to /e/<slug>/info. */
  hasInfo: boolean;
  /** Theme, header and gallery style chosen by the host (every plan). */
  appearance: Appearance;
  /** Video clip limits on this plan; null when only photos are allowed. */
  video: { maxBytes: number; maxDurationSec: number } | null;
}

export function toPublicEvent(event: EventDoc): PublicEvent {
  return {
    id: event._id.toHexString(),
    slug: event.slug,
    title: event.title,
    date: event.date.toISOString(),
    accessMode: event.access.mode,
    guestUpload: event.settings.guestUpload,
    watermark: planOf(event).watermark,
    branding: toPublicBranding(event),
    notifyAvailable: emailEnabled(),
    video: planOf(event).video,
    appearance: appearanceOf(event),
    hasInfo: hasEventInfo(eventInfoOf(event)) || !!event.registration?.enabled,
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
