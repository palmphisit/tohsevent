import { ObjectId, type Filter } from "mongodb";
import { collections } from "../db";
import { createFolder, DriveAuthError, DriveSessionLost, startUpload, uploadChunk } from "../drive";
import { driveAccessToken } from "../google";
import { HttpError } from "../http";
import { ALBUM_ONLY, type DriveExportDoc, type EventDoc, type PhotoDoc, type PhotoSource } from "../models";
import { originalsBucket } from "../originals-storage";
import { readRange } from "../storage";

// Album transfer to the host's own Google Drive. The dashboard calls `step` repeatedly while
// it is open; each step sends files for ~40 s, saving progress after every chunk, so a closed
// tab, a redeploy or an expired token only pauses the transfer (it resumes where it stopped).

const STEP_BUDGET_MS = 40_000;
const LOCK_MS = 90_000;
/** Resumable chunks must be multiples of 256 KiB. */
const CHUNK_BYTES = 32 * 256 * 1024;

const SUBFOLDER_NAMES: Record<PhotoSource, string> = { official: "Official", guest: "รูปจากแขก" };

export interface DriveExportView {
  id: string;
  status: DriveExportDoc["status"];
  sources: PhotoSource[];
  folderUrl: string;
  total: number;
  done: number;
  failed: number;
  bytes: number;
  lastError: string | null;
  createdAt: string;
  finishedAt: string | null;
}

function toView(job: DriveExportDoc): DriveExportView {
  return {
    id: job._id.toHexString(),
    status: job.status,
    sources: job.sources,
    folderUrl: job.folder.url,
    total: job.total,
    done: job.done,
    failed: job.failed,
    bytes: job.bytes,
    lastError: job.lastError,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
  };
}

function remainingFilter(job: Pick<DriveExportDoc, "eventId" | "sources" | "cursor">): Filter<PhotoDoc> {
  return {
    eventId: job.eventId,
    status: "ready",
    source: { $in: job.sources },
    ...ALBUM_ONLY,
    ...(job.cursor ? { _id: { $gt: job.cursor } } : {}),
  };
}

const STAMP = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Which stored file goes to Drive for a photo: the original when there is one, else the clip or the clean display copy. */
function fileFor(photo: PhotoDoc): { key: string; bucket?: string; size: number; mimeType: string; name: string } {
  const originals = originalsBucket();
  if (photo.original?.status === "ready" && originals) {
    return {
      key: photo.original.key,
      bucket: originals,
      size: photo.original.bytes,
      mimeType: photo.original.contentType,
      name: photo.original.filename,
    };
  }
  const when = STAMP.format(photo.takenAt ?? photo.createdAt).replaceAll(":", ".");
  const who = photo.uploader.displayName?.replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 40);
  // Short id suffix: burst uploads often share the same second.
  const base = `${when}${who ? ` ${who}` : ""} ${photo._id.toHexString().slice(-4)}`;
  if (photo.keys.video && photo.video) {
    return {
      key: photo.keys.video,
      size: photo.bytes.video!,
      mimeType: photo.video.contentType,
      name: `${base}.${photo.keys.video.split(".").pop()}`,
    };
  }
  return {
    key: photo.keys.display,
    size: photo.bytes.display,
    mimeType: photo.contentType,
    name: `${base}.${photo.contentType === "image/webp" ? "webp" : "jpg"}`,
  };
}

export async function latestDriveExport(event: EventDoc, userId: ObjectId): Promise<DriveExportView | null> {
  const { driveExports } = await collections();
  const job = await driveExports.findOne({ eventId: event._id, userId }, { sort: { createdAt: -1 } });
  return job && toView(job);
}

/**
 * Creates the Drive folders and the transfer record, or resumes the user's unfinished
 * transfer for this event (also after reconnecting Google).
 */
