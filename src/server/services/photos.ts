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
} from "../models";
import { headObject, presignPut, publicUrl } from "../storage";
import { incrementEventCounter } from "./events";

const EXTENSIONS: Record<UploadContentType, string> = { "image/jpeg": "jpg", "image/webp": "webp" };

export interface UploadRequestFile {
  contentType: UploadContentType;
  bytes: PhotoDoc["bytes"];
  width: number;
  height: number;
  takenAt?: string;
}

interface UploadTarget {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
}

export interface PresignedUpload {
  photoId: string;
  uploads: { display: UploadTarget; thumb: UploadTarget; watermarked?: UploadTarget };
}

function photoKey(eventId: ObjectId, photoId: ObjectId, name: string, contentType: UploadContentType) {
  return `events/${eventId.toHexString()}/photos/${photoId.toHexString()}/${name}.${EXTENSIONS[contentType]}`;
}

/** Variants a photo was uploaded with (always display + thumb, plus watermarked on Free events). */
function variantsOf(photo: Pick<PhotoDoc, "keys">): PhotoVariant[] {
  return photo.keys.watermarked ? ["display", "thumb", "watermarked"] : ["display", "thumb"];
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

/** Inserts `pending` photo docs and returns presigned PUT URLs for every variant. */
async function createPendingPhotos(
  event: EventDoc,
  source: PhotoSource,
  uploader: Uploader,
  files: UploadRequestFile[],
): Promise<PresignedUpload[]> {
  const watermark = planOf(event).watermark;
  if (watermark && files.some((file) => !file.bytes.watermarked)) {
    throw new HttpError(400, "watermark_required", "Photos for this event must include the watermarked variant");
  }

  const { photos } = await collections();
  const now = new Date();
  const docs: PhotoDoc[] = files.map((file) => {
    const _id = new ObjectId();
    const key = (name: string) => photoKey(event._id, _id, name, file.contentType);
    return {
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
  });
  await photos.insertMany(docs);

  return Promise.all(
    docs.map(async (doc) => {
      const presign = async (variant: PhotoVariant): Promise<UploadTarget> => ({
        url: await presignPut(doc.keys[variant]!, doc.contentType, doc.bytes[variant]!),
        method: "PUT",
        headers: { "Content-Type": doc.contentType },
      });
      const [display, thumb, watermarked] = await Promise.all([
        presign("display"),
        presign("thumb"),
        doc.keys.watermarked ? presign("watermarked") : undefined,
      ]);
      return { photoId: doc._id.toHexString(), uploads: { display, thumb, ...(watermarked ? { watermarked } : {}) } };
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
  if (photo.status !== "pending") return toPublicPhoto(photo, event);

  const variants = variantsOf(photo);
  const heads = await Promise.all(variants.map((variant) => headObject(photo.keys[variant]!)));
  variants.forEach((variant, i) => {
    const head = heads[i];
    if (!head) throw new HttpError(409, "upload_incomplete", `The ${variant} file has not been uploaded yet`);
    if (head.ContentLength !== photo.bytes[variant] || head.ContentType !== photo.contentType) {
      throw new HttpError(409, "upload_mismatch", `The ${variant} file does not match the declared size or type`);
    }
  });

  const updated = await photos.findOneAndUpdate(
    { _id: photo._id, status: "pending" },
    { $set: { status: "ready", completedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (updated) await incrementEventCounter(event._id, "photos");
  return toPublicPhoto(updated ?? photo, event);
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
}

/**
 * Guest-facing shape. While the event is on a watermarked plan, guests get the watermarked
 * copy; after an upgrade the same photos switch to the clean file. Hosts always see clean
 * files (pass `{ clean: true }`).
 */
export function toPublicPhoto(photo: PhotoDoc, event: Pick<EventDoc, "plan">, options: { clean?: boolean } = {}): PublicPhoto {
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
  };
}

export async function listEventPhotos(
  event: EventDoc,
  options: { source: PhotoSource; cursor?: ObjectId; limit: number },
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
    items: page.map((photo) => toPublicPhoto(photo, event)),
    nextCursor: hasMore ? page[page.length - 1]._id.toHexString() : null,
  };
}
