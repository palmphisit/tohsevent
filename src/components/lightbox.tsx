"use client";

import { useEffect, useRef } from "react";
import type { PublicPhoto } from "@/lib/api-client";
import { useLocale } from "@/lib/use-locale";

const T = {
  en: {
    close: "Close",
    prev: "Previous photo",
    next: "Next photo",
  },
  th: {
    close: "ปิด",
    prev: "รูปก่อนหน้า",
    next: "รูปถัดไป",
  },
};


/** Full-screen photo/video viewer with keyboard and swipe navigation. */
export function Lightbox<P extends PublicPhoto>({
  photos,
  index,
  onClose,
  onNavigate,
  actions,
}: {
  photos: P[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  actions?: (photo: P) => React.ReactNode;
}) {
  const photo = photos[index];
  const t = T[useLocale()];
  const touchStartX = useRef<number | null>(null);
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onNavigate(index - 1);
      if (e.key === "ArrowRight" && hasNext) onNavigate(index + 1);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, hasPrev, hasNext, onClose, onNavigate]);

  if (!photo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (dx > 60 && hasPrev) onNavigate(index - 1);
        if (dx < -60 && hasNext) onNavigate(index + 1);
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <span className="text-white/70">
          {index + 1} / {photos.length}
          {photo.uploaderName && <span> · {photo.uploaderName}</span>}
        </span>
        <button type="button" onClick={onClose} className="rounded-full px-3 py-1 hover:bg-white/10" aria-label={t.close}>
          ✕
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        {photo.videoUrl ? (
          <video
            key={photo.id}
            src={photo.videoUrl}
            poster={photo.posterFallback ? undefined : photo.displayUrl}
            controls
            playsInline
            preload="metadata"
            width={photo.width}
            height={photo.height}
            className="max-h-full max-w-full bg-black object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN
          <img
            key={photo.id}
            src={photo.displayUrl}
            alt=""
            width={photo.width}
            height={photo.height}
            className="max-h-full max-w-full object-contain"
          />
        )}
        {hasPrev && (
          <button
            type="button"
            onClick={() => onNavigate(index - 1)}
            aria-label={t.prev}
            className="absolute top-1/2 left-2 hidden -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 sm:block"
          >
            ‹
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={() => onNavigate(index + 1)}
            aria-label={t.next}
            className="absolute top-1/2 right-2 hidden -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 sm:block"
          >
            ›
          </button>
        )}
      </div>

      {actions && <div className="flex justify-center gap-2 px-4 pt-3 pb-6">{actions(photo)}</div>}
    </div>
  );
}
