import { collections } from "../db";
import { deleteObjects } from "../storage";

const STALE_PENDING_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;

export interface CleanupResult {
  stalePhotosRemoved: number;
  eventsExpired: number;
}

/**
 * Daily housekeeping (triggered by Cloud Scheduler):
 * - uploads reserved but never completed: remove any files that did reach storage,
 *   give the guest their quota back and drop the record
 * - events past `expiresAt`: stop serving them to guests
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

  return { stalePhotosRemoved: stale.length, eventsExpired: expired.modifiedCount };
}
