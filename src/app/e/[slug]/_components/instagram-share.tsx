"use client";

import { Camera, ImagePlus, Loader2, MonitorPlay, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { InstagramIcon } from "@/components/instagram-icon";
import { uploadErrorMessage, uploadSinglePhoto, type UploadTarget } from "@/components/uploader";
import { ApiError, reserveUpload, type PublicPhoto } from "@/lib/api-client";
import { showError } from "@/lib/error-popup";
import { useLocale } from "@/lib/use-locale";

const T = {
  en: {
    title: "Put your photo on the big screen",
    text: "Take or choose a photo, add your Instagram and it pops up on the venue screen.",
    open: "Share to the screen",
    sheetTitle: "Share to the big screen",
    choose: "Choose a photo",
    take: "Take a photo",
    change: "Change photo",
    handle: "Your Instagram",
    note: "The photo pops up once on the venue screen with your @ for everyone to see. It isn't added to the album; only the organizer keeps a copy.",
    send: "Share to the screen",
    uploading: (pct: number) => `Uploading ${pct}%`,
    doneTitle: "Look at the screen!",
    doneText: (h: string) => `Your photo with @${h} pops up in a few seconds.`,
    doneReview: (h: string) => `Your photo with @${h} pops up once the organizer has checked it.`,
    another: "Share another",
    close: "Close",
    errors: {
      invalid_instagram: "Please enter a valid Instagram username",
      ig_share_cooldown: "You just shared. Please wait a moment and try again.",
      ig_share_off: "Sharing to the screen is closed right now",
      ig_share_one_photo: "Please share one photo at a time",
    } as Record<string, string>,
    failed: "Couldn't share. Please try again.",
  },
  th: {
    title: "แชร์รูปขึ้นจอใหญ่ในงาน",
    text: "ถ่ายหรือเลือกรูป ใส่ Instagram แล้วรูปจะเด้งขึ้นกลางจอในงาน",
    open: "แชร์ขึ้นจอ",
    sheetTitle: "แชร์ขึ้นจอใหญ่",
    choose: "เลือกรูป",
    take: "ถ่ายรูป",
    change: "เปลี่ยนรูป",
    handle: "Instagram ของคุณ",
    note: "รูปจะเด้งขึ้นจอพร้อม @ ของคุณ 1 ครั้งให้ทุกคนในงานเห็น ไม่เข้าอัลบั้มของงาน และมีเพียงผู้จัดงานที่เก็บประวัติไว้",
    send: "แชร์ขึ้นจอ",
    uploading: (pct: number) => `กำลังอัปโหลด ${pct}%`,
    doneTitle: "ดูที่จอได้เลย!",
    doneText: (h: string) => `รูปของคุณพร้อม @${h} จะเด้งขึ้นจอในไม่กี่วินาที`,
    doneReview: (h: string) => `รูปของคุณพร้อม @${h} จะขึ้นจอหลังผู้จัดงานตรวจรูปแล้ว`,
    another: "แชร์อีกรูป",
    close: "ปิด",
    errors: {
      invalid_instagram: "กรุณากรอกชื่อผู้ใช้ Instagram ให้ถูกต้อง",
      ig_share_cooldown: "เพิ่งแชร์ไป รอสักครู่แล้วลองอีกครั้ง",
      ig_share_off: "ตอนนี้ปิดการแชร์ขึ้นจอแล้ว",
      ig_share_one_photo: "แชร์ได้ทีละ 1 รูป",
    } as Record<string, string>,
    failed: "แชร์ไม่สำเร็จ ลองอีกครั้ง",
  },
};

const HANDLE_KEY = "tohs:instagram";
const HANDLE = /^(?!.*\.\.)(?!\.)[A-Za-z0-9._]{1,30}(?<!\.)$/;

function cleanHandle(input: string): string {
  return input
    .trim()
    .replace(/^@+/, "")
    .replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, "")
    .replace(/[/?].*$/, "");
}

