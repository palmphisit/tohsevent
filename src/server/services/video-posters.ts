import { randomBytes } from "node:crypto";
import type { Filter, ObjectId } from "mongodb";
import { collections } from "../db";
import type { PhotoDoc } from "../models";
import { deleteObjects, publicUrl, putObject } from "../storage";
import { cutPoster } from "../video-poster";

// Replaces the browser-made poster of a video with a frame cut on the server, so every
// clip gets a real thumbnail (new uploads on completion, older ones in the background).

const CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

/** Videos that still have only the browser-made poster (or whose attempt was abandoned). */
function needsPoster(now: Date): Filter<PhotoDoc> {
  return {
    kind: "video",
    $or: [
      { "video.poster": { $exists: false } },
      { "video.poster": "pending", "video.posterClaimedAt": { $lt: new Date(now.getTime() - CLAIM_TIMEOUT_MS) } },
    ],
  };
}

/**
 * Cuts a poster for one video and swaps it in. New object names (not overwrites) so the
 * CDN never serves the old frame. Returns the updated photo, or null if another worker
 * holds it or ffmpeg could not read the clip.
 */
export async function ensureServerPoster(photoId: ObjectId): Promise<PhotoDoc | null> {
  const { photos } = await collections();
  const now = new Date();
  const photo = await photos.findOneAndUpdate(
    { _id: photoId, ...needsPoster(now) },
    { $set: { "video.poster": "pending", "video.posterClaimedAt": now } },
    { returnDocument: "after" },
  );
  if (!photo?.keys.video || !photo.video) return null;

  const frame = await cutPoster(publicUrl(photo.keys.video), photo.video.durationSec).catch((error) => {
    console.error("video-poster: cut failed", photo._id.toHexString(), error);
    return null;
  });
  if (!frame) {
    await photos.updateOne({ _id: photo._id }, { $set: { "video.poster": "failed" }, $unset: { "video.posterClaimedAt": "" } });
    return null;
  }

  const dir = photo.keys.thumb.slice(0, photo.keys.thumb.lastIndexOf("/"));
  const token = randomBytes(6).toString("hex");
  const keys = { display: `${dir}/poster-${token}.jpg`, thumb: `${dir}/poster-thumb-${token}.jpg` };
  await Promise.all([
    putObject(keys.display, frame.display, "image/jpeg"),
    putObject(keys.thumb, frame.thumb, "image/jpeg"),
  ]);
  const updated = await photos.findOneAndUpdate(
    { _id: photo._id, "video.poster": "pending" },
    {
      $set: {
        "keys.display": keys.display,
        "keys.thumb": keys.thumb,
        "bytes.display": frame.display.length,
        "bytes.thumb": frame.thumb.length,
        contentType: "image/jpeg",
        width: frame.width,
        height: frame.height,
        "video.poster": "server",
      },
      $unset: { "video.posterFallback": "", "video.posterClaimedAt": "" },
    },
    { returnDocument: "after" },
  );
  if (!updated) {
    // The photo was deleted meanwhile: drop the frames we just wrote.
    await deleteObjects([keys.display, keys.thumb]).catch(() => {});
    return null;
  }
  await deleteObjects([photo.keys.display, photo.keys.thumb]).catch((error) =>
    console.error("video-poster: failed to delete old poster", error),
  );
  return updated;
}

/**
 * Fixes up to `limit` listed videos that still have a browser-made poster, in place.
 * Used by gallery/slideshow reads so older clips get real thumbnails as people look at them.
 */
export async function repairListedPosters(docs: PhotoDoc[], limit = 1): Promise<PhotoDoc[]> {
  const todo = docs.filter((d) => d.kind === "video" && !d.video?.poster).slice(0, limit);
  if (todo.length === 0) return docs;
  const fixed = new Map<string, PhotoDoc>();
  for (const doc of todo) {
    const updated = await ensureServerPoster(doc._id);
    if (updated) fixed.set(updated._id.toHexString(), updated);
  }
  return fixed.size ? docs.map((d) => fixed.get(d._id.toHexString()) ?? d) : docs;
}

/** Daily job: posters for videos uploaded before server-side frames (or missed). */
export async function backfillVideoPosters(limit = 50): Promise<number> {
  const { photos } = await collections();
  const docs = await photos
    .find({ ...needsPoster(new Date()), status: { $in: ["ready", "hidden"] } })
    .limit(limit)
    .toArray();
  let done = 0;
  for (const doc of docs) if (await ensureServerPoster(doc._id)) done++;
  return done;
}
