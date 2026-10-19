import { downloadZip, predictLength } from "client-zip";
import { collections } from "../db";
import { HttpError } from "../http";
import { ALBUM_ONLY, type EventDoc, type PhotoDoc, type PhotoSource } from "../models";
import { getObjectStream } from "../storage";

// Album download for hosts: the visible photos (clean display files, never watermarked; videos as the clip)
// streamed into a ZIP part by part, so nothing is buffered in memory and each request
// stays well inside Cloud Run's timeout.

export const ZIP_PART_SIZE = 300;

const visible = (event: EventDoc, source: PhotoSource) => ({ eventId: event._id, source, status: "ready" as const, ...ALBUM_ONLY });

export async function downloadableCounts(event: EventDoc): Promise<Record<PhotoSource, number>> {
  const { photos } = await collections();
  const [guest, official] = await Promise.all([
    photos.countDocuments(visible(event, "guest")),
    photos.countDocuments(visible(event, "official")),
  ]);
  return { guest, official };
}

function fileName(photo: PhotoDoc, index: number): string {
  const who = photo.uploader.displayName?.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().slice(0, 40);
  const ext = photo.keys.video ? photo.keys.video.split(".").pop() : photo.contentType === "image/webp" ? "webp" : "jpg";
  return `${String(index).padStart(4, "0")}${who ? `-${who}` : ""}.${ext}`;
}

export async function albumZip(event: EventDoc, source: PhotoSource, part: number): Promise<Response> {
  const { photos } = await collections();
  const offset = (part - 1) * ZIP_PART_SIZE;
  const docs = await photos.find(visible(event, source)).sort({ _id: 1 }).skip(offset).limit(ZIP_PART_SIZE).toArray();
  if (docs.length === 0) throw new HttpError(404, "nothing_to_download", "No photos in this part");

  const entries = docs.map((photo, i) => ({
    photo,
    name: `${source}/${fileName(photo, offset + i + 1)}`,
    lastModified: photo.completedAt ?? photo.createdAt,
    size: photo.bytes.video ?? photo.bytes.display,
  }));

  async function* files() {
    for (const { photo, name, lastModified, size } of entries) {
      yield { name, lastModified, size, input: await getObjectStream(photo.keys.video ?? photo.keys.display) };
    }
  }

  // No Content-Length on the response: Cloud Run caps responses of a declared size at 32 MiB,
  // while chunked (streamed) responses can be any size, and albums with videos run far past it.
  const zip = downloadZip(files(), {
    length: predictLength(entries.map(({ name, lastModified, size }) => ({ name, lastModified, size }))),
  });
  const filename = `tohsevent-${event.slug}-${source}-part${part}.zip`;
  return new Response(zip.body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
