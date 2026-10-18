import { randomBytes } from "node:crypto";
import { ObjectId, type Filter } from "mongodb";
import { collections } from "../db";
import { HttpError } from "../http";
import {
  planOf,
  type EventDoc,
  type PhotoDoc,
  type PhotoSource,
  type PhotoVariant,
  type UploadContentType,
  type VideoContentType,
} from "../models";
import { checkImage } from "../safe-search";
import { headObject, presignPut, publicUrl } from "../storage";
import { incrementEventCounter } from "./events";

const EXTENSIONS: Record<UploadContentType, string> = { "image/jpeg": "jpg", "image/webp": "webp" };

export interface UploadRequestFile {
  contentType: UploadContentType;
  bytes: PhotoDoc["bytes"];
  width: number;
  height: number;
  takenAt?: string;
  /** Video item: the clip itself; display/thumb are its poster frames. */
  video?: { contentType: VideoContentType; bytes: number; durationSec: number };
}

const VIDEO_EXTENSIONS: Record<VideoContentType, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };

interface UploadTarget {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
}

export interface PresignedUpload {
  photoId: string;
  uploads: { display: UploadTarget; thumb: UploadTarget; watermarked?: UploadTarget; video?: UploadTarget };
}

/**
 * Photo folders carry a random token next to the id. ObjectIds are close to sequential,
 * so without it anyone holding one photo URL of a password-protected event could guess
 * the URLs of the others on the public CDN.
 */
function photoKey(eventId: ObjectId, folder: string, name: string, contentType: UploadContentType) {
  return `events/${eventId.toHexString()}/photos/${folder}/${name}.${EXTENSIONS[contentType]}`;
}

/** Variants a photo was uploaded with (always display + thumb, plus watermarked on Free events and the clip for videos). */
function variantsOf(photo: Pick<PhotoDoc, "keys">): PhotoVariant[] {
  const variants: PhotoVariant[] = ["display", "thumb"];
  if (photo.keys.watermarked) variants.push("watermarked");
  if (photo.keys.video) variants.push("video");
  return variants;
}

/** The clip has its own content type; every image variant shares the photo's. */
function contentTypeOf(photo: Pick<PhotoDoc, "contentType" | "video">, variant: PhotoVariant): string {
  return variant === "video" && photo.video ? photo.video.contentType : photo.contentType;
}

type Uploader = PhotoDoc["uploader"];

/**
 * Takes `count` photo slots from the event's plan allowance (all stored photos, guest and
 * official). Atomic, so parallel uploads cannot overshoot `maxPhotos`.
 */
async function reservePhotoQuota(event: EventDoc, count: number): Promise<void> {
  const { events, photos } = await collections();
  if (event.usage === undefined) {
    // Events created before usage tracking: backfill the counter once.
    const used = await photos.countDocuments({ eventId: event._id, status: { $in: ["pending", "ready", "hidden"] } });
    await events.updateOne({ _id: event._id, usage: { $exists: false } }, { $set: { usage: { photos: used } } });
  }
  const reserved = await events.findOneAndUpdate(
    { _id: event._id, "usage.photos": { $lte: planOf(event).maxPhotos - count } },
    { $inc: { "usage.photos": count } },
  );
  if (!reserved) throw new HttpError(403, "photo_limit_reached", "This album has reached its photo limit");
}

/** Gives photo slots back (deleted photos, abandoned uploads). */
export async function releasePhotoQuota(eventId: ObjectId, count: number): Promise<void> {
  const { events } = await collections();
  await events.updateOne({ _id: eventId, "usage.photos": { $gte: count } }, { $inc: { "usage.photos": -count } });
}

/** Plan rules on the requested files; runs before any quota is reserved. */
function assertFilesAllowed(event: EventDoc, files: UploadRequestFile[]): void {
  const videoLimits = planOf(event).video;
  for (const file of files) {
    if (!file.video) continue;
    if (!videoLimits) throw new HttpError(403, "video_not_allowed", "This event's plan does not include videos");
    if (file.video.bytes > videoLimits.maxBytes) throw new HttpError(413, "video_too_large", "The video file is too large");
    if (file.video.durationSec > videoLimits.maxDurationSec + 1) {
      throw new HttpError(400, "video_too_long", "The video is longer than this plan allows");
    }
  }

  if (planOf(event).watermark && files.some((file) => !file.bytes.watermarked)) {
    throw new HttpError(400, "watermark_required", "Photos for this event must include the watermarked variant");
  }
}

