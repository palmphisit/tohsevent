"use client";

import { Check, Download, Link2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { deleteMyPhoto, reportPhoto, type PublicPhoto, type ReportReason } from "@/lib/api-client";
import { showError } from "@/lib/error-popup";
import {
  facebookShareUrl,
  GestureRequired,
  lineShareUrl,
  mediaFile,
  prefetchMedia,
  saveToDevice,
  shareMedia,
  type ShareInfo,
} from "@/lib/save-share";

const buttonClass = "rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium hover:bg-white/20 disabled:opacity-50";

type Phase = "idle" | "working" | "tap-again" | "done";

/** A media action that may need the file first; if the browser drops the tap meanwhile, asks for one more. */
function useMediaAction(photo: PublicPhoto, run: (file: File) => Promise<unknown>) {
  const [phase, setPhase] = useState<Phase>("idle");
  useEffect(() => {
    // Photos are small: fetch now so the share sheet opens straight from the tap.
    if (photo.kind !== "video") prefetchMedia(photo);
  }, [photo]);

  async function trigger() {
    setPhase("working");
    try {
      await run(await mediaFile(photo));
      setPhase("done");
      setTimeout(() => setPhase("idle"), 2000);
    } catch (error) {
      if (error instanceof GestureRequired) setPhase("tap-again");
      else {
        setPhase("idle");
        showError("ทำรายการไม่สำเร็จ ลองอีกครั้ง");
      }
    }
  }
  return { phase, trigger };
}

/**
 * Saves the photo or video to the phone: iPhone/iPad open the share sheet ("Save Image" /
 * "Save Video" puts it in Photos); Android and computers download it to the device.
 */
export function SaveMediaButton({ photo }: { photo: PublicPhoto }) {
  const { phase, trigger } = useMediaAction(photo, (file) => saveToDevice([file]));
  const what = photo.kind === "video" ? "วิดีโอ" : "รูป";
  return (
    <button type="button" onClick={trigger} disabled={phase === "working"} className={`${buttonClass} inline-flex items-center gap-2`}>
      {phase === "done" ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      {phase === "working"
        ? `กำลังเตรียม${what}…`
        : phase === "tap-again"
          ? `แตะเพื่อบันทึก${what}`
          : phase === "done"
            ? "บันทึกแล้ว"
            : `บันทึก${what}`}
    </button>
  );
}

/** Shares the file itself (LINE, Messenger, IG…) with a link to the album; falls back to share links. */
export function ShareMediaButton({ photo, info }: { photo: PublicPhoto; info: ShareInfo }) {
  const [fallback, setFallback] = useState(false);
  const { phase, trigger } = useMediaAction(photo, async (file) => {
    if ((await shareMedia([file], info)) === "unsupported") setFallback(true);
  });
  return (
    <>
      <button type="button" onClick={trigger} disabled={phase === "working"} className={`${buttonClass} inline-flex items-center gap-2`}>
        <Share2 className="h-4 w-4" />
        {phase === "working" ? "กำลังเตรียม…" : phase === "tap-again" ? "แตะเพื่อแชร์" : "แชร์"}
      </button>
      {fallback && <ShareSheet info={info} onClose={() => setFallback(false)} />}
    </>
  );
}

/** For browsers without a share sheet: LINE, Facebook or copy the album link. */
export function ShareSheet({ info, onClose }: { info: ShareInfo; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const item = "flex flex-col items-center gap-1.5 rounded-2xl px-3 py-3 text-xs font-medium hover:bg-surface";
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl bg-card p-5 text-ink shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="แชร์"
      >
        <p className="font-semibold">แชร์อัลบั้มนี้</p>
        <p className="mt-0.5 text-xs text-muted">ส่งลิงก์ให้เพื่อนเข้ามาดูและเซฟรูปในงาน</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <a href={lineShareUrl(info)} target="_blank" rel="noopener" className={item}>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#06C755] text-sm font-bold text-white">LINE</span>
            LINE
          </a>
          <a href={facebookShareUrl(info)} target="_blank" rel="noopener" className={item}>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#1877F2] text-lg font-bold text-white">f</span>
            Facebook
          </a>
          <button
            type="button"
            className={item}
            onClick={async () => {
              await navigator.clipboard.writeText(info.url);
              setCopied(true);
            }}
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-surface text-ink">
              {copied ? <Check className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
            </span>
            {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
          </button>
        </div>
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-surface px-4 py-2.5 text-sm font-medium">
          ปิด
        </button>
      </div>
    </div>
  );
}

/** Shown only on the guest's own uploads: removes the photo and its files right away. */
export function DeleteMyPhotoButton({
  slug,
  photo,
  onDeleted,
}: {
  slug: string;
  photo: PublicPhoto;
  onDeleted: (photoId: string) => void;
}) {
  const [pending, setPending] = useState(false);
  async function remove() {
    const what = photo.kind === "video" ? "วิดีโอ" : "รูป";
    if (!window.confirm(`ลบ${what}นี้ถาวร? ${what}จะหายจากหน้างานทันที`)) return;
    setPending(true);
    try {
      await deleteMyPhoto(slug, photo.id);
      onDeleted(photo.id);
    } catch {
      showError("ลบไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setPending(false);
    }
  }
  return (
    <button type="button" onClick={remove} disabled={pending} className={buttonClass}>
      {pending ? "กำลังลบ…" : photo.kind === "video" ? "ลบวิดีโอของฉัน" : "ลบรูปของฉัน"}
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
      setState("idle");
      showError("ส่งรายงานไม่สำเร็จ ลองอีกครั้ง");
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
            className="w-full max-w-md space-y-3 rounded-t-2xl bg-card p-5 text-ink sm:rounded-2xl"
          >
            <h2 className="text-lg font-semibold">แจ้งเจ้าภาพเกี่ยวกับรูปนี้</h2>
            {REASONS.map((r) => (
              <label key={r.value} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 bg-transparent placeholder:text-muted">
                <input
                  type="radio"
                  name="reason"
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="accent-primary"
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
              className="w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 bg-transparent placeholder:text-muted"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-line py-3 bg-transparent placeholder:text-muted">
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
