import { env } from "./env";

// Minimal Google Drive v3 client (REST, no SDK): folders and resumable uploads.
// https://developers.google.com/drive/api/guides/manage-uploads#resumable

/** The Google grant is missing, expired or revoked: the user has to connect Drive again. */
export class DriveAuthError extends Error {}
/** The resumable session is gone (expired after a week, or Drive dropped it): start the file over. */
export class DriveSessionLost extends Error {}

const FOLDER_MIME = "application/vnd.google-apps.folder";

async function check(res: Response, what: string): Promise<Response> {
  if (res.ok) return res;
  const body = await res.text().catch(() => "");
  if (res.status === 401 || (res.status === 403 && /insufficient|scope|permission/i.test(body))) {
    throw new DriveAuthError(`${what}: HTTP ${res.status}`);
  }
  throw new Error(`${what}: HTTP ${res.status} ${body.slice(0, 300)}`);
}

export async function createFolder(
  token: string,
  name: string,
  parentId?: string,
): Promise<{ id: string; url: string }> {
  const res = await check(
    await fetch(`${env().GOOGLE_API_BASE}/drive/v3/files?fields=id,webViewLink`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
      signal: AbortSignal.timeout(20_000),
    }),
    "create folder",
  );
  const folder = (await res.json()) as { id: string; webViewLink?: string };
  return { id: folder.id, url: folder.webViewLink ?? `https://drive.google.com/drive/folders/${folder.id}` };
}

/** Opens a resumable upload session; the returned URL accepts the file's bytes in chunks. */
export async function startUpload(
  token: string,
  file: { name: string; mimeType: string; size: number; parentId: string },
): Promise<string> {
  const res = await check(
    await fetch(`${env().GOOGLE_API_BASE}/upload/drive/v3/files?uploadType=resumable&fields=id`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": file.mimeType,
        "X-Upload-Content-Length": String(file.size),
      },
      body: JSON.stringify({ name: file.name, parents: [file.parentId] }),
      signal: AbortSignal.timeout(20_000),
    }),
    "start upload",
  );
  const location = res.headers.get("location");
  if (!location) throw new Error("start upload: no session URL");
  return location;
}

/**
 * Sends one chunk at `offset`. Chunks other than the last must be multiples of 256 KiB.
 * Returns the next offset to send, or null once Drive has the whole file.
 */
export async function uploadChunk(
  token: string,
  uploadUrl: string,
  chunk: Uint8Array,
  offset: number,
  size: number,
): Promise<number | null> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Range": `bytes ${offset}-${offset + chunk.length - 1}/${size}`,
    },
    body: chunk as Uint8Array<ArrayBuffer>,
    signal: AbortSignal.timeout(120_000),
  });
  if (res.status === 200 || res.status === 201) return null;
  if (res.status === 308) {
    // "Resume Incomplete": Drive reports what it has, e.g. "bytes=0-8388607".
    const range = res.headers.get("range");
    return range ? Number(range.split("-")[1]) + 1 : 0;
  }
  if (res.status === 404 || res.status === 410) throw new DriveSessionLost(`upload session gone (${res.status})`);
  await check(res, "upload chunk");
  return null;
}
