"use client";

import { Camera, Images, Video } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ApiError, putToStorage, type PublicPhoto } from "@/lib/api-client";
import { prepareImage, type PreparedImage } from "@/lib/image";
import { listPending, removePending, savePending, setPendingPhotoId } from "@/lib/upload-store";
import { showError } from "@/lib/error-popup";
import { useLocale } from "@/lib/use-locale";
import { isVideoFile, prepareVideo, VideoRejected, type VideoLimits } from "@/lib/video";
import type { PresignedUpload } from "@/server/services/photos";

/** Two files at a time; one on low-memory phones (decoding big camera photos needs a lot of RAM). */
function concurrency(): number {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return memory !== undefined && memory <= 4 ? 1 : 2;
}

const noSubscribe = () => () => {};
/**
 * Android's file chooser mixes camera, files and apps, and specific MIME types send it to a
 * file browser instead of the photo picker: Android gets a gallery button plus camera buttons.
 */
function useIsAndroid(): boolean {
  return useSyncExternalStore(noSubscribe, () => /Android/i.test(navigator.userAgent), () => false);
}
// Presigned URLs live 10 minutes; re-reserve a little before that on retry.
const RESERVATION_TTL_MS = 8 * 60 * 1000;

type Status = "queued" | "processing" | "uploading" | "original" | "done" | "error";

interface QueueItem {
  id: string;
  file: Blob;
  /** Video clip: uploaded as-is next to poster frames; never has an original. */
  isVideo: boolean;
  status: Status;
  error?: string;
  previewUrl?: string;
  image?: PreparedImage;
  reservation?: { data: PresignedUpload; at: number };
  /** Set once the display/thumb copies are published; a retry then only redoes the original. */
  photoId?: string;
  /** Video clip or original-file upload progress (0–1). */
  progress?: number;
}

const T = {
  en: {
    errors: {
      video_not_allowed: "This event's plan doesn't support videos",
      video_too_large: "The video file is too large",
      video_too_long: "The video is too long",
      video_unsupported: "This video file isn't supported",
      quota_exceeded: "You've reached this event's upload limit",
      uploads_disabled: "This event is no longer accepting photos",
      photo_limit_reached: "This album is full",
      storage_full: "This event's storage is full",
      original_too_large: "The original file is too large for the plan",
      event_full: "This event has reached its guest limit",
      consent_declined: "Please accept the policy before uploading",
      unsupported_original: "This original file type isn't supported",
      part_upload_failed: "Uploading the original failed",
    } as Record<string, string>,
    failed: "Upload failed",
    hours: "hours",
    minutes: "minutes",
    seconds: "seconds",
    pickMedia: "Take / choose photos or videos",
    pickPhotos: "Take / choose photos to upload",
    fromGallery: "Choose from gallery",
    takePhoto: "Take a photo",
    recordVideo: "Record a video",
    videoLimits: (length: string, size: string) => `Videos up to ${length} · files up to ${size}`,
    resuming: (n: number) => `Resuming ${n} unfinished file${n === 1 ? "" : "s"} from last time`,
    progress: (done: number, total: number) => `Uploaded ${done}/${total} files`,
    keepOpen: "Keep this page open",
    retry: "retry",
    remove: "Remove from queue",
    queued: "Queued",
    preparingVideo: "Preparing video",
    resizing: "Resizing",
    original: (pct: number) => `Original ${pct}%`,
    video: (pct: number) => `Video ${pct}%`,
    uploading: "Uploading",
  },
  th: {
    errors: {
      video_not_allowed: "แพ็กเกจของงานนี้ยังไม่รองรับวิดีโอ",
      video_too_large: "วิดีโอไฟล์ใหญ่เกินกำหนด",
      video_too_long: "วิดีโอยาวเกินกำหนด",
      video_unsupported: "ไฟล์วิดีโอนี้ไม่รองรับ",
      quota_exceeded: "อัปโหลดครบจำนวนที่งานกำหนดแล้ว",
      uploads_disabled: "งานนี้ปิดรับรูปแล้ว",
      photo_limit_reached: "อัลบั้มนี้เต็มแล้ว",
      storage_full: "พื้นที่ของงานนี้เต็มแล้ว",
      original_too_large: "ไฟล์ต้นฉบับใหญ่เกินแพ็กเกจ",
      event_full: "งานนี้มีแขกครบจำนวนแล้ว",
      consent_declined: "ต้องยอมรับนโยบายก่อนอัปโหลด",
      unsupported_original: "ชนิดไฟล์ต้นฉบับไม่รองรับ",
      part_upload_failed: "อัปต้นฉบับไม่สำเร็จ",
    } as Record<string, string>,
    failed: "อัปโหลดไม่สำเร็จ",
    hours: "ชั่วโมง",
    minutes: "นาที",
    seconds: "วินาที",
    pickMedia: "ถ่าย / เลือกรูปหรือวิดีโอ",
    pickPhotos: "ถ่ายรูป / เลือกรูปเพื่ออัปโหลด",
    fromGallery: "เลือกจากคลังรูป",
    takePhoto: "ถ่ายรูป",
    recordVideo: "ถ่ายวิดีโอ",
    videoLimits: (length: string, size: string) => `วิดีโอยาวไม่เกิน ${length} · ไฟล์ไม่เกิน ${size}`,
    resuming: (n: number) => `กำลังอัปโหลดต่อ ${n} ไฟล์ที่ค้างจากครั้งก่อน`,
    progress: (done: number, total: number) => `อัปโหลดแล้ว ${done}/${total} ไฟล์`,
    keepOpen: "อย่าเพิ่งปิดหน้านี้",
    retry: "ลองใหม่",
    remove: "เอาออกจากคิว",
    queued: "รอคิว",
    preparingVideo: "กำลังเตรียมวิดีโอ",
    resizing: "กำลังย่อรูป",
    original: (pct: number) => `ต้นฉบับ ${pct}%`,
    video: (pct: number) => `วิดีโอ ${pct}%`,
    uploading: "กำลังอัปโหลด",
  },
};
type Messages = (typeof T)["en"];

