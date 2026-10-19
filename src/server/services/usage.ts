import { collections } from "../db";
import { planOf, type EventDoc } from "../models";

export interface EventUsage {
  plan: { tier: string; name: string };
  files: { used: number; max: number };
  guests: { used: number; max: number };
  /** Bytes the plan allows (Custom); null = limited by file count only. */
  maxBytes: number | null;
  videos: number;
  photos: number;
  /** Everything stored for the album (display copies, thumbnails, clips, originals). */
  bytes: number;
  expiresAt: Date | null;
}

/** What the album uses of its plan: file slots, guests, storage size and time left. */
export async function eventUsage(event: EventDoc): Promise<EventUsage> {
  const { photos } = await collections();
  const plan = planOf(event);
  const [agg] = await photos
    .aggregate<{ files: number; videos: number; bytes: number }>([
      { $match: { eventId: event._id, status: { $in: ["pending", "ready", "hidden"] } } },
      {
        $group: {
          _id: null,
          files: { $sum: 1 },
          videos: { $sum: { $cond: [{ $eq: ["$kind", "video"] }, 1, 0] } },
          bytes: {
            $sum: {
              $add: [
                { $ifNull: ["$bytes.display", 0] },
                { $ifNull: ["$bytes.thumb", 0] },
                { $ifNull: ["$bytes.watermarked", 0] },
                { $ifNull: ["$bytes.video", 0] },
                { $ifNull: ["$original.bytes", 0] },
              ],
            },
          },
        },
      },
    ])
    .toArray();
  const files = event.usage?.photos ?? agg?.files ?? 0;
  const videos = agg?.videos ?? 0;
  return {
    plan: { tier: plan.tier, name: plan.name },
    files: { used: files, max: plan.maxPhotos },
    guests: { used: event.counters.guests, max: plan.maxGuests },
    videos,
    photos: Math.max(0, (agg?.files ?? 0) - videos),
    bytes: event.usage?.bytes ?? agg?.bytes ?? 0,
    maxBytes: plan.maxStorageBytes,
    expiresAt: event.expiresAt,
  };
}
