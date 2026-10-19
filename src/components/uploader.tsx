"use client";

import { Camera, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError, putToStorage, type PublicPhoto } from "@/lib/api-client";
import { prepareImage, type PreparedImage } from "@/lib/image";
import { listPending, removePending, savePending, setPendingPhotoId } from "@/lib/upload-store";
import { showError } from "@/lib/error-popup";
import { isVideoFile, prepareVideo, VideoRejected, type VideoLimits } from "@/lib/video";
import type { PresignedUpload } from "@/server/services/photos";

const CONCURRENCY = 2;
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

const VIDEO_ERRORS: Record<string, string> = {
  video_not_allowed: "แพ็กเกจของงานนี้ยังไม่รองรับวิดีโอ",
  video_too_large: "วิดีโอไฟล์ใหญ่เกินกำหนด",
  video_too_long: "วิดีโอยาวเกินกำหนด",
  video_unsupported: "ไฟล์วิดีโอนี้ไม่รองรับ",
};

function formatLength(sec: number): string {
  if (sec >= 3600) return `${Math.round(sec / 360) / 10} ชั่วโมง`;
  if (sec >= 120) return `${Math.round(sec / 60)} นาที`;
  return `${Math.round(sec)} วินาที`;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 ** 3 ? `${Math.round((bytes / 1024 ** 3) * 10) / 10} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

function errorMessage(error: unknown): string {
  if (error instanceof VideoRejected) return VIDEO_ERRORS[error.code];
  if (error instanceof ApiError) {
    if (error.code in VIDEO_ERRORS) return VIDEO_ERRORS[error.code];
    if (error.code === "quota_exceeded") return "อัปโหลดครบจำนวนที่งานกำหนดแล้ว";
    if (error.code === "uploads_disabled") return "งานนี้ปิดรับรูปแล้ว";
    if (error.code === "photo_limit_reached") return "อัลบั้มนี้เต็มแล้ว";
    if (error.code === "storage_full") return "พื้นที่ของงานนี้เต็มแล้ว";
    if (error.code === "original_too_large") return "ไฟล์ต้นฉบับใหญ่เกินแพ็กเกจ";
    if (error.code === "event_full") return "งานนี้มีแขกครบจำนวนแล้ว";
    if (error.code === "consent_declined") return "ต้องยอมรับนโยบายก่อนอัปโหลด";
    if (error.code === "unsupported_original") return "ชนิดไฟล์ต้นฉบับไม่รองรับ";
    if (error.code === "part_upload_failed") return "อัปต้นฉบับไม่สำเร็จ";
  }
  return "อัปโหลดไม่สำเร็จ";
}

/** Errors that retrying will not fix; such files are dropped from the resume store. */
function isPermanent(error: unknown): boolean {
  if (error instanceof VideoRejected) return true;
  return (
    error instanceof ApiError &&
    ["quota_exceeded", "uploads_disabled", "photo_limit_reached", "storage_full", "event_full", ...Object.keys(VIDEO_ERRORS)].includes(
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
  const inputRef = useRef<HTMLInputElement>(null);
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
      update(id, { status: "error", error: errorMessage(error) });
      if (isPermanent(error)) {
        void removePending(id);
        // Retrying will not help (quota, plan limits): say why once, as a popup.
        showError(errorMessage(error), "อัปโหลดไม่สำเร็จ");
      }
    }
  }

  function pump() {
    while (activeRef.current < CONCURRENCY && queueRef.current.length > 0) {
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

  function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const entries = Array.from(files).map((file) => ({ id: crypto.randomUUID(), file }));
    if (persistKey) persistFiles(persistKey, entries);
    addItems(entries);
    if (inputRef.current) inputRef.current.value = "";
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
      <input
        ref={inputRef}
        type="file"
        accept={target.video ? "image/*,video/mp4,video/quicktime,video/webm" : "image/*"}
        multiple
        hidden
        onChange={(e) => onFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => {
          const openPicker = () => inputRef.current?.click();
          if (!gate || gate(openPicker)) openPicker();
        }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-4 text-lg font-medium text-brand-contrast shadow-lg shadow-black/5 transition hover:opacity-95 active:scale-[0.99]"
      >
        {target.video ? <Video className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
        {label ?? (target.video ? "ถ่าย / เลือกรูปหรือวิดีโอ" : "ถ่ายรูป / เลือกรูปเพื่ออัปโหลด")}
      </button>
      {target.video && (
        <p className="mt-2 text-center text-xs text-muted">
          วิดีโอยาวไม่เกิน {formatLength(target.video.maxDurationSec)} · ไฟล์ไม่เกิน {formatSize(target.video.maxBytes)}
        </p>
      )}

      {items.length > 0 && (
        <div className="mt-3 rounded-xl border border-line p-3">
          {restoredCount > 0 && (
            <p className="mb-1 text-sm text-ink/70">กำลังอัปโหลดต่อ {restoredCount} ไฟล์ที่ค้างจากครั้งก่อน</p>
          )}
          <p className="text-sm text-ink/70">
            อัปโหลดแล้ว {doneCount}/{items.length} ไฟล์
            {inFlight && <span className="text-muted/80"> · อย่าเพิ่งปิดหน้านี้</span>}
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
                          {item.error} · ลองใหม่
                        </button>
                        <button
                          type="button"
                          onClick={() => discard(item.id)}
                          aria-label="เอาออกจากคิว"
                          className="absolute top-0.5 right-1 px-1 text-sm"
                        >
                          ✕
                        </button>
                      </>
                    ) : item.status === "queued" ? (
                      "รอคิว"
                    ) : item.status === "processing" ? (
                      item.isVideo ? "กำลังเตรียมวิดีโอ" : "กำลังย่อรูป"
                    ) : item.status === "original" ? (
                      `ต้นฉบับ ${Math.round((item.progress ?? 0) * 100)}%`
                    ) : item.isVideo ? (
                      `วิดีโอ ${Math.round((item.progress ?? 0) * 100)}%`
                    ) : (
                      "กำลังอัปโหลด"
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