const VIDEO_ERROR_CODES = ["video_not_allowed", "video_too_large", "video_too_long", "video_unsupported"];

function formatLength(sec: number, t: Messages): string {
  if (sec >= 3600) return `${Math.round(sec / 360) / 10} ${t.hours}`;
  if (sec >= 120) return `${Math.round(sec / 60)} ${t.minutes}`;
  return `${Math.round(sec)} ${t.seconds}`;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 ** 3 ? `${Math.round((bytes / 1024 ** 3) * 10) / 10} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

function errorMessage(error: unknown, t: Messages): string {
  if (error instanceof VideoRejected) return t.errors[error.code];
  if (error instanceof ApiError && t.errors[error.code]) return t.errors[error.code];
  return t.failed;
}

/** Errors that retrying will not fix; such files are dropped from the resume store. */
function isPermanent(error: unknown): boolean {
  if (error instanceof VideoRejected) return true;
  return (
    error instanceof ApiError &&
    ["quota_exceeded", "uploads_disabled", "photo_limit_reached", "storage_full", "event_full", ...VIDEO_ERROR_CODES].includes(
      error.code,
    )
  );
}

/** Photos only: video clips are too large to keep in the browser's storage for resuming. */
function persistFiles(scope: string, entries: { id: string; file: File }[]) {
  const addedAt = Date.now();
  entries.forEach((e, i) => {
    if (!isVideoFile(e.file)) void savePending({ id: e.id, scope, file: e.file, name: e.file.name, addedAt: addedAt + i });
  });
}

/** Endpoints for one upload target (guest page or host dashboard); the flow is the same. */
export interface UploadTarget {
  /** Runs before each upload, e.g. to join the event as a guest. */
  prepare?: () => Promise<unknown>;
  /** Also produce a watermarked copy (events on the Free plan). */
  watermark?: boolean;
  /** Video limits of the event's plan; null/undefined means photos only. */
  video?: VideoLimits | null;
  reserve: (image: PreparedImage) => Promise<PresignedUpload>;
  complete: (photoId: string) => Promise<PublicPhoto>;
  /** Upload the untouched file as the photo's original (photographers, Premium events). */
  uploadOriginal?: (photoId: string, file: Blob, onProgress: (fraction: number) => void) => Promise<void>;
}

/**
 * Runs the 3-step upload for one item, resuming from whatever a previous attempt
 * already finished (resized image, unexpired reservation).
 */
async function uploadItem(
  target: UploadTarget,
  item: QueueItem,
  update: (patch: Partial<QueueItem>) => void,
  onPhotoReady: (photo: PublicPhoto) => void,
) {
  let photoId = item.photoId;
  if (!photoId) {
    const photo = await uploadCopies(target, item, update);
    photoId = photo.id;
    update({ photoId, image: undefined, reservation: undefined });
    onPhotoReady(photo);
  }
  if (target.uploadOriginal && !item.isVideo) {
    update({ status: "original", progress: 0, error: undefined });
    await target.uploadOriginal(photoId, item.file, (progress) => update({ progress }));
  }
}

/** Display + thumb (+ watermarked, or the video clip) copies: resize, reserve, PUT, complete. */
async function uploadCopies(target: UploadTarget, item: QueueItem, update: (patch: Partial<QueueItem>) => void) {
  let { image, reservation } = item;
  if (!image) {
    update({ status: "processing", error: undefined });
    image = item.isVideo
      ? await prepareVideo(item.file, target.video ?? null)
      : await prepareImage(item.file, { watermark: target.watermark });
    update({ image, previewUrl: URL.createObjectURL(image.thumb) });
  }

  update({ status: "uploading", error: undefined, progress: 0 });
  if (!reservation || Date.now() - reservation.at > RESERVATION_TTL_MS) {
    reservation = { data: await target.reserve(image), at: Date.now() };
    update({ reservation });
  }

  await putToStorage(reservation.data, image, (progress) => update({ progress }));
  return target.complete(reservation.data.photoId);
}

/** Multi-file photo uploader: resizes in the browser and uploads straight to storage. */
export function Uploader({
  target,
  onUploaded,
  persistKey,
  gate,
  label,
}: {
  target: UploadTarget;
  onUploaded: (photo: PublicPhoto) => void;
  /**
   * Called on tap before the file picker opens. Return false to hold it (e.g. to ask for
   * consent first) and call `openPicker` later from another tap — iOS only opens the
   * picker inside a user gesture.
   */
  gate?: (openPicker: () => void) => boolean;
  /** When set, unfinished files survive a closed tab and resume on the next visit. */
  persistKey?: string;
  label?: string;
}) {
  const t = T[useLocale()];
  const android = useIsAndroid();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [restoredCount, setRestoredCount] = useState(0);
  const itemsRef = useRef(new Map<string, QueueItem>());
  const queueRef = useRef<string[]>([]);
  const activeRef = useRef(0);
  const callbacks = useRef({ target, onUploaded });
  useEffect(() => {
    callbacks.current = { target, onUploaded };
  });

  const inFlight = items.some((i) => ["queued", "processing", "uploading", "original"].includes(i.status));
  const doneCount = items.filter((i) => i.status === "done").length;

  // iOS Safari has no Background Sync: closing the tab stops uploads, so warn the guest.
  useEffect(() => {
    if (!inFlight) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [inFlight]);

  useEffect(() => {
    const map = itemsRef.current;
    return () => map.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
  }, []);

  function update(id: string, patch: Partial<QueueItem>) {
    const current = itemsRef.current.get(id);
    if (!current) return;
    itemsRef.current.set(id, { ...current, ...patch });
    setItems(Array.from(itemsRef.current.values()));
  }

  async function process(id: string) {
    try {
      const { target } = callbacks.current;
      await target.prepare?.();
      await uploadItem(
        target,
        itemsRef.current.get(id)!,
        (patch) => update(id, patch),
        (photo) => {
          void setPendingPhotoId(id, photo.id);
          callbacks.current.onUploaded(photo);
        },
      );
      update(id, { status: "done", image: undefined, reservation: undefined });
      void removePending(id);
    } catch (error) {
      console.error("upload failed", error);
      update(id, { status: "error", error: errorMessage(error, t) });
      if (isPermanent(error)) {
        void removePending(id);
        // Retrying will not help (quota, plan limits): say why once, as a popup.
        showError(errorMessage(error, t), t.failed);
      }
    }
  }

  function pump() {
    while (activeRef.current < concurrency() && queueRef.current.length > 0) {
      const id = queueRef.current.shift()!;
      activeRef.current++;
      void process(id).finally(() => {
        activeRef.current--;
        pump();
      });
    }
  }

  function enqueue(ids: string[]) {
    queueRef.current.push(...ids);
    pump();
  }

  function addItems(entries: { id: string; file: Blob; photoId?: string }[]) {
    const ids = entries
      .filter((entry) => !itemsRef.current.has(entry.id))
      .map(({ id, file, photoId }) => {
        itemsRef.current.set(id, { id, file, photoId, isVideo: isVideoFile(file), status: "queued" });
        return id;
      });
    setItems(Array.from(itemsRef.current.values()));
    enqueue(ids);
  }

  // Resume files left over from a previous visit (tab closed mid-upload).
  const restoreRef = useRef(addItems);
  useEffect(() => {
    restoreRef.current = addItems;
  });
  useEffect(() => {
    if (!persistKey) return;
    let cancelled = false;
    listPending(persistKey).then((pending) => {
      if (cancelled || pending.length === 0) return;
      setRestoredCount(pending.length);
      restoreRef.current(pending);
    });
    return () => {
      cancelled = true;
    };
  }, [persistKey]);

  function onFiles(input: HTMLInputElement) {
    const files = input.files;
    if (!files?.length) return;
    const entries = Array.from(files).map((file) => ({ id: crypto.randomUUID(), file }));
    if (persistKey) persistFiles(persistKey, entries);
    addItems(entries);
    input.value = "";
  }

  function open(ref: React.RefObject<HTMLInputElement | null>) {
    const openPicker = () => ref.current?.click();
    if (!gate || gate(openPicker)) openPicker();
  }

  function discard(id: string) {
    const item = itemsRef.current.get(id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    itemsRef.current.delete(id);
    setItems(Array.from(itemsRef.current.values()));
    void removePending(id);
  }

  function retry(id: string) {
    update(id, { status: "queued", error: undefined });
    enqueue([id]);
  }

  const pendingItems = items.filter((i) => i.status !== "done");

  return (
    <div>
      {/* Wildcard types only: they open the phone's photo picker (specific types fall back to a file browser). */}
      <input
        ref={inputRef}
        type="file"
        accept={target.video ? "image/*,video/*" : "image/*"}
        multiple
        hidden
        onChange={(e) => onFiles(e.currentTarget)}
      />
      {android && (
        <>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFiles(e.currentTarget)} />
          {target.video && (
            <input ref={recorderRef} type="file" accept="video/*" capture="environment" hidden onChange={(e) => onFiles(e.currentTarget)} />
          )}
        </>
      )}
      <button
        type="button"
        onClick={() => open(inputRef)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-4 text-lg font-medium text-brand-contrast shadow-lg shadow-black/5 transition hover:opacity-95 active:scale-[0.99]"
      >
        {android ? <Images className="h-5 w-5" /> : target.video ? <Video className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
        {label ?? (android ? t.fromGallery : target.video ? t.pickMedia : t.pickPhotos)}
      </button>
      {android && (
        <div className={`mt-2 grid gap-2 ${target.video ? "grid-cols-2" : "grid-cols-1"}`}>
          <button
            type="button"
            onClick={() => open(cameraRef)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-surface px-4 py-3 font-medium ring-1 ring-line transition active:scale-[0.99]"
          >
            <Camera className="h-5 w-5" /> {t.takePhoto}
          </button>
          {target.video && (
            <button
              type="button"
              onClick={() => open(recorderRef)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-surface px-4 py-3 font-medium ring-1 ring-line transition active:scale-[0.99]"
            >
              <Video className="h-5 w-5" /> {t.recordVideo}
            </button>
          )}
        </div>
      )}
      {target.video && (
        <p className="mt-2 text-center text-xs text-muted">
          {t.videoLimits(formatLength(target.video.maxDurationSec, t), formatSize(target.video.maxBytes))}
        </p>
      )}

      {items.length > 0 && (
        <div className="mt-3 rounded-xl border border-line p-3">
          {restoredCount > 0 && (
            <p className="mb-1 text-sm text-ink/70">{t.resuming(restoredCount)}</p>
          )}
          <p className="text-sm text-ink/70">
            {t.progress(doneCount, items.length)}
            {inFlight && <span className="text-muted/80"> · {t.keepOpen}</span>}
          </p>
          {pendingItems.length > 0 && (
            <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {pendingItems.map((item) => (
                <li key={item.id} className="relative aspect-square overflow-hidden rounded-lg bg-surface">
                  {item.previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                    <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 p-1 text-center text-xs text-white">
                    {item.status === "error" ? (
                      <>
                        <button type="button" onClick={() => retry(item.id)} className="underline">
                          {item.error} · {t.retry}
                        </button>
                        <button
                          type="button"
                          onClick={() => discard(item.id)}
                          aria-label={t.remove}
                          className="absolute top-0.5 right-1 px-1 text-sm"
                        >
                          ✕
                        </button>
                      </>
                    ) : item.status === "queued" ? (
                      t.queued
                    ) : item.status === "processing" ? (
                      item.isVideo ? t.preparingVideo : t.resizing
                    ) : item.status === "original" ? (
                      t.original(Math.round((item.progress ?? 0) * 100))
                    ) : item.isVideo ? (
                      t.video(Math.round((item.progress ?? 0) * 100))
                    ) : (
                      t.uploading
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
