"use client";

import { Check, Loader2, MonitorPlay, X } from "lucide-react";
import { useEffect, useState } from "react";
import { InstagramIcon } from "@/components/instagram-icon";
import { ApiError, listShareablePhotos, sendInstagramShare, type GuestSession, type PublicPhoto } from "@/lib/api-client";
import { showError } from "@/lib/error-popup";
import { useLocale } from "@/lib/use-locale";

const T = {
  en: {
    title: "Put your photo on the big screen",
    text: "Pick one of your photos, add your Instagram and it pops up on the venue screen.",
    open: "Share to the screen",
    sheetTitle: "Share to the big screen",
    pick: "Choose one of your photos",
    none: "Upload a photo first, then come back to share it.",
    handle: "Your Instagram",
    note: "Your photo and @ will be shown on the venue screen for everyone at the event.",
    send: "Share to the screen",
    sending: "Sharing…",
    doneTitle: "Look at the screen!",
    doneText: (h: string) => `Your photo with @${h} pops up in a few seconds.`,
    close: "Close",
    errors: {
      invalid_instagram: "Please enter a valid Instagram username",
      ig_share_cooldown: "You just shared. Please wait a moment and try again.",
      ig_share_off: "Sharing to the screen is closed right now",
      photo_not_found: "This photo is no longer available",
      consent_declined: "Please accept the policy first",
    } as Record<string, string>,
    failed: "Couldn't share. Please try again.",
  },
  th: {
    title: "แชร์รูปขึ้นจอใหญ่ในงาน",
    text: "เลือกรูปของคุณ ใส่ Instagram แล้วรูปจะเด้งขึ้นกลางจอในงาน",
    open: "แชร์ขึ้นจอ",
    sheetTitle: "แชร์ขึ้นจอใหญ่",
    pick: "เลือกรูปของคุณ 1 รูป",
    none: "อัปโหลดรูปก่อน แล้วกลับมาแชร์ขึ้นจอได้เลย",
    handle: "Instagram ของคุณ",
    note: "รูปและ @ ของคุณจะแสดงบนจอในงานให้ทุกคนเห็น",
    send: "แชร์ขึ้นจอ",
    sending: "กำลังแชร์…",
    doneTitle: "ดูที่จอได้เลย!",
    doneText: (h: string) => `รูปของคุณพร้อม @${h} จะเด้งขึ้นจอในไม่กี่วินาที`,
    close: "ปิด",
    errors: {
      invalid_instagram: "กรุณากรอกชื่อผู้ใช้ Instagram ให้ถูกต้อง",
      ig_share_cooldown: "เพิ่งแชร์ไป รอสักครู่แล้วลองอีกครั้ง",
      ig_share_off: "ตอนนี้ปิดการแชร์ขึ้นจอแล้ว",
      photo_not_found: "รูปนี้ไม่มีแล้ว",
      consent_declined: "ต้องยอมรับนโยบายก่อน",
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

/** Guest side of "Instagram share": pick an own photo, enter @, pop it up on the slideshow. */
export function InstagramShare({ slug, ensureSession }: { slug: string; ensureSession: () => Promise<GuestSession> }) {
  const t = T[useLocale()];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      await ensureSession();
      setOpen(true);
    } catch (err) {
      showError((err instanceof ApiError && t.errors[err.code]) || t.failed);
    } finally {
      setLoading(false);
    }
  }

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
          onClick={start}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-b-[calc(1.5rem-2px)] px-4 py-3 text-sm font-semibold text-white"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorPlay className="h-4 w-4" />} {t.open}
        </button>
      </section>
      {open && <ShareSheet slug={slug} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareSheet({ slug, onClose }: { slug: string; onClose: () => void }) {
  const t = T[useLocale()];
  const [photos, setPhotos] = useState<PublicPhoto[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [handle, setHandle] = useState(savedHandle);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const failedText = t.failed;

  useEffect(() => {
    let cancelled = false;
    listShareablePhotos(slug)
      .then(({ items }) => {
        if (cancelled) return;
        setPhotos(items);
        setSelected(items[0]?.id ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setPhotos([]);
        showError(failedText);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, failedText]);

  const clean = cleanHandle(handle);
  const valid = HANDLE.test(clean);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !valid) return;
    setSending(true);
    try {
      const { instagram } = await sendInstagramShare(slug, { photoId: selected, instagram: clean });
      try {
        localStorage.setItem(HANDLE_KEY, instagram);
      } catch {
        // Private mode: the guest types it again next time.
      }
      setDone(instagram);
    } catch (err) {
      showError((err instanceof ApiError && t.errors[err.code]) || t.failed);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
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
          <button type="button" onClick={onClose} aria-label={t.close} className="rounded-full p-1.5 text-muted hover:bg-surface">
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center py-8 text-center">
            <span className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-gradient-to-tr from-amber-300 via-pink-500 to-violet-600 text-3xl">
              🎉
            </span>
            <p className="mt-4 text-xl font-semibold">{t.doneTitle}</p>
            <p className="mt-1 text-sm text-muted">{t.doneText(done)}</p>
            <button type="button" onClick={onClose} className="mt-6 rounded-xl bg-surface px-5 py-2.5 text-sm font-medium">
              {t.close}
            </button>
          </div>
        ) : (
          <form onSubmit={send} className="mt-4 space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">{t.pick}</p>
              {photos === null ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="aspect-square animate-pulse rounded-xl bg-surface" />
                  ))}
                </div>
              ) : photos.length === 0 ? (
                <p className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-muted">{t.none}</p>
              ) : (
                <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto p-0.5">
                  {photos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setSelected(photo.id)}
                      aria-pressed={selected === photo.id}
                      className={`relative aspect-square overflow-hidden rounded-xl transition ${
                        selected === photo.id ? "ring-3 ring-pink-500 ring-offset-2 ring-offset-card" : "opacity-80"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN */}
                      <img src={photo.thumbUrl} alt="" className="h-full w-full object-cover" />
                      {selected === photo.id && (
                        <span className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-pink-500 text-white">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

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
                  placeholder="your.instagram"
                  className="w-full bg-transparent px-1 py-3 text-base outline-none placeholder:text-muted"
                />
              </span>
            </label>
            <p className="text-xs text-muted">{t.note}</p>

            <button
              type="submit"
              disabled={!selected || !valid || sending}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600 px-4 py-3.5 font-semibold text-white shadow-lg transition active:scale-[0.99] disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <MonitorPlay className="h-5 w-5" />}
              {sending ? t.sending : t.send}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
