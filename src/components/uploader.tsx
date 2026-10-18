"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, putToStorage, type PublicPhoto } from "@/lib/api-client";
import { prepareImage, type PreparedImage } from "@/lib/image";
import { listPending, removePending, savePending } from "@/lib/upload-store";
import type { PresignedUpload } from "@/server/services/photos";

const CONCURRENCY = 2;
// Presigned URLs live 10 minutes; re-reserve a little before that on retry.
const RESERVATION_TTL_MS = 8 * 60 * 1000;

type Status = "queued" | "processing" | "uploading" | "done" | "error";

interface QueueItem {
  id: string;
  file: Blob;
  status: Status;
  error?: string;
  previewUrl?: string;
  image?: PreparedImage;
  reservation?: { data: PresignedUpload; at: number };
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "quota_exceeded") return "อัปโหลดครบจำนวนที่งานกำหนดแล้ว";
    if (error.code === "uploads_disabled") return "งานนี้ปิดรับรูปแล้ว";
    if (error.code === "photo_limit_reached") return "อัลบั้มนี้เต็มแล้ว";
    if (error.code === "event_full") return "งานนี้มีแขกครบจำนวนแล้ว";
    if (error.code === "consent_declined") return "ต้องยอมรับนโยบายก่อนอัปโหลด";
  }
  return "อัปโหลดไม่สำเร็จ";
}

/** Errors that retrying will not fix; such files are dropped from the resume store. */
function isPermanent(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    ["quota_exceeded", "uploads_disabled", "photo_limit_reached", "event_full"].includes(error.code)
  );
}

function persistFiles(scope: string, entries: { id: string; file: File }[]) {
  const addedAt = Date.now();
  entries.forEach((e, i) => void savePending({ id: e.id, scope, file: e.file, name: e.file.name, addedAt: addedAt + i }));
}

/** Endpoints for one upload target (guest page or host dashboard); the flow is the same. */
export interface UploadTarget {
  /** Runs before each upload, e.g. to join the event as a guest. */
  prepare?: () => Promise<unknown>;
  /** Also produce a watermarked copy (events on the Free plan). */
  watermark?: boolean;
  reserve: (image: PreparedImage) => Promise<PresignedUpload>;
  complete: (photoId: string) => Promise<PublicPhoto>;
}

/**
 * Runs the 3-step upload for one item, resuming from whatever a previous attempt
 * already finished (resized image, unexpired reservation).
 */
async function uploadItem(target: UploadTarget, item: QueueItem, update: (patch: Partial<QueueItem>) => void) {
  let { image, reservation } = item;
  if (!image) {
    update({ status: "processing", error: undefined });
    image = await prepareImage(item.file, { watermark: target.watermark });
    update({ image, previewUrl: URL.createObjectURL(image.thumb) });
  }

  update({ status: "uploading", error: undefined });
  if (!reservation || Date.now() - reservation.at > RESERVATION_TTL_MS) {
    reservation = { data: await target.reserve(image), at: Date.now() };
    update({ reservation });
  }

  await putToStorage(reservation.data, image);
  return target.complete(reservation.data.photoId);
}

/** Multi-file photo uploader: resizes in the browser and uploads straight to storage. */
export function Uploader({
  target,
  onUploaded,
  persistKey,
  gate,
  label = "ถ่ายรูป / เลือกรูปเพื่ออัปโหลด",
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

  const inFlight = items.some((i) => i.status === "queued" || i.status === "processing" || i.status === "uploading");
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
      const photo = await uploadItem(target, itemsRef.current.get(id)!, (patch) => update(id, patch));
      update(id, { status: "done", image: undefined, reservation: undefined });
      void removePending(id);
      callbacks.current.onUploaded(photo);
    } catch (error) {
      console.error("upload failed", error);
      update(id, { status: "error", error: errorMessage(error) });
      if (isPermanent(error)) void removePending(id);
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

  function addItems(entries: { id: string; file: Blob }[]) {
    const ids = entries
      .filter((entry) => !itemsRef.current.has(entry.id))
      .map(({ id, file }) => {
        itemsRef.current.set(id, { id, file, status: "queued" });
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
        accept="image/*"
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
        className="w-full rounded-xl bg-brand px-4 py-4 text-lg font-medium text-brand-contrast active:scale-[0.99]"
      >
        {label}
      </button>

      {items.length > 0 && (
        <div className="mt-3 rounded-xl border border-zinc-200 p-3">
          {restoredCount > 0 && (
            <p className="mb-1 text-sm text-zinc-600">กำลังอัปโหลดต่อ {restoredCount} รูปที่ค้างจากครั้งก่อน</p>
          )}
          <p className="text-sm text-zinc-600">
            อัปโหลดแล้ว {doneCount}/{items.length} รูป
            {inFlight && <span className="text-zinc-400"> · อย่าเพิ่งปิดหน้านี้</span>}
          </p>
          {pendingItems.length > 0 && (
            <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {pendingItems.map((item) => (
                <li key={item.id} className="relative aspect-square overflow-hidden rounded-lg bg-zinc-100">
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
                      "กำลังย่อรูป"
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
