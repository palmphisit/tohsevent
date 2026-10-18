import { ObjectId, type Filter } from "mongodb";
import { collections } from "../db";
import { HttpError } from "../http";
import {
  type EventDoc,
  type PhotoDoc,
  type PhotoSource,
  type PhotoVariant,
  type UploadContentType,
} from "../models";
import { headObject, presignPut, publicUrl } from "../storage";
import { incrementEventCounter } from "./events";

const VARIANTS: PhotoVariant[] = ["display", "thumb"];
const EXTENSIONS: Record<UploadContentType, string> = { "image/jpeg": "jpg", "image/webp": "webp" };

export interface UploadRequestFile {
  contentType: UploadContentType;
  bytes: Record<PhotoVariant, number>;
  width: number;
  height: number;
  takenAt?: string;
}

export interface PresignedUpload {
  photoId: string;
  uploads: Record<PhotoVariant, { url: string; method: "PUT"; headers: Record<string, string> }>;
}

function photoKey(eventId: ObjectId, photoId: ObjectId, variant: PhotoVariant, contentType: UploadContentType) {
  return `events/${eventId.toHexString()}/photos/${photoId.toHexString()}/${variant}.${EXTENSIONS[contentType]}`;
}

type Uploader = PhotoDoc["uploader"];

/** Inserts `pending` photo docs and returns presigned PUT URLs for every variant. */
async function createPendingPhotos(
  event: EventDoc,
  source: PhotoSource,
  uploader: Uploader,
  files: UploadRequestFile[],
): Promise<PresignedUpload[]> {
  const { photos } = await collections();
  const now = new Date();
  const docs: PhotoDoc[] = files.map((file) => {
    const _id = new ObjectId();
    return {
      _id,
      eventId: event._id,
      source,
      uploader,
      keys: {
        display: photoKey(event._id, _id, "display", file.contentType),
        thumb: photoKey(event._id, _id, "thumb", file.contentType),
      },
      contentType: file.contentType,
      bytes: file.bytes,
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
      const presign = async (variant: PhotoVariant) => ({
        url: await presignPut(doc.keys[variant], doc.contentType, doc.bytes[variant]),
        method: "PUT" as const,
        headers: { "Content-Type": doc.contentType },
      });
      const [display, thumb] = await Promise.all([presign("display"), presign("thumb")]);
      return { photoId: doc._id.toHexString(), uploads: { display, thumb } };
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
    throw new HttpError(429, "quota_exceeded", `Each guest can upload up to ${event.settings.maxPhotosPerGuest} photos`);
  }

  return createPendingPhotos(event, "guest", { type: "guest", id: session._id, displayName: session.displayName }, files);
}

/** Official photos uploaded by the host (no quota; works even when guest uploads are closed). */
export function createOfficialUploads(
  event: EventDoc,
  host: { id: ObjectId; name: string },
  files: UploadRequestFile[],
): Promise<PresignedUpload[]> {
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
  if (photo.status !== "pending") return toPublicPhoto(photo);

  const heads = await Promise.all(VARIANTS.map((variant) => headObject(photo.keys[variant])));
  VARIANTS.forEach((variant, i) => {
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
  return toPublicPhoto(updated ?? photo);
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

export function toPublicPhoto(photo: PhotoDoc): PublicPhoto {
  return {
    id: photo._id.toHexString(),
    source: photo.source,
    uploaderName: photo.uploader.displayName,
    thumbUrl: publicUrl(photo.keys.thumb),
    displayUrl: publicUrl(photo.keys.display),
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
    items: page.map(toPublicPhoto),
    nextCursor: hasMore ? page[page.length - 1]._id.toHexString() : null,
  };
}
