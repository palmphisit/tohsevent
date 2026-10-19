import type { ObjectId } from "mongodb";
import { collections } from "../db";
import { HttpError } from "../http";
import { planOf, type EventDoc, type PhotoDoc } from "../models";
import {
  abortMultipart,
  completeMultipart,
  createMultipart,
  deleteOriginal,
  headOriginal,
  listParts,
  originalsBucket,
  presignOriginalDownload,
  presignPart,
} from "../originals-storage";
import type { EventRole } from "./host-events";
import { CUSTOM_PLAN } from "../../lib/custom-plan";
import { releaseQuota, reserveQuota } from "./photos";

// Full-resolution originals uploaded by the owner or invited photographers next to the
// display/thumb copies of an official photo. Multipart so large files survive flaky
// connections: the client can list the parts already stored and continue from there.

export const ORIGINAL_CONTENT_TYPES = ["image/jpeg", "image/png", "image/tiff", "image/heic", "image/webp"] as const;
export const ORIGINAL_LIMITS = {
  /** Per file on Premium; Custom allows up to CUSTOM_PLAN.maxFileBytes (also the schema's hard cap). */
  maxBytes: 200 * 1024 * 1024,
  hardMaxBytes: CUSTOM_PLAN.maxFileBytes,
  partSize: 16 * 1024 * 1024,
  maxSignPerRequest: 50,
} as const;

const EXTENSIONS: Record<(typeof ORIGINAL_CONTENT_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/tiff": "tif",
  "image/heic": "heic",
  "image/webp": "webp",
};

export function originalsAvailable(event: EventDoc): boolean {
  return !!originalsBucket() && planOf(event).originals;
}

interface Actor {
  id: ObjectId;
  role: EventRole;
}

/** Official photo the actor may attach an original to (owner: any; photographer: their own). */
async function requireOwnOfficialPhoto(event: EventDoc, actor: Actor, photoId: ObjectId): Promise<PhotoDoc> {
  const { photos } = await collections();
  const photo = await photos.findOne({
    _id: photoId,
    eventId: event._id,
    source: "official",
    status: { $in: ["pending", "ready", "hidden"] },
    ...(actor.role === "owner" ? {} : { "uploader.id": actor.id }),
  });
  if (!photo) throw new HttpError(404, "photo_not_found");
  return photo;
}

function partCount(bytes: number, partSize: number) {
  return Math.max(1, Math.ceil(bytes / partSize));
}

export async function startOriginalUpload(
  event: EventDoc,
  actor: Actor,
  photoId: ObjectId,
  input: { contentType: (typeof ORIGINAL_CONTENT_TYPES)[number]; bytes: number; filename: string },
): Promise<{ partSize: number; partCount: number; uploaded: { partNumber: number; etag: string }[] }> {
  if (!originalsAvailable(event)) {
    throw new HttpError(403, "originals_unavailable", "Original files need the Premium plan");
  }
  const photo = await requireOwnOfficialPhoto(event, actor, photoId);
  const { photos } = await collections();

  // Same file again (e.g. after a crash): keep the upload and report what is already stored.
  const existing = photo.original;
  if (existing?.status === "uploading" && existing.uploadId && existing.bytes === input.bytes) {
    const parts = await listParts(existing.key, existing.uploadId);
    return {
      partSize: existing.partSize,
      partCount: partCount(existing.bytes, existing.partSize),
      uploaded: parts.map(({ partNumber, etag }) => ({ partNumber, etag })),
    };
  }
  if (existing?.status === "ready") throw new HttpError(409, "original_exists", "This photo already has an original");
  const maxBytes = planOf(event).tier === "custom" ? CUSTOM_PLAN.maxFileBytes : ORIGINAL_LIMITS.maxBytes;
  if (input.bytes > maxBytes) throw new HttpError(413, "original_too_large", "The original file is too large for this plan");
  // The original's bytes count toward the album's storage (a replaced unfinished upload gives its share back).
  await reserveQuota(event, 0, input.bytes);
  if (existing) await releaseQuota(event._id, 0, existing.bytes);
  if (existing?.uploadId) await abortMultipart(existing.key, existing.uploadId).catch(() => {});

  const folder = photo.keys.display.split("/").slice(-2, -1)[0]; // <photoId>-<token>
  const key = `events/${event._id.toHexString()}/originals/${folder}/original.${EXTENSIONS[input.contentType]}`;
  const uploadId = await createMultipart(key, input.contentType);
  await photos.updateOne(
    { _id: photo._id },
    {
      $set: {
        original: {
          key,
          contentType: input.contentType,
          bytes: input.bytes,
          filename: input.filename.slice(0, 200),
          partSize: ORIGINAL_LIMITS.partSize,
          uploadId,
          status: "uploading",
          completedAt: null,
        },
      },
    },
  );
  return { partSize: ORIGINAL_LIMITS.partSize, partCount: partCount(input.bytes, ORIGINAL_LIMITS.partSize), uploaded: [] };
}

async function requireUploading(event: EventDoc, actor: Actor, photoId: ObjectId) {
  const photo = await requireOwnOfficialPhoto(event, actor, photoId);
  const original = photo.original;
  if (!original || original.status !== "uploading" || !original.uploadId) {
    throw new HttpError(409, "no_upload_in_progress", "Start the original upload first");
  }
  return { photo, original: { ...original, uploadId: original.uploadId } };
}

export async function signOriginalParts(event: EventDoc, actor: Actor, photoId: ObjectId, partNumbers: number[]) {
  const { original } = await requireUploading(event, actor, photoId);
  const total = partCount(original.bytes, original.partSize);
  if (partNumbers.some((n) => n < 1 || n > total)) throw new HttpError(400, "invalid_part", `Parts are 1–${total}`);
  return Promise.all(
    partNumbers.map(async (partNumber) => ({ partNumber, url: await presignPart(original.key, original.uploadId, partNumber) })),
  );
}

export async function completeOriginalUpload(
  event: EventDoc,
  actor: Actor,
  photoId: ObjectId,
  parts: { partNumber: number; etag: string }[],
) {
  const { photo, original } = await requireUploading(event, actor, photoId);
  const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
  if (sorted.length !== partCount(original.bytes, original.partSize)) {
    throw new HttpError(409, "upload_incomplete", "Some parts are missing");
  }
  await completeMultipart(original.key, original.uploadId, sorted);
  const head = await headOriginal(original.key);
  if (!head || head.size !== original.bytes) {
    throw new HttpError(409, "upload_mismatch", "The stored file does not match the declared size");
  }
  const { photos } = await collections();
  await photos.updateOne(
    { _id: photo._id },
    { $set: { "original.status": "ready", "original.uploadId": null, "original.completedAt": new Date() } },
  );
}

/** Short-lived link for the owner or a photographer of the event. */
export async function originalDownloadUrl(event: EventDoc, photoId: ObjectId): Promise<string> {
  const { photos } = await collections();
  const photo = await photos.findOne({ _id: photoId, eventId: event._id, "original.status": "ready" });
  if (!photo?.original) throw new HttpError(404, "original_not_found");
  return presignOriginalDownload(photo.original.key, photo.original.filename);
}

/** Removes the original (or cancels an unfinished upload); used when the photo is deleted. */
export async function removeOriginal(photo: Pick<PhotoDoc, "original">): Promise<void> {
  const original = photo.original;
  if (!original || !originalsBucket()) return;
  if (original.uploadId) await abortMultipart(original.key, original.uploadId).catch(() => {});
  await deleteOriginal(original.key).catch(() => {});
}
