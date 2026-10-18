import { MongoServerError, ObjectId, type Filter } from "mongodb";
import { collections } from "../db";
import { HttpError } from "../http";
import type { EventDoc, PhotoDoc, ReportDoc, ReportReason } from "../models";
import { deleteObjects } from "../storage";
import { incrementEventCounter } from "./events";
import { releasePhotoQuota, toPublicPhoto, type PublicPhoto } from "./photos";

// Host-side moderation (hide / delete / review reports) and guest reports.
// `counters.photos` tracks photos guests can see, so it moves with visibility.

export const HOST_PHOTO_VIEWS = ["guest", "official", "reported"] as const;
export type HostPhotoView = (typeof HOST_PHOTO_VIEWS)[number];

export interface HostPhoto extends PublicPhoto {
  status: "ready" | "hidden";
  openReports: number;
}

function toHostPhoto(photo: PhotoDoc): HostPhoto {
  return {
    ...toPublicPhoto(photo),
    status: photo.status === "hidden" ? "hidden" : "ready",
    openReports: photo.openReports ?? 0,
  };
}

export async function listHostPhotos(
  event: EventDoc,
  options: { view: HostPhotoView; cursor?: ObjectId; limit: number },
): Promise<{ items: HostPhoto[]; nextCursor: string | null }> {
  const { photos } = await collections();
  const filter: Filter<PhotoDoc> =
    options.view === "reported"
      ? { eventId: event._id, openReports: { $gt: 0 }, status: { $in: ["ready", "hidden"] } }
      : { eventId: event._id, source: options.view, status: { $in: ["ready", "hidden"] } };
  if (options.cursor) filter._id = { $lt: options.cursor };

  const docs = await photos
    .find(filter)
    .sort({ _id: -1 })
    .limit(options.limit + 1)
    .toArray();
  const hasMore = docs.length > options.limit;
  const page = hasMore ? docs.slice(0, options.limit) : docs;
  return { items: page.map(toHostPhoto), nextCursor: hasMore ? page[page.length - 1]._id.toHexString() : null };
}

async function closeReports(photoId: ObjectId, status: Exclude<ReportDoc["status"], "open">) {
  const { photos, reports } = await collections();
  await reports.updateMany({ photoId, status: "open" }, { $set: { status, resolvedAt: new Date() } });
  await photos.updateOne({ _id: photoId }, { $set: { openReports: 0 } });
}

async function requirePhoto(event: EventDoc, photoId: ObjectId): Promise<PhotoDoc> {
  const { photos } = await collections();
  const photo = await photos.findOne({ _id: photoId, eventId: event._id, status: { $in: ["ready", "hidden"] } });
  if (!photo) throw new HttpError(404, "photo_not_found");
  return photo;
}

/**
 * Show or hide a photo. Hiding resolves its open reports; `dismissReports` keeps a
 * reported photo visible and closes the reports as dismissed.
 */
export async function moderatePhoto(
  event: EventDoc,
  photoId: ObjectId,
  action: { status?: "ready" | "hidden"; dismissReports?: boolean },
): Promise<HostPhoto> {
  const { photos } = await collections();
  await requirePhoto(event, photoId);

  if (action.status) {
    const from = action.status === "hidden" ? "ready" : "hidden";
    const changed = await photos.findOneAndUpdate(
      { _id: photoId, eventId: event._id, status: from },
      { $set: { status: action.status } },
    );
    if (changed) await incrementEventCounter(event._id, "photos", action.status === "hidden" ? -1 : 1);
    if (action.status === "hidden") await closeReports(photoId, "resolved");
  }
  if (action.dismissReports) await closeReports(photoId, "dismissed");

  return toHostPhoto(await requirePhoto(event, photoId));
}

/** Soft-deletes the photo record (kept for audit) and removes the files from storage. */
export async function deletePhoto(event: EventDoc, photoId: ObjectId): Promise<void> {
  const { photos } = await collections();
  const before = await photos.findOneAndUpdate(
    { _id: photoId, eventId: event._id, status: { $in: ["ready", "hidden"] } },
    { $set: { status: "deleted", deletedAt: new Date() } },
  );
  if (!before) throw new HttpError(404, "photo_not_found");
  if (before.status === "ready") await incrementEventCounter(event._id, "photos", -1);
  await releasePhotoQuota(event._id, 1);
  await closeReports(photoId, "resolved");
  await deleteObjects(Object.values(before.keys).filter((key): key is string => !!key));
}

/** A guest flags a visible photo. Repeated reports from the same guest are ignored. */
export async function reportPhoto(
  event: EventDoc,
  photoId: ObjectId,
  guestSessionId: ObjectId,
  input: { reason: ReportReason; note?: string },
): Promise<void> {
  const { photos, reports } = await collections();
  const photo = await photos.findOne({ _id: photoId, eventId: event._id, status: "ready" });
  if (!photo) throw new HttpError(404, "photo_not_found");

  try {
    await reports.insertOne({
      _id: new ObjectId(),
      eventId: event._id,
      photoId,
      guestSessionId,
      reason: input.reason,
      note: input.note?.trim() || null,
      status: "open",
      createdAt: new Date(),
      resolvedAt: null,
    });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) return; // already reported by this guest
    throw error;
  }
  await photos.updateOne({ _id: photoId }, { $inc: { openReports: 1 } });
}

export async function countOpenReports(event: EventDoc): Promise<number> {
  const { photos } = await collections();
  return photos.countDocuments({ eventId: event._id, openReports: { $gt: 0 }, status: { $in: ["ready", "hidden"] } });
}
