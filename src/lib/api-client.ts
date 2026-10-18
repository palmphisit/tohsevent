// Typed browser client for the /api/v1 guest endpoints. Response shapes come from
// the server services so both sides stay in sync.
import type { PublicEvent } from "@/server/services/events";
import type { PresignedUpload, PublicPhoto } from "@/server/services/photos";
import type { PreparedImage } from "./image";

export type { PublicEvent, PublicPhoto };

export interface GuestSession {
  id: string;
  displayName: string | null;
  uploadCount: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const error = body?.error ?? {};
    throw new ApiError(res.status, error.code ?? "http_error", error.message ?? `Request failed (${res.status})`);
  }
  return body as T;
}

const base = (slug: string) => `/api/v1/events/${encodeURIComponent(slug)}`;

export function joinEvent(slug: string, input: { displayName?: string; password?: string }) {
  return request<{ session: GuestSession }>(`${base(slug)}/session`, { method: "POST", body: JSON.stringify(input) });
}

export function listPhotos(slug: string, params: { source: PublicPhoto["source"]; cursor?: string; limit?: number }) {
  const query = new URLSearchParams({ source: params.source, limit: String(params.limit ?? 30) });
  if (params.cursor) query.set("cursor", params.cursor);
  return request<{ items: PublicPhoto[]; nextCursor: string | null }>(`${base(slug)}/photos?${query}`);
}

export async function reserveUpload(slug: string, image: PreparedImage): Promise<PresignedUpload> {
  const { uploads } = await request<{ uploads: PresignedUpload[] }>(`${base(slug)}/uploads`, {
    method: "POST",
    body: JSON.stringify({
      files: [
        {
          contentType: "image/jpeg",
          bytes: { display: image.display.size, thumb: image.thumb.size },
          width: image.width,
          height: image.height,
        },
      ],
    }),
  });
  return uploads[0];
}

/** PUTs the blobs straight to object storage using the presigned URLs. */
export async function putToStorage(reservation: PresignedUpload, image: PreparedImage): Promise<void> {
  await Promise.all(
    (["display", "thumb"] as const).map(async (variant) => {
      const target = reservation.uploads[variant];
      const res = await fetch(target.url, { method: target.method, headers: target.headers, body: image[variant] });
      if (!res.ok) throw new ApiError(res.status, "storage_upload_failed", `Upload of ${variant} failed (${res.status})`);
    }),
  );
}

export function completeUpload(slug: string, photoId: string) {
  return request<{ photo: PublicPhoto }>(`${base(slug)}/photos/${photoId}/complete`, { method: "POST" });
}
