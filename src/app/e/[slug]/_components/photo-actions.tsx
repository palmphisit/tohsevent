"use client";

import { useEffect, useState } from "react";
import { reportPhoto, type PublicPhoto, type ReportReason } from "@/lib/api-client";

const buttonClass = "rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium hover:bg-white/20 disabled:opacity-50";

/**
 * Saves the photo to the device. On phones the share sheet offers "Save Image" (to the
 * Photos app on iOS); elsewhere it downloads. The blob is fetched as soon as the photo is
 * shown, because iOS only allows `navigator.share` right after a tap.
 */
export function SavePhotoButton({ photo }: { photo: PublicPhoto }) {
  const [loaded, setLoaded] = useState<{ id: string; blob: Blob } | null>(null);
  const blob = loaded?.id === photo.id ? loaded.blob : null;

  useEffect(() => {
    let cancelled = false;
    fetch(photo.displayUrl)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((b) => !cancelled && setLoaded({ id: photo.id, blob: b }))
      .catch(() => {}); // fall back to opening the image on tap
    return () => {
      cancelled = true;
    };
  }, [photo.id, photo.displayUrl]);

  async function save() {
    if (!blob) {
      window.open(photo.displayUrl, "_blank", "noopener");
      return;
    }
    const file = new File([blob], `tohsevent-${photo.id}.jpg`, { type: blob.type || "image/jpeg" });
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (isTouch && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <button type="button" onClick={save} className={buttonClass}>
      เซฟรูป
    </button>
  );
}

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "remove_me", label: "มีฉันอยู่ในรูป และอยากให้ลบออก" },
  { value: "inappropriate", label: "รูปไม่เหมาะสม" },
  { value: "other", label: "อื่น ๆ" },
];

export function ReportPhotoButton({
  slug,
  photo,
  ensureSession,
}: {
  slug: string;
  photo: PublicPhoto;
  ensureSession: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("remove_me");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [reportedId, setReportedId] = useState<string | null>(null);

  if (reportedId === photo.id) {
    return <span className="px-3 py-2.5 text-sm text-white/70">ส่งคำขอแล้ว เจ้าภาพจะตรวจสอบ</span>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      await ensureSession();
      await reportPhoto(slug, photo.id, { reason, note: note || undefined });
      setReportedId(photo.id);
      setOpen(false);
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass}>
        รายงาน / ขอลบรูป
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setOpen(false)}>
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-3 rounded-t-2xl bg-white p-5 text-zinc-900 sm:rounded-2xl"
          >
            <h2 className="text-lg font-semibold">แจ้งเจ้าภาพเกี่ยวกับรูปนี้</h2>
            {REASONS.map((r) => (
              <label key={r.value} className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3">
                <input
                  type="radio"
                  name="reason"
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="accent-zinc-900"
                />
                <span>{r.label}</span>
              </label>
            ))}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-zinc-900"
            />
            {state === "error" && <p className="text-sm text-red-600">ส่งไม่สำเร็จ ลองอีกครั้ง</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-zinc-300 py-3">
                ยกเลิก
              </button>
              <button
                disabled={state === "sending"}
                className="flex-1 rounded-xl bg-brand py-3 font-medium text-brand-contrast disabled:opacity-50"
              >
                {state === "sending" ? "กำลังส่ง…" : "ส่ง"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
