import { createHmac, timingSafeEqual } from "node:crypto";
import type { Filter } from "mongodb";
import { collections } from "../db";
import { env } from "../env";
import type { EventDoc, PhotoDoc, SlideshowDoc } from "../models";
import { toPublicPhoto, type PublicPhoto } from "./photos";
import { repairListedPosters } from "./video-posters";

// Big-screen slideshow for the venue (TV / projector): photos flow in as guests upload,
// next to a QR code and event details the host can customize. Public events are open to
// anyone; password events need the host's signed link (or a guest session).

export const SLIDESHOW_LIMITS = { headlineMax: 80, messageMax: 200, qrCaptionMax: 60, intervalMin: 4, intervalMax: 20 } as const;

export type SlideshowSettings = Omit<SlideshowDoc, "updatedAt">;

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

export function slideshowUrl(event: Pick<EventDoc, "_id" | "slug">): string {
  return `${env().APP_ORIGIN}/e/${event.slug}/slideshow?key=${slideshowKey(event)}`;
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
