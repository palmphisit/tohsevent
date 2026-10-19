import { createHmac, timingSafeEqual } from "node:crypto";
import type { Filter, ObjectId } from "mongodb";
import { collections } from "../db";
import { env } from "../env";
import { ALBUM_ONLY, type EventDoc, type PhotoDoc, type SlideshowDoc } from "../models";
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
  const filter: Filter<PhotoDoc> = { eventId: event._id, status: "ready", ...ALBUM_ONLY };
  if (options.sources !== "all") filter.source = options.sources;
  const [docs, total] = await Promise.all([
    photos.find(filter).sort({ _id: -1 }).limit(options.limit).toArray(),
    photos.countDocuments(filter),
  ]);
  return { items: (await repairListedPosters(docs)).map((doc) => toPublicPhoto(doc, event)), total };
}

// ---------------------------------------------------------------------------
// Instagram share (see instagram-share.ts): the venue screen pops each send up once in the middle.

/** How far back a screen looks for sends (covers a queue of popups and photos approved a bit later). */
const SHOUTOUT_WINDOW_MS = 10 * 60 * 1000;

export interface Shoutout {
  photo: PublicPhoto;
  instagram: string;
  at: string;
}

/** Recent sends, oldest first (the screen shows them in this order). Off = none. */
export async function listShoutouts(event: EventDoc, now = new Date()): Promise<Shoutout[]> {
  if (!slideshowSettings(event).igShare) return [];
  const { photos } = await collections();
  const docs = await photos
    .find({ eventId: event._id, purpose: "instagram", status: "ready", "shoutout.at": { $gt: new Date(now.getTime() - SHOUTOUT_WINDOW_MS) } })
    .sort({ "shoutout.at": 1 })
    .limit(30)
    .toArray();
  return docs.map((doc) => ({
    photo: toPublicPhoto(doc, event),
    instagram: doc.shoutout!.instagram,
    at: doc.shoutout!.at.toISOString(),
  }));
}

export interface InstagramShareItem {
  id: string;
  instagram: string;
  /** When it was sent to the screen (upload completed). */
  at: string;
  /** "hidden": held by moderation (or hidden by the host), so it did not pop up. */
  status: "ready" | "hidden";
  photo: PublicPhoto;
}

/** Host-only history of Instagram shares, newest first. */
export async function listInstagramShares(
  event: EventDoc,
  options: { cursor?: ObjectId; limit: number },
): Promise<{ items: InstagramShareItem[]; nextCursor: string | null; total: number }> {
  const { photos } = await collections();
  const base: Filter<PhotoDoc> = { eventId: event._id, purpose: "instagram", status: { $in: ["ready", "hidden"] } };
  const [docs, total] = await Promise.all([
    photos
      .find(options.cursor ? { ...base, _id: { $lt: options.cursor } } : base)
      .sort({ _id: -1 })
      .limit(options.limit + 1)
      .toArray(),
    photos.countDocuments(base),
  ]);
  const hasMore = docs.length > options.limit;
  const page = hasMore ? docs.slice(0, options.limit) : docs;
  return {
    items: page.map((doc) => ({
      id: doc._id.toHexString(),
      instagram: doc.shoutout?.instagram ?? "",
      at: (doc.shoutout?.at ?? doc.createdAt).toISOString(),
      status: doc.status === "hidden" ? "hidden" : "ready",
      photo: toPublicPhoto(doc, event, { clean: true }),
    })),
    nextCursor: hasMore ? page[page.length - 1]._id.toHexString() : null,
    total,
  };
}
