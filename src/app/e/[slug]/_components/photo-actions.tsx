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
import { useLocale } from "@/lib/use-locale";

const T = {
  en: {
    failed: "Something went wrong. Please try again.",
    preparingMedia: (video: boolean) => (video ? "Preparing video…" : "Preparing photo…"),
    tapToSaveMedia: (video: boolean) => (video ? "Tap to save video" : "Tap to save photo"),
    saved: "Saved",
    saveMedia: (video: boolean) => (video ? "Save video" : "Save photo"),
    preparing: "Preparing…",
    tapToShare: "Tap to share",
    share: "Share",
    shareAlbum: "Share this album",
    shareHint: "Send the link so friends can view and save the event's photos",
    copied: "Copied",
    copyLink: "Copy link",
    close: "Close",
    confirmDelete: (video: boolean) => `Delete this ${video ? "video" : "photo"} for good? It disappears from the event right away.`,
    deleteFailed: "Couldn't delete. Please try again.",
    deleting: "Deleting…",
    deleteMine: (video: boolean) => (video ? "Delete my video" : "Delete my photo"),
    reported: "Request sent. The host will review it.",
    reportFailed: "Couldn't send the report. Please try again.",
    report: "Report / request removal",
    reportTitle: "Tell the host about this photo",
    reasons: { remove_me: "I'm in this photo and want it removed", inappropriate: "Inappropriate photo", other: "Other" } as Record<ReportReason, string>,
    details: "More details (optional)",
    cancel: "Cancel",
    sending: "Sending…",
    send: "Send",
  },
  th: {
    failed: "ทำรายการไม่สำเร็จ ลองอีกครั้ง",
    preparingMedia: (video: boolean) => `กำลังเตรียม${video ? "วิดีโอ" : "รูป"}…`,
    tapToSaveMedia: (video: boolean) => `แตะเพื่อบันทึก${video ? "วิดีโอ" : "รูป"}`,
    saved: "บันทึกแล้ว",
    saveMedia: (video: boolean) => `บันทึก${video ? "วิดีโอ" : "รูป"}`,
    preparing: "กำลังเตรียม…",
    tapToShare: "แตะเพื่อแชร์",
    share: "แชร์",
    shareAlbum: "แชร์อัลบั้มนี้",
    shareHint: "ส่งลิงก์ให้เพื่อนเข้ามาดูและเซฟรูปในงาน",
    copied: "คัดลอกแล้ว",
    copyLink: "คัดลอกลิงก์",
    close: "ปิด",
    confirmDelete: (video: boolean) => {
      const what = video ? "วิดีโอ" : "รูป";
      return `ลบ${what}นี้ถาวร? ${what}จะหายจากหน้างานทันที`;
    },
    deleteFailed: "ลบไม่สำเร็จ ลองอีกครั้ง",
    deleting: "กำลังลบ…",
    deleteMine: (video: boolean) => (video ? "ลบวิดีโอของฉัน" : "ลบรูปของฉัน"),
    reported: "ส่งคำขอแล้ว เจ้าภาพจะตรวจสอบ",
    reportFailed: "ส่งรายงานไม่สำเร็จ ลองอีกครั้ง",
    report: "รายงาน / ขอลบรูป",
    reportTitle: "แจ้งเจ้าภาพเกี่ยวกับรูปนี้",
    reasons: { remove_me: "มีฉันอยู่ในรูป และอยากให้ลบออก", inappropriate: "รูปไม่เหมาะสม", other: "อื่น ๆ" } as Record<ReportReason, string>,
    details: "รายละเอียดเพิ่มเติม (ไม่บังคับ)",
    cancel: "ยกเลิก",
    sending: "กำลังส่ง…",
    send: "ส่ง",
  },
};

const buttonClass = "rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium hover:bg-white/20 disabled:opacity-50";

type Phase = "idle" | "working" | "tap-again" | "done";

