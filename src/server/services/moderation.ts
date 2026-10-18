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
  /** Open reports (reason, note, when), newest first. */
  reports: { reason: ReportReason; note: string | null; createdAt: string }[];
  /** Hidden automatically by SafeSearch and not reviewed yet. */
  autoFlagged: { adult: string; violence: string; racy: string } | null;
}

/** Needs host attention: open guest reports, or hidden by auto moderation and not yet reviewed. */
function needsReview(eventId: ObjectId): Filter<PhotoDoc> {
  return {
    eventId,
    $or: [
      { openReports: { $gt: 0 }, status: { $in: ["ready", "hidden"] } },
      { "autoModeration.flagged": true, status: "hidden" },
    ],
  };
}

function toHostPhoto(photo: PhotoDoc, event: EventDoc, reports: HostPhoto["reports"] = []): HostPhoto {
  return {
    ...toPublicPhoto(photo, event, { clean: true }),
    status: photo.status === "hidden" ? "hidden" : "ready",
    openReports: photo.openReports ?? 0,
    reports,
    autoFlagged: photo.autoModeration?.flagged && photo.status === "hidden" ? photo.autoModeration.labels : null,
  };
}

async function openReportsFor(photoIds: ObjectId[]): Promise<Map<string, HostPhoto["reports"]>> {
  const byPhoto = new Map<string, HostPhoto["reports"]>();
  if (photoIds.length === 0) return byPhoto;
  const { reports } = await collections();
  const docs = await reports.find({ photoId: { $in: photoIds }, status: "open" }).sort({ createdAt: -1 }).toArray();
  for (const r of docs) {
    const key = r.photoId.toHexString();
    byPhoto.set(key, [...(byPhoto.get(key) ?? []), { reason: r.reason, note: r.note, createdAt: r.createdAt.toISOString() }]);
  }
  return byPhoto;
}

export async function listHostPhotos(
  event: EventDoc,
  options: { view: HostPhotoView; cursor?: ObjectId; limit: number },
): Promise<{ items: HostPhoto[]; nextCursor: string | null }> {
  const { photos } = await collections();
  const filter: Filter<PhotoDoc> =
    options.view === "reported"
      ? needsReview(event._id)
      : { eventId: event._id, source: options.view, status: { $in: ["ready", "hidden"] } };
  if (options.cursor) filter._id = { $lt: options.cursor };

  const docs = await photos
    .find(filter)
    .sort({ _id: -1 })
    .limit(options.limit + 1)
    .toArray();
  const hasMore = docs.length > options.limit;
  const page = hasMore ? docs.slice(0, options.limit) : docs;
  const reportsByPhoto = await openReportsFor(page.filter((p) => (p.openReports ?? 0) > 0).map((p) => p._id));
  return {
    items: page.map((photo) => toHostPhoto(photo, event, reportsByPhoto.get(photo._id.toHexString()))),
    nextCursor: hasMore ? page[page.length - 1]._id.toHexString() : null };
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
    // Any explicit show/hide by the host counts as reviewing an auto-moderation flag.
    await photos.updateOne(
      { _id: photoId, "autoModeration.flagged": true },
      { $set: { "autoModeration.flagged": false, "autoModeration.reviewedAt": new Date() } },
    );
  }
  if (action.dismissReports) await closeReports(photoId, "dismissed");

  return toHostPhoto(await requirePhoto(event, photoId), event);
}

/** Soft-deletes the photo record (kept for audit) and removes the files from storage. */
export async function deletePhoto(
  event: EventDoc,
  photoId: ObjectId,
  options: { uploaderId?: ObjectId } = {},
): Promise<void> {
  const { photos } = await collections();
  const before = await photos.findOneAndUpdate(
    {
      _id: photoId,
      eventId: event._id,
      status: { $in: ["ready", "hidden"] },
      // Guests may only delete their own uploads.
      ...(options.uploaderId ? { "uploader.id": options.uploaderId } : {}),
    },
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
  return photos.countDocuments(needsReview(event._id));
}