function savedHandle(): string {
  try {
    return localStorage.getItem(HANDLE_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Guest side of "Instagram share": take or choose a photo right now and enter @. The photo is
 * uploaded for the venue screen only (popped up once, kept out of the album; the host has a copy).
 */
export function InstagramShare({
  slug,
  target,
}: {
  slug: string;
  /** The guest page's upload target (joins the event, asks for consent first). */
  target: UploadTarget;
}) {
  const t = T[useLocale()];
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="mt-6 rounded-3xl bg-gradient-to-tr from-amber-300 via-pink-500 to-violet-600 p-[2px] shadow-sm">
        <div className="flex items-center gap-3 rounded-[calc(1.5rem-2px)] bg-card p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-300 via-pink-500 to-violet-600 text-white">
            <InstagramIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t.title}</p>
            <p className="text-sm text-muted">{t.text}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-b-[calc(1.5rem-2px)] px-4 py-3 text-sm font-semibold text-white"
        >
          <MonitorPlay className="h-4 w-4" /> {t.open}
        </button>
      </section>
      {open && <ShareSheet slug={slug} target={target} onClose={() => setOpen(false)} />}
    </>
  );
}

type Step = { kind: "form" } | { kind: "uploading"; progress: number } | { kind: "done"; handle: string; review: boolean };

function ShareSheet({ slug, target, onClose }: { slug: string; target: UploadTarget; onClose: () => void }) {
  const locale = useLocale();
  const t = T[locale];
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [handle, setHandle] = useState(savedHandle);
  const [step, setStep] = useState<Step>({ kind: "form" });

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function pick(input: HTMLInputElement) {
    const next = input.files?.[0];
    input.value = "";
    if (!next) return;
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setStep({ kind: "form" });
  }

  const clean = cleanHandle(handle);
  const valid = HANDLE.test(clean);
  const busy = step.kind === "uploading";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !valid || busy) return;
    // Same pipeline as any upload, but reserved as an Instagram share (the server pops it up once).
    const shareTarget: UploadTarget = { ...target, reserve: (image) => reserveUpload(slug, image, clean) };
    let photo: PublicPhoto;
    try {
      setStep({ kind: "uploading", progress: 0 });
      photo = await uploadSinglePhoto(shareTarget, file, (progress) => setStep({ kind: "uploading", progress }));
    } catch (err) {
      setStep({ kind: "form" });
      showError((err instanceof ApiError && t.errors[err.code]) || uploadErrorMessage(err, locale) || t.failed);
      return;
    }
    try {
      localStorage.setItem(HANDLE_KEY, clean);
    } catch {
      // Private mode: the guest types it again next time.
    }
    setStep({ kind: "done", handle: clean, review: !!photo.pendingReview });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.sheetTitle}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 text-ink shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <InstagramIcon className="h-5 w-5 text-pink-500" /> {t.sheetTitle}
          </h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t.close} className="rounded-full p-1.5 text-muted hover:bg-surface">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step.kind === "done" ? (
          <div className="flex flex-col items-center py-8 text-center">
            <span className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-gradient-to-tr from-amber-300 via-pink-500 to-violet-600 text-3xl">
              🎉
            </span>
            <p className="mt-4 text-xl font-semibold">{t.doneTitle}</p>
            <p className="mt-1 text-sm text-muted">{step.review ? t.doneReview(step.handle) : t.doneText(step.handle)}</p>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={reset} className="rounded-xl bg-surface px-5 py-2.5 text-sm font-medium">
                {t.another}
              </button>
              <button type="button" onClick={onClose} className="rounded-xl bg-surface px-5 py-2.5 text-sm font-medium">
                {t.close}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={send} className="mt-4 space-y-4">
            <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.currentTarget)} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.currentTarget)} />
            {preview ? (
              <div className="relative overflow-hidden rounded-2xl bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the picked file */}
                <img src={preview} alt="" className="mx-auto max-h-72 w-full object-contain" />
                {!busy && (
                  <button
                    type="button"
                    onClick={() => galleryRef.current?.click()}
                    className="absolute right-2 bottom-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> {t.change}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-pink-300 bg-pink-50/50 text-sm font-medium text-pink-600"
                >
                  <ImagePlus className="h-7 w-7" /> {t.choose}
                </button>
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/50 text-sm font-medium text-violet-600"
                >
                  <Camera className="h-7 w-7" /> {t.take}
                </button>
              </div>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t.handle}</span>
              <span className="flex items-center rounded-xl border border-line px-3 focus-within:border-pink-500">
                <span className="text-lg text-muted">@</span>
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.replace(/^@+/, ""))}
                  maxLength={80}
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="off"
                  disabled={busy}
                  placeholder="your.instagram"
                  className="w-full bg-transparent px-1 py-3 text-base outline-none placeholder:text-muted"
                />
              </span>
            </label>
            <p className="text-xs text-muted">{t.note}</p>

            <button
              type="submit"
              disabled={!file || !valid || busy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600 px-4 py-3.5 font-semibold text-white shadow-lg transition active:scale-[0.99] disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <MonitorPlay className="h-5 w-5" />}
              {step.kind === "uploading" ? t.uploading(Math.round(step.progress * 100)) : t.send}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