/** Inserts `pending` photo docs and returns presigned PUT URLs for every variant. */
async function createPendingPhotos(
  event: EventDoc,
  source: PhotoSource,
  uploader: Uploader,
  files: UploadRequestFile[],
): Promise<PresignedUpload[]> {
  const watermark = planOf(event).watermark;
  const { photos } = await collections();
  const now = new Date();
  const docs: PhotoDoc[] = files.map((file) => {
    const _id = new ObjectId();
    const folder = `${_id.toHexString()}-${randomBytes(8).toString("hex")}`;
    const key = (name: string) => photoKey(event._id, folder, name, file.contentType);
    const clip = file.video;
    const doc: PhotoDoc = {
      _id,
      eventId: event._id,
      source,
      uploader,
      // Guests only ever get the watermarked URL, so the clean file sits behind a random name.
      keys: watermark
        ? { display: key(`display-${randomBytes(12).toString("hex")}`), thumb: key("thumb"), watermarked: key("watermarked") }
        : { display: key("display"), thumb: key("thumb") },
      contentType: file.contentType,
      bytes: watermark
        ? { display: file.bytes.display, thumb: file.bytes.thumb, watermarked: file.bytes.watermarked }
        : { display: file.bytes.display, thumb: file.bytes.thumb },
      width: file.width,
      height: file.height,
      takenAt: file.takenAt ? new Date(file.takenAt) : null,
      status: "pending",
      openReports: 0,
      createdAt: now,
      completedAt: null,
    };
    if (clip) {
      doc.kind = "video";
      doc.video = { contentType: clip.contentType, durationSec: clip.durationSec };
      doc.keys.video = `events/${event._id.toHexString()}/photos/${folder}/video.${VIDEO_EXTENSIONS[clip.contentType]}`;
      doc.bytes.video = clip.bytes;
    }
    return doc;
  });
  await photos.insertMany(docs);

  return Promise.all(
    docs.map(async (doc) => {
      const presign = async (variant: PhotoVariant): Promise<UploadTarget> => ({
        url: await presignPut(doc.keys[variant]!, contentTypeOf(doc, variant), doc.bytes[variant]!),
        method: "PUT",
        headers: { "Content-Type": contentTypeOf(doc, variant) },
      });
      const [display, thumb, watermarked, video] = await Promise.all([
        presign("display"),
        presign("thumb"),
        doc.keys.watermarked ? presign("watermarked") : undefined,
        doc.keys.video ? presign("video") : undefined,
      ]);
      return {
        photoId: doc._id.toHexString(),
        uploads: { display, thumb, ...(watermarked ? { watermarked } : {}), ...(video ? { video } : {}) },
      };
    }),
  );
}

/**
 * Step 1 of the guest upload flow: reserve quota, create `pending` photo docs and return
 * presigned PUT URLs. The browser then uploads both variants directly to R2.
 */
export async function createGuestUploads(
  event: EventDoc,
  guestSessionId: ObjectId,
  files: UploadRequestFile[],
): Promise<PresignedUpload[]> {
  if (!event.settings.guestUpload) throw new HttpError(403, "uploads_disabled", "Uploads are closed for this event");
  assertFilesAllowed(event, files);

  const { guestSessions } = await collections();
  await reservePhotoQuota(event, files.length);

  // Atomic quota reservation: only succeeds if the guest still has room for all files.
  const session = await guestSessions.findOneAndUpdate(
    {
      _id: guestSessionId,
      eventId: event._id,
      uploadCount: { $lte: event.settings.maxPhotosPerGuest - files.length },
    },
    { $inc: { uploadCount: files.length } },
    { returnDocument: "after" },
  );
  if (!session) {
    await releasePhotoQuota(event._id, files.length);
    throw new HttpError(429, "quota_exceeded", `Each guest can upload up to ${event.settings.maxPhotosPerGuest} photos`);
  }

  return createPendingPhotos(event, "guest", { type: "guest", id: session._id, displayName: session.displayName }, files);
}

/** Official photos uploaded by the host (no per-guest quota; works even when guest uploads are closed). */
export async function createOfficialUploads(
  event: EventDoc,
  host: { id: ObjectId; name: string },
  files: UploadRequestFile[],
): Promise<PresignedUpload[]> {
  assertFilesAllowed(event, files);
  await reservePhotoQuota(event, files.length);
  return createPendingPhotos(event, "official", { type: "user", id: host.id, displayName: host.name }, files);
}

/**
 * Step 3: verify both objects really exist in R2 with the declared size/type,
 * then flip the photo to `ready`. Only the original uploader may complete it.
 * Idempotent for retries.
 */