export async function startDriveExport(
  event: EventDoc,
  userId: ObjectId,
  sources: PhotoSource[],
): Promise<DriveExportView> {
  const token = await driveAccessToken(userId);
  if (!token) throw new HttpError(409, "drive_not_connected", "Connect Google Drive first");
  const { driveExports, photos } = await collections();

  const unfinished = await driveExports.findOneAndUpdate(
    { eventId: event._id, userId, status: { $in: ["running", "needs_auth"] } },
    { $set: { status: "running", updatedAt: new Date() } },
    { sort: { createdAt: -1 }, returnDocument: "after" },
  );
  if (unfinished) return toView(unfinished);

  let folder: DriveExportDoc["folder"];
  const subfolders: DriveExportDoc["subfolders"] = {};
  try {
    folder = await createFolder(token, `Tohs Event · ${event.title}`);
    for (const source of sources) subfolders[source] = (await createFolder(token, SUBFOLDER_NAMES[source], folder.id)).id;
  } catch (error) {
    if (error instanceof DriveAuthError) throw new HttpError(409, "drive_not_connected", "Connect Google Drive again");
    throw error;
  }

  const now = new Date();
  const job: DriveExportDoc = {
    _id: new ObjectId(),
    eventId: event._id,
    userId,
    sources,
    folder,
    subfolders,
    status: "running",
    total: 0,
    done: 0,
    failed: 0,
    bytes: 0,
    cursor: null,
    current: null,
    lastError: null,
    lockedUntil: null,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
  };
  job.total = await photos.countDocuments(remainingFilter(job));
  await driveExports.insertOne(job);
  return toView(job);
}

export async function cancelDriveExport(event: EventDoc, userId: ObjectId, exportId: ObjectId): Promise<void> {
  const { driveExports } = await collections();
  await driveExports.updateOne(
    { _id: exportId, eventId: event._id, userId, status: { $in: ["running", "needs_auth"] } },
    { $set: { status: "canceled", current: null, finishedAt: new Date(), updatedAt: new Date() } },
  );
}

/** Sends files for up to ~40 s and returns the progress. Safe to call from several tabs at once. */
export async function runDriveExportStep(
  event: EventDoc,
  userId: ObjectId,
  exportId: ObjectId,
): Promise<DriveExportView> {
  const { driveExports, photos } = await collections();
  const now = new Date();
  const job = await driveExports.findOneAndUpdate(
    {
      _id: exportId,
      eventId: event._id,
      userId,
      status: "running",
      $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }],
    },
    { $set: { lockedUntil: new Date(now.getTime() + LOCK_MS) } },
    { returnDocument: "after" },
  );
  if (!job) {
    // Not running, or another step holds the lock: report where it stands.
    const current = await driveExports.findOne({ _id: exportId, eventId: event._id, userId });
    if (!current) throw new HttpError(404, "export_not_found");
    return toView(current);
  }

  const save = (set: Partial<DriveExportDoc>) => {
    Object.assign(job, set);
    return driveExports.updateOne({ _id: job._id }, { $set: { ...set, updatedAt: new Date() } });
  };

  const token = await driveAccessToken(userId);
  if (!token) {
    await save({ status: "needs_auth", lockedUntil: null });
    return toView(job);
  }

  const deadline = Date.now() + STEP_BUDGET_MS;
  try {
    while (Date.now() < deadline) {
      if (!job.current) {
        const next = await photos.findOne(remainingFilter(job), { sort: { _id: 1 } });
        if (!next) {
          await save({ status: "done", finishedAt: new Date() });
          break;
        }
        const file = fileFor(next);
        const uploadUrl = await startUpload(token, { ...file, parentId: job.subfolders[next.source]! });
        await save({ current: { photoId: next._id, uploadUrl, offset: 0, size: file.size } });
      }

      const current = job.current!;
      const photo = await photos.findOne({ _id: current.photoId, status: "ready" });
      if (!photo) {
        // Hidden or deleted since we started it: skip.
        await save({ cursor: current.photoId, current: null });
        continue;
      }
      try {
        const file = fileFor(photo);
        let offset: number | null = current.offset;
        while (offset !== null && Date.now() < deadline) {
          const end = Math.min(offset + CHUNK_BYTES, file.size) - 1;
          const chunk = await readRange(file.key, offset, end, file.bucket);
          offset = await uploadChunk(token, current.uploadUrl, chunk, offset, file.size);
          if (offset !== null) await save({ current: { ...current, offset } });
        }
        if (offset === null) {
          await save({ done: job.done + 1, bytes: job.bytes + file.size, cursor: photo._id, current: null });
        }
      } catch (error) {
        if (error instanceof DriveAuthError) throw error;
        if (error instanceof DriveSessionLost) {
          await save({ current: null }); // start this file over on the next round
          continue;
        }
        console.error("drive export: file failed", photo._id.toHexString(), error);
        await save({
          failed: job.failed + 1,
          cursor: photo._id,
          current: null,
          lastError: error instanceof Error ? error.message.slice(0, 200) : "upload failed",
        });
      }
    }
  } catch (error) {
    if (!(error instanceof DriveAuthError)) throw error;
    await save({ status: "needs_auth" });
  } finally {
    const remaining = job.status === "done" ? 0 : await photos.countDocuments(remainingFilter(job));
    await save({ lockedUntil: null, total: job.done + job.failed + remaining });
  }
  return toView(job);
}
