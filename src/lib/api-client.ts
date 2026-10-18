// Typed browser client for the /api/v1 endpoints (guest and host). Response shapes come from
// the server services so both sides stay in sync.
import type { ReportReason } from "@/server/models";
import type { CreateEventInput, HostEvent, UpdateEventInput } from "@/server/services/host-events";
import type { PublicEvent } from "@/server/services/events";
import type { HostPhoto, HostPhotoView } from "@/server/services/moderation";
import type { PresignedUpload, PublicPhoto } from "@/server/services/photos";
import type { PreparedImage } from "./image";

export type { CreateEventInput, HostEvent, HostPhoto, HostPhotoView, PublicEvent, PublicPhoto, ReportReason, UpdateEventInput };

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

function uploadBody(image: PreparedImage): string {
  return JSON.stringify({
    files: [
      {
        contentType: "image/jpeg",
        bytes: {
          display: image.display.size,
          thumb: image.thumb.size,
          ...(image.watermarked ? { watermarked: image.watermarked.size } : {}),
        },
        width: image.width,
        height: image.height,
      },
    ],
  });
}

export async function reserveUpload(slug: string, image: PreparedImage): Promise<PresignedUpload> {
  const { uploads } = await request<{ uploads: PresignedUpload[] }>(`${base(slug)}/uploads`, {
    method: "POST",
    body: uploadBody(image),
  });
  return uploads[0];
}

/** PUTs the blobs straight to object storage using the presigned URLs. */
export async function putToStorage(reservation: PresignedUpload, image: PreparedImage): Promise<void> {
  await Promise.all(
    (["display", "thumb", "watermarked"] as const).map(async (variant) => {
      const target = reservation.uploads[variant];
      const body = image[variant];
      if (!target) return;
      if (!body) throw new ApiError(400, "missing_variant", `No ${variant} image to upload`);
      const res = await fetch(target.url, { method: target.method, headers: target.headers, body });
      if (!res.ok) throw new ApiError(res.status, "storage_upload_failed", `Upload of ${variant} failed (${res.status})`);
    }),
  );
}

export function completeUpload(slug: string, photoId: string) {
  return request<{ photo: PublicPhoto }>(`${base(slug)}/photos/${photoId}/complete`, { method: "POST" });
}

export function reportPhoto(slug: string, photoId: string, input: { reason: ReportReason; note?: string }) {
  return request<null>(`${base(slug)}/photos/${photoId}/report`, { method: "POST", body: JSON.stringify(input) });
}

// ---- Host (signed-in organizer) endpoints ----

export function createHostEvent(input: CreateEventInput) {
  return request<{ event: HostEvent }>("/api/v1/host/events", { method: "POST", body: JSON.stringify(input) });
}

export function updateHostEvent(id: string, input: UpdateEventInput) {
  return request<{ event: HostEvent }>(`/api/v1/host/events/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

const hostBase = (eventId: string) => `/api/v1/host/events/${eventId}`;

export function listHostPhotos(eventId: string, params: { view: HostPhotoView; cursor?: string }) {
  const query = new URLSearchParams({ view: params.view });
  if (params.cursor) query.set("cursor", params.cursor);
  return request<{ items: HostPhoto[]; nextCursor: string | null }>(`${hostBase(eventId)}/photos?${query}`);
}

export function moderateHostPhoto(
  eventId: string,
  photoId: string,
  action: { status?: "ready" | "hidden"; dismissReports?: true },
) {
  return request<{ photo: HostPhoto }>(`${hostBase(eventId)}/photos/${photoId}`, {
    method: "PATCH",
    body: JSON.stringify(action),
  });
}

export function deleteHostPhoto(eventId: string, photoId: string) {
  return request<null>(`${hostBase(eventId)}/photos/${photoId}`, { method: "DELETE" });
}

export async function reserveOfficialUpload(eventId: string, image: PreparedImage): Promise<PresignedUpload> {
  const { uploads } = await request<{ uploads: PresignedUpload[] }>(`${hostBase(eventId)}/uploads`, {
    method: "POST",
    body: uploadBody(image),
  });
  return uploads[0];
}

export async function completeOfficialUpload(eventId: string, photoId: string): Promise<PublicPhoto> {
  const { photo } = await request<{ photo: PublicPhoto }>(`${hostBase(eventId)}/photos/${photoId}/complete`, {
    method: "POST",
  });
  return photo;
}

export async function startUpgradeCheckout(eventId: string, tier: "standard" | "premium"): Promise<string> {
  const { url } = await request<{ url: string }>(`${hostBase(eventId)}/checkout`, {
    method: "POST",
    body: JSON.stringify({ tier }),
  });
  return url;
}