export async function completeUpload(event: EventDoc, uploaderId: ObjectId, photoId: ObjectId) {
  const { photos } = await collections();
  const photo = await photos.findOne({ _id: photoId, eventId: event._id, "uploader.id": uploaderId });
  if (!photo) throw new HttpError(404, "photo_not_found");
  if (photo.status !== "pending") return toPublicPhoto(photo, event, { viewerId: uploaderId });

  const variants = variantsOf(photo);
  const heads = await Promise.all(variants.map((variant) => headObject(photo.keys[variant]!)));
  variants.forEach((variant, i) => {
    const head = heads[i];
    if (!head) throw new HttpError(409, "upload_incomplete", `The ${variant} file has not been uploaded yet`);
    if (head.ContentLength !== photo.bytes[variant] || head.ContentType !== contentTypeOf(photo, variant)) {
      throw new HttpError(409, "upload_mismatch", `The ${variant} file does not match the declared size or type`);
    }
  });

  // AI pre-moderation (when enabled): flagged photos start hidden for the host to review.
  const verdict = await checkImage(publicUrl(photo.keys.thumb));
  const updated = await photos.findOneAndUpdate(
    { _id: photo._id, status: "pending" },
    {
      $set: {
        status: verdict?.flagged ? "hidden" : "ready",
        completedAt: new Date(),
        ...(verdict ? { autoModeration: { ...verdict, at: new Date() } } : {}),
      },
    },
    { returnDocument: "after" },
  );
  if (updated?.status === "ready") await incrementEventCounter(event._id, "photos");
  return toPublicPhoto(updated ?? photo, event, { viewerId: uploaderId });
}

export interface PublicPhoto {
  id: string;
  source: PhotoSource;
  uploaderName: string | null;
  thumbUrl: string;
  displayUrl: string;
  width: number;
  height: number;
  createdAt: string;
  /** True when the requesting guest uploaded this photo (they may delete it). */
  mine?: boolean;
  /** Set on upload completion when auto moderation held the photo back for host review. */
  pendingReview?: boolean;
  kind: "photo" | "video";
  /** Video items only: the clip (thumb/display URLs are its poster frames). */
  videoUrl?: string;
  durationSec?: number;
}

/**
 * Guest-facing shape. While the event is on a watermarked plan, guests get the watermarked
 * copy; after an upgrade the same photos switch to the clean file. Hosts always see clean
 * files (pass `{ clean: true }`).
 */
export function toPublicPhoto(
  photo: PhotoDoc,
  event: Pick<EventDoc, "plan">,
  options: { clean?: boolean; viewerId?: ObjectId } = {},
): PublicPhoto {
  const showWatermarked = !options.clean && planOf(event).watermark && !!photo.keys.watermarked;
  return {
    id: photo._id.toHexString(),
    source: photo.source,
    uploaderName: photo.uploader.displayName,
    thumbUrl: publicUrl(photo.keys.thumb),
    displayUrl: publicUrl(showWatermarked ? photo.keys.watermarked! : photo.keys.display),
    width: photo.width,
    height: photo.height,
    createdAt: photo.createdAt.toISOString(),
    kind: photo.kind ?? "photo",
    ...(photo.keys.video && photo.video
      ? { videoUrl: publicUrl(photo.keys.video), durationSec: Math.round(photo.video.durationSec) }
      : {}),
    ...(options.viewerId?.equals(photo.uploader.id) ? { mine: true } : {}),
    ...(photo.status === "hidden" && photo.autoModeration?.flagged ? { pendingReview: true } : {}),
  };
}

export async function listEventPhotos(
  event: EventDoc,
  options: { source: PhotoSource; cursor?: ObjectId; limit: number; viewerId?: ObjectId },
): Promise<{ items: PublicPhoto[]; nextCursor: string | null }> {
  const { photos } = await collections();
  const filter: Filter<PhotoDoc> = { eventId: event._id, source: options.source, status: "ready" };
  if (options.cursor) filter._id = { $lt: options.cursor };

  const docs = await photos
    .find(filter)
    .sort({ _id: -1 })
    .limit(options.limit + 1)
    .toArray();
  const hasMore = docs.length > options.limit;
  const page = hasMore ? docs.slice(0, options.limit) : docs;
  return {
    items: page.map((photo) => toPublicPhoto(photo, event, { viewerId: options.viewerId })),
    nextCursor: hasMore ? page[page.length - 1]._id.toHexString() : null,
  };
}
