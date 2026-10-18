// Typed browser client for the /api/v1 endpoints (guest and host). Response shapes come from
// the server services so both sides stay in sync.
import type { ReportReason } from "@/server/models";
import type { CreateEventInput, HostEvent, UpdateEventInput } from "@/server/services/host-events";
import type { PublicEvent } from "@/server/services/events";
import type { BrandingAsset, BrandingAssetKind, BrandingEditorState, SaveBrandingInput } from "@/server/services/branding";
import type { InviteView, MemberView } from "@/server/services/members";
import type { HostPhoto, HostPhotoView } from "@/server/services/moderation";
import type { PresignedUpload, PublicPhoto } from "@/server/services/photos";
import type { SlideshowSettings } from "@/server/services/slideshow";
import type { PreparedImage } from "./image";

export type { SlideshowSettings, InviteView, MemberView, BrandingAsset, BrandingEditorState, SaveBrandingInput, CreateEventInput, HostEvent, HostPhoto, HostPhotoView, PublicEvent, PublicPhoto, ReportReason, UpdateEventInput };

export interface GuestSession {
  id: string;
  displayName: string | null;
  uploadCount: number;
  notifyEmail: string | null;
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

export function joinEvent(slug: string, input: { displayName?: string; password?: string; consent?: true }) {
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
        ...(image.video
          ? {
              video: {
                contentType: image.video.contentType,
                bytes: image.video.blob.size,
                ...(image.video.durationSec ? { durationSec: Math.round(image.video.durationSec * 10) / 10 } : {}),
                ...(image.video.posterFallback ? { posterFallback: true } : {}),
              },
            }
          : {}),
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

type StorageTarget = PresignedUpload["uploads"]["display"];

/** XHR PUT so large clips can report progress (fetch has no upload progress). */
function putWithProgress(target: StorageTarget, body: Blob, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(target.method, target.url);
    for (const [name, value] of Object.entries(target.headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(xhr.status, "storage_upload_failed", `Upload of video failed (${xhr.status})`));
    xhr.onerror = () => reject(new ApiError(0, "storage_upload_failed", "Upload of video failed (network)"));
    xhr.send(body);
  });
}

/** PUTs the blobs straight to object storage using the presigned URLs. */
export async function putToStorage(
  reservation: PresignedUpload,
  image: PreparedImage,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  await Promise.all([
    ...(["display", "thumb", "watermarked"] as const).map(async (variant) => {
      const target = reservation.uploads[variant];
      const body = image[variant];
      if (!target) return;
      if (!body) throw new ApiError(400, "missing_variant", `No ${variant} image to upload`);
      const res = await fetch(target.url, { method: target.method, headers: target.headers, body });
      if (!res.ok) throw new ApiError(res.status, "storage_upload_failed", `Upload of ${variant} failed (${res.status})`);
    }),
    (async () => {
      const target = reservation.uploads.video;
      if (!target) return;
      if (!image.video) throw new ApiError(400, "missing_variant", "No video to upload");
      await putWithProgress(target, image.video.blob, onProgress ?? (() => {}));
    })(),
  ]);
}

export function completeUpload(slug: string, photoId: string) {
  return request<{ photo: PublicPhoto }>(`${base(slug)}/photos/${photoId}/complete`, { method: "POST" });
}

export function subscribeNotify(slug: string, email: string) {
  return request<{ notifyEmail: string }>(`${base(slug)}/notify`, { method: "POST", body: JSON.stringify({ email }) });
}

export function unsubscribeNotify(slug: string) {
  return request<null>(`${base(slug)}/notify`, { method: "DELETE" });
}

export function deleteMyPhoto(slug: string, photoId: string) {
  return request<null>(`${base(slug)}/photos/${photoId}`, { method: "DELETE" });
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

/** Uploads a logo / cover / sponsor image; returns its storage key and public URL. */
export async function uploadBrandingAsset(eventId: string, kind: BrandingAssetKind, blob: Blob): Promise<BrandingAsset> {
  const created = await request<{ key: string; url: string; upload: { url: string; method: "PUT"; headers: Record<string, string> } }>(
    `${hostBase(eventId)}/branding/assets`,
    { method: "POST", body: JSON.stringify({ kind, contentType: blob.type, bytes: blob.size }) },
  );
  const res = await fetch(created.upload.url, { method: created.upload.method, headers: created.upload.headers, body: blob });
  if (!res.ok) throw new ApiError(res.status, "storage_upload_failed", `Upload failed (${res.status})`);
  return { key: created.key, url: created.url };
}

export function saveBranding(eventId: string, input: SaveBrandingInput) {
  return request<{ branding: BrandingEditorState }>(`${hostBase(eventId)}/branding`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function notifyGuests(eventId: string) {
  return request<{ sent: number }>(`${hostBase(eventId)}/notify-guests`, { method: "POST" });
}

export function listEventMembers(eventId: string) {
  return request<{ members: MemberView[]; invites: InviteView[] }>(`${hostBase(eventId)}/members`);
}

export function createEventInvite(eventId: string) {
  return request<{ url: string; expiresAt: string }>(`${hostBase(eventId)}/members`, { method: "POST" });
}

export function removeEventMember(eventId: string, userId: string) {
  return request<null>(`${hostBase(eventId)}/members/${userId}`, { method: "DELETE" });
}

export function revokeEventInvite(eventId: string, inviteId: string) {
  return request<null>(`${hostBase(eventId)}/invites/${inviteId}`, { method: "DELETE" });
}

export function acceptInvite(token: string) {
  return request<{ eventId: string }>(`/api/v1/invites/${encodeURIComponent(token)}/accept`, { method: "POST" });
}

// ---- Venue slideshow ----

export function listSlideshowPhotos(
  slug: string,
  params: { key?: string | null; sources?: SlideshowSettings["sources"]; limit?: number },
) {
  const query = new URLSearchParams({ limit: String(params.limit ?? 60) });
  if (params.key) query.set("key", params.key);
  if (params.sources) query.set("sources", params.sources);
  return request<{ items: PublicPhoto[]; total: number; settings: SlideshowSettings }>(`${base(slug)}/slideshow?${query}`, {
    cache: "no-store",
  });
}

export function saveSlideshow(eventId: string, input: SlideshowSettings) {
  return request<{ slideshow: SlideshowSettings }>(`${hostBase(eventId)}/slideshow`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
