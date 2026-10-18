import { collections } from "../db";
import { PURGE_GRACE_DAYS } from "../plans";
import { deleteObjects } from "../storage";
import { releasePhotoQuota } from "./photos";

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_PENDING_MS = DAY_MS;
const BATCH_SIZE = 500;
/** Photos purged per run; a large album finishes over several daily runs. */
const PURGE_BUDGET = 3_000;
const DELETE_CONCURRENCY = 20;

export interface CleanupResult {
  stalePhotosRemoved: number;
  eventsExpired: number;
  photosPurged: number;
  albumsPurged: number;
}

/**
 * Daily housekeeping (triggered by Cloud Scheduler):
 * - uploads reserved but never completed: remove any files that did reach storage,
 *   give the guest their quota back and drop the record
 * - events past `expiresAt`: stop serving them to guests
 * - albums expired for longer than the grace period: delete their files for good
 */
export async function runDailyCleanup(now = new Date()): Promise<CleanupResult> {
  const { events, guestSessions, photos } = await collections();

  const stale = await photos
    .find({ status: "pending", createdAt: { $lt: new Date(now.getTime() - STALE_PENDING_MS) } })
    .limit(BATCH_SIZE)
    .toArray();

  for (const photo of stale) {
    // Deleting a key that was never uploaded is a no-op in S3/R2.
    await deleteObjects(Object.values(photo.keys).filter((key): key is string => !!key));
    const removed = await photos.deleteOne({ _id: photo._id, status: "pending" });
    if (removed.deletedCount) await releasePhotoQuota(photo.eventId, 1);
    if (removed.deletedCount && photo.uploader.type === "guest") {
      await guestSessions.updateOne(
        { _id: photo.uploader.id, uploadCount: { $gt: 0 } },
        { $inc: { uploadCount: -1 } },
      );
    }
  }

  const expired = await events.updateMany(
    { status: "live", expiresAt: { $ne: null, $lt: now } },
    { $set: { status: "expired", updatedAt: now } },
  );

  const purged = await purgeExpiredAlbums(now);
  return { stalePhotosRemoved: stale.length, eventsExpired: expired.modifiedCount, ...purged };
}

async function purgeExpiredAlbums(now: Date): Promise<{ photosPurged: number; albumsPurged: number }> {
  const { events, photos } = await collections();
  const cutoff = new Date(now.getTime() - PURGE_GRACE_DAYS * DAY_MS);
  const due = await events
    .find({ status: "expired", expiresAt: { $lt: cutoff }, purgedAt: null })
    .limit(50)
    .toArray();

  let photosPurged = 0;
  let albumsPurged = 0;
  for (const event of due) {
    const batch = await photos
      .find({ eventId: event._id, status: { $in: ["pending", "ready", "hidden"] } })
      .limit(PURGE_BUDGET - photosPurged)
      .toArray();
    for (let i = 0; i < batch.length; i += DELETE_CONCURRENCY) {
      await Promise.all(
        batch
          .slice(i, i + DELETE_CONCURRENCY)
          .map((photo) => deleteObjects(Object.values(photo.keys).filter((key): key is string => !!key))),
      );
    }
    if (batch.length > 0) {
      await photos.updateMany(
        { _id: { $in: batch.map((p) => p._id) } },
        { $set: { status: "deleted", deletedAt: now } },
      );
      photosPurged += batch.length;
    }

    const remaining = await photos.countDocuments({ eventId: event._id, status: { $in: ["pending", "ready", "hidden"] } });
    if (remaining === 0) {
      await events.updateOne(
        { _id: event._id },
        { $set: { purgedAt: now, "counters.photos": 0, "usage.photos": 0, updatedAt: now } },
      );
      albumsPurged++;
    }
    if (photosPurged >= PURGE_BUDGET) break;
  }
  return { photosPurged, albumsPurged };
}
