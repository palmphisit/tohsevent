import { createHmac, timingSafeEqual } from "node:crypto";
import type { Filter, ObjectId } from "mongodb";
import { collections } from "../db";
import { env } from "../env";
import { HttpError } from "../http";
import type { EventDoc, PhotoDoc, SlideshowDoc } from "../models";
import { guestEventUrl } from "./host-events";
import { toPublicPhoto, type PublicPhoto } from "./photos";
import { repairListedPosters } from "./video-posters";

// Big-screen slideshow for the venue (TV / projector): photos flow in as guests upload,
// next to a QR code and event details the host can customize. Public events are open to
// anyone; password events need the host's signed link (or a guest session).

export const SLIDESHOW_LIMITS = {
  headlineMax: 80,
  messageMax: 200,
  qrCaptionMax: 60,
  intervalMin: 4,
  intervalMax: 20,
  igPopupMin: 3,
  igPopupMax: 30,
} as const;

export type SlideshowSettings = Omit<SlideshowDoc, "updatedAt" | "igShare" | "igPopupSec"> & { igShare: boolean; igPopupSec: number };

export const DEFAULT_SLIDESHOW: SlideshowSettings = {
  layout: "spotlight",
  theme: "dark",
  sources: "all",
  headline: null,
  message: null,
  qrCaption: null,
  showQr: true,
  showDate: true,
  showUploader: true,
  panelSide: "right",
  qrSize: "medium",
  intervalSec: 7,
  igShare: false,
  igPopupSec: 8,
};

export function slideshowSettings(event: Pick<EventDoc, "slideshow">): SlideshowSettings {
  const saved: Partial<SlideshowDoc> = { ...event.slideshow };
  delete saved.updatedAt;
  return { ...DEFAULT_SLIDESHOW, ...saved };
}

export async function saveSlideshow(event: EventDoc, input: SlideshowSettings): Promise<SlideshowSettings> {
  const doc: SlideshowDoc = {
    ...input,
    headline: input.headline?.trim() || null,
    message: input.message?.trim() || null,
    qrCaption: input.qrCaption?.trim() || null,
    updatedAt: new Date(),
  };
  const { events } = await collections();
  await events.updateOne({ _id: event._id }, { $set: { slideshow: doc, updatedAt: doc.updatedAt } });
  return slideshowSettings({ slideshow: doc });
}

/** Signed per-event key for the slideshow link (lets a venue screen open password events). */
export function slideshowKey(event: Pick<EventDoc, "_id">): string {
  return createHmac("sha256", env().SESSION_SECRET)
    .update(`slideshow:${event._id.toHexString()}`)
    .digest("base64url")
    .slice(0, 22);
}

export function verifySlideshowKey(event: Pick<EventDoc, "_id">, key: string | null | undefined): boolean {
  if (!key) return false;
  const expected = Buffer.from(slideshowKey(event));
  const given = Buffer.from(key);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function slideshowUrl(event: Pick<EventDoc, "_id" | "slug" | "language">): string {
  return guestEventUrl(event, `/slideshow?key=${slideshowKey(event)}`);
}

/** Newest visible photos and videos (guest-facing URLs: watermarked on Free events). */
export async function listSlideshowPhotos(
  event: EventDoc,
  options: { sources: SlideshowSettings["sources"]; limit: number },
): Promise<{ items: PublicPhoto[]; total: number }> {
  const { photos } = await collections();
  const filter: Filter<PhotoDoc> = { eventId: event._id, status: "ready" };
  if (options.sources !== "all") filter.source = options.sources;
  const [docs, total] = await Promise.all([
    photos.find(filter).sort({ _id: -1 }).limit(options.limit).toArray(),
    photos.countDocuments(filter),
  ]);
  return { items: (await repairListedPosters(docs)).map((doc) => toPublicPhoto(doc, event)), total };
}

// ---------------------------------------------------------------------------
// Instagram share: a guest sends one of their own photos with their @handle, and the venue
// screen pops it up in the middle for a few seconds.

/** Instagram usernames: letters, digits, "." and "_", up to 30 characters. */
export const INSTAGRAM_HANDLE = /^(?!.*\.\.)(?!\.)[A-Za-z0-9._]{1,30}(?<!\.)$/;
/** One send per guest per this many seconds, so a queue of popups stays fair. */
export const SHOUTOUT_COOLDOWN_SEC = 30;
/** How far back a screen looks for sends (a reloaded screen does not replay older ones). */
const SHOUTOUT_WINDOW_MS = 10 * 60 * 1000;

export interface Shoutout {
  photo: PublicPhoto;
  instagram: string;
  at: string;
}

export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, "").replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");
}

/** Recent sends, oldest first (the screen shows them in this order). Off = none. */
export async function listShoutouts(event: EventDoc, now = new Date()): Promise<Shoutout[]> {
  if (!slideshowSettings(event).igShare) return [];
  const { photos } = await collections();
  const docs = await photos
    .find({ eventId: event._id, status: "ready", "shoutout.at": { $gt: new Date(now.getTime() - SHOUTOUT_WINDOW_MS) } })
    .sort({ "shoutout.at": 1 })
    .limit(30)
    .toArray();
  return docs.map((doc) => ({
    photo: toPublicPhoto(doc, event),
    instagram: doc.shoutout!.instagram,
    at: doc.shoutout!.at.toISOString(),
  }));
}

/** The guest's own photos they can send (newest first). */
export async function shareablePhotos(event: EventDoc, guestId: ObjectId): Promise<PublicPhoto[]> {
  const { photos } = await collections();
  const docs = await photos
    .find({ eventId: event._id, status: "ready", "uploader.id": guestId })
    .sort({ _id: -1 })
    .limit(60)
    .toArray();
  return docs.map((doc) => toPublicPhoto(doc, event, { viewerId: guestId }));
}

export async function sendShoutout(
  event: EventDoc,
  guestId: ObjectId,
  photoId: ObjectId,
  handle: string,
  now = new Date(),
): Promise<{ instagram: string }> {
  if (!slideshowSettings(event).igShare) throw new HttpError(403, "ig_share_off", "Instagram share is not open for this event");
  const instagram = normalizeHandle(handle);
  if (!INSTAGRAM_HANDLE.test(instagram)) throw new HttpError(400, "invalid_instagram", "Enter a valid Instagram username");
  const { photos } = await collections();
  const recent = await photos.findOne({
    eventId: event._id,
    "uploader.id": guestId,
    "shoutout.at": { $gt: new Date(now.getTime() - SHOUTOUT_COOLDOWN_SEC * 1000) },
  });
  if (recent) throw new HttpError(429, "ig_share_cooldown", "Please wait a moment before sharing again");
  const result = await photos.updateOne(
    { _id: photoId, eventId: event._id, status: "ready", "uploader.id": guestId },
    { $set: { shoutout: { instagram, at: now } } },
  );
  if (result.matchedCount === 0) throw new HttpError(404, "photo_not_found", "Photo not found");
  return { instagram };
}