/** A media action that may need the file first; if the browser drops the tap meanwhile, asks for one more. */
function useMediaAction(photo: PublicPhoto, run: (file: File) => Promise<unknown>) {
  const t = T[useLocale()];
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
        showError(t.failed);
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
  const t = T[useLocale()];
  const { phase, trigger } = useMediaAction(photo, (file) => saveToDevice([file]));
  const video = photo.kind === "video";
  return (
    <button type="button" onClick={trigger} disabled={phase === "working"} className={`${buttonClass} inline-flex items-center gap-2`}>
      {phase === "done" ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      {phase === "working"
        ? t.preparingMedia(video)
        : phase === "tap-again"
          ? t.tapToSaveMedia(video)
          : phase === "done"
            ? t.saved
            : t.saveMedia(video)}
    </button>
  );
}

/** Shares the file itself (LINE, Messenger, IG…) with a link to the album; falls back to share links. */
export function ShareMediaButton({ photo, info }: { photo: PublicPhoto; info: ShareInfo }) {
  const t = T[useLocale()];
  const [fallback, setFallback] = useState(false);
  const { phase, trigger } = useMediaAction(photo, async (file) => {
    if ((await shareMedia([file], info)) === "unsupported") setFallback(true);
  });
  return (
    <>
      <button type="button" onClick={trigger} disabled={phase === "working"} className={`${buttonClass} inline-flex items-center gap-2`}>
        <Share2 className="h-4 w-4" />
        {phase === "working" ? t.preparing : phase === "tap-again" ? t.tapToShare : t.share}
      </button>
      {fallback && <ShareSheet info={info} onClose={() => setFallback(false)} />}
    </>
  );
}

/** For browsers without a share sheet: LINE, Facebook or copy the album link. */
export function ShareSheet({ info, onClose }: { info: ShareInfo; onClose: () => void }) {
  const t = T[useLocale()];
  const [copied, setCopied] = useState(false);
  const item = "flex flex-col items-center gap-1.5 rounded-2xl px-3 py-3 text-xs font-medium hover:bg-surface";
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl bg-card p-5 text-ink shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t.share}
      >
        <p className="font-semibold">{t.shareAlbum}</p>
        <p className="mt-0.5 text-xs text-muted">{t.shareHint}</p>
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
            {copied ? t.copied : t.copyLink}
          </button>
        </div>
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-surface px-4 py-2.5 text-sm font-medium">
          {t.close}
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
  const t = T[useLocale()];
  const [pending, setPending] = useState(false);
  async function remove() {
    if (!window.confirm(t.confirmDelete(photo.kind === "video"))) return;
    setPending(true);
    try {
      await deleteMyPhoto(slug, photo.id);
      onDeleted(photo.id);
    } catch {
      showError(t.deleteFailed);
    } finally {
      setPending(false);
    }
  }
  return (
    <button type="button" onClick={remove} disabled={pending} className={buttonClass}>
      {pending ? t.deleting : t.deleteMine(photo.kind === "video")}
    </button>
  );
}

const REASONS: ReportReason[] = ["remove_me", "inappropriate", "other"];

export function ReportPhotoButton({
  slug,
  photo,
  ensureSession,
}: {
  slug: string;
  photo: PublicPhoto;
  ensureSession: () => Promise<unknown>;
}) {
  const t = T[useLocale()];
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("remove_me");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [reportedId, setReportedId] = useState<string | null>(null);

  if (reportedId === photo.id) {
    return <span className="px-3 py-2.5 text-sm text-white/70">{t.reported}</span>;
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
      showError(t.reportFailed);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass}>
        {t.report}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setOpen(false)}>
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-3 rounded-t-2xl bg-card p-5 text-ink sm:rounded-2xl"
          >
            <h2 className="text-lg font-semibold">{t.reportTitle}</h2>
            {REASONS.map((value) => ({ value, label: t.reasons[value] })).map((r) => (
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
              placeholder={t.details}
              className="w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 bg-transparent placeholder:text-muted"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-line py-3 bg-transparent placeholder:text-muted">
                {t.cancel}
              </button>
              <button
                disabled={state === "sending"}
                className="flex-1 rounded-xl bg-brand py-3 font-medium text-brand-contrast disabled:opacity-50"
              >
                {state === "sending" ? t.sending : t.send}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
