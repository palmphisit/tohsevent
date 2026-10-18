"use client";

import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  completeUpload,
  putToStorage,
  reserveUpload,
  type GuestSession,
  type PublicPhoto,
} from "@/lib/api-client";
import { prepareImage, type PreparedImage } from "@/lib/image";
import type { PresignedUpload } from "@/server/services/photos";

const CONCURRENCY = 2;
// Presigned URLs live 10 minutes; re-reserve a little before that on retry.
const RESERVATION_TTL_MS = 8 * 60 * 1000;

type Status = "queued" | "processing" | "uploading" | "done" | "error";

interface QueueItem {
  id: string;
  file: File;
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
  }
  return "อัปโหลดไม่สำเร็จ";
}

/**
 * Runs the 3-step upload for one item, resuming from whatever a previous attempt
 * already finished (resized image, unexpired reservation).
 */
async function uploadItem(slug: string, item: QueueItem, update: (patch: Partial<QueueItem>) => void) {
  let { image, reservation } = item;
  if (!image) {
    update({ status: "processing", error: undefined });
    image = await prepareImage(item.file);
    update({ image, previewUrl: URL.createObjectURL(image.thumb) });
  }

  update({ status: "uploading", error: undefined });
  if (!reservation || Date.now() - reservation.at > RESERVATION_TTL_MS) {
    reservation = { data: await reserveUpload(slug, image), at: Date.now() };
    update({ reservation });
  }

  await putToStorage(reservation.data, image);
  const { photo } = await completeUpload(slug, reservation.data.photoId);
  return photo;
}

export function Uploader({
  slug,
  ensureSession,
  onUploaded,
}: {
  slug: string;
  ensureSession: () => Promise<GuestSession>;
  onUploaded: (photo: PublicPhoto) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const itemsRef = useRef(new Map<string, QueueItem>());
  const queueRef = useRef<string[]>([]);
  const activeRef = useRef(0);
  const callbacks = useRef({ ensureSession, onUploaded });
  useEffect(() => {
    callbacks.current = { ensureSession, onUploaded };
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
      await callbacks.current.ensureSession();
      const photo = await uploadItem(slug, itemsRef.current.get(id)!, (patch) => update(id, patch));
      update(id, { status: "done", image: undefined, reservation: undefined });
      callbacks.current.onUploaded(photo);
    } catch (error) {
      console.error("upload failed", error);
      update(id, { status: "error", error: errorMessage(error) });
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

  function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const ids = Array.from(files).map((file) => {
      const id = crypto.randomUUID();
      itemsRef.current.set(id, { id, file, status: "queued" });
      return id;
    });
    setItems(Array.from(itemsRef.current.values()));
    enqueue(ids);
    if (inputRef.current) inputRef.current.value = "";
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
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-xl bg-zinc-900 px-4 py-4 text-lg font-medium text-white active:scale-[0.99]"
      >
        ถ่ายรูป / เลือกรูปเพื่ออัปโหลด
      </button>

      {items.length > 0 && (
        <div className="mt-3 rounded-xl border border-zinc-200 p-3">
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
                      <button type="button" onClick={() => retry(item.id)} className="underline">
                        {item.error} · ลองใหม่
                      </button>
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
