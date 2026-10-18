// Browser/desktop client for the multipart original-file upload. Parts already stored
// (after a crash or a closed tab) are skipped, so a retry continues where it stopped.
import { ApiError } from "./api-client";

const CONCURRENCY = 3;
const SIGN_BATCH = 10;

const TYPES_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  webp: "image/webp",
};

export function originalContentType(file: Blob & { name?: string }): string | null {
  const ext = file.name?.split(".").pop()?.toLowerCase() ?? "";
  const type = file.type || TYPES_BY_EXTENSION[ext] || "";
  return Object.values(TYPES_BY_EXTENSION).includes(type) ? type : null;
}

async function call<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, json?.error?.code ?? "http_error", json?.error?.message ?? `HTTP ${res.status}`);
  }
  return json as T;
}

export async function uploadOriginal(
  eventId: string,
  photoId: string,
  file: Blob & { name?: string },
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const contentType = originalContentType(file);
  if (!contentType) throw new ApiError(400, "unsupported_original", "Unsupported original file type");
  const base = `/api/v1/host/events/${eventId}/photos/${photoId}/original`;

  const started = await call<{ partSize: number; partCount: number; uploaded: { partNumber: number; etag: string }[] }>(
    base,
    { contentType, bytes: file.size, filename: file.name ?? `${photoId}` },
  );
  const etags = new Map(started.uploaded.map((p) => [p.partNumber, p.etag]));
  const partBytes = (n: number) => Math.min(started.partSize, file.size - (n - 1) * started.partSize);
  let doneBytes = [...etags.keys()].reduce((sum, n) => sum + partBytes(n), 0);
  onProgress?.(doneBytes / file.size);

  const missing = Array.from({ length: started.partCount }, (_, i) => i + 1).filter((n) => !etags.has(n));
  for (let i = 0; i < missing.length; i += SIGN_BATCH) {
    const batch = missing.slice(i, i + SIGN_BATCH);
    const { parts } = await call<{ parts: { partNumber: number; url: string }[] }>(`${base}/parts`, { partNumbers: batch });
    const queue = [...parts];
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        for (let part = queue.shift(); part; part = queue.shift()) {
          const start = (part.partNumber - 1) * started.partSize;
          const res = await fetch(part.url, { method: "PUT", body: file.slice(start, start + started.partSize) });
          const etag = res.headers.get("ETag");
          if (!res.ok || !etag) throw new ApiError(res.status, "part_upload_failed", `Part ${part.partNumber} failed`);
          etags.set(part.partNumber, etag);
          doneBytes += partBytes(part.partNumber);
          onProgress?.(doneBytes / file.size);
        }
      }),
    );
  }

  await call(`${base}/complete`, {
    parts: [...etags].map(([partNumber, etag]) => ({ partNumber, etag })).sort((a, b) => a.partNumber - b.partNumber),
  });
}
