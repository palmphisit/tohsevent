"use client";

import { Maximize, Minimize, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BRAND_FONT_CLASS } from "@/app/brand-fonts";
import { BrandMark } from "@/components/brand";
import type { PublicEvent, PublicPhoto, SlideshowSettings } from "@/lib/api-client";
import { DEFAULT_BRAND_COLOR, contrastText } from "@/lib/brand-fonts";
import { formatDuration } from "@/lib/video";
import "./slideshow.css";
import { useSlideshowPhotos } from "./use-slideshow-photos";
import { useLocale } from "@/lib/use-locale";
import { INTL_LOCALE } from "@/lib/i18n";

const T = {
  en: {
    emptyTitle: "No photos yet",
    emptyText: "Scan the QR code to be the first to share",
    resume: "Resume",
    pause: "Pause",
    exitFullscreen: "Exit full screen",
    fullscreen: "Full screen",
    qrCaption: "Scan to share your photos",
    total: (n: string) => `${n} photos & videos`,
    isNew: "New!",
    photographer: "Photographer",
    newFromPhotographer: "New from the photographer",
    newFrom: (name: string) => `New photo from ${name}`,
    newPhoto: "New photo!",
  },
  th: {
    emptyTitle: "ยังไม่มีรูปในงาน",
    emptyText: "สแกน QR เพื่อเป็นคนแรกที่แชร์รูป",
    resume: "เล่นต่อ",
    pause: "หยุด",
    exitFullscreen: "ออกจากเต็มจอ",
    fullscreen: "เต็มจอ",
    qrCaption: "สแกนเพื่อแชร์รูปของคุณ",
    total: (n: string) => `${n} รูปและวิดีโอ`,
    isNew: "ใหม่!",
    photographer: "ช่างภาพ",
    newFromPhotographer: "รูปใหม่จากช่างภาพ",
    newFrom: (name: string) => `รูปใหม่จาก ${name}`,
    newPhoto: "รูปใหม่!",
  },
};

const FADE_MS = 1_100;
const MAX_VIDEO_MS = 60_000;
const IDLE_MS = 3_000;

export interface SlideshowViewProps {
  slug: string;
  /** Signed link key (password events); null for public events. */
  apiKey: string | null;
  event: Pick<PublicEvent, "title" | "date" | "branding">;
  /** Initial settings (venue screen) or the unsaved draft (dashboard preview). */
  settings: SlideshowSettings;
  /** QR code SVG (rendered on the server) pointing at the guest page. */
  qrSvg: string;
  guestUrl: string;
  /** The real venue screen: keyboard, fullscreen, hidden cursor, screen wake lock. Off in previews. */
  interactive?: boolean;
}

export function SlideshowView({ slug, apiKey, event, qrSvg, guestUrl, interactive = false, ...props }: SlideshowViewProps) {
  const { photos, photosRef, total, loaded, takeFresh, savedSettings } = useSlideshowPhotos(
    slug,
    apiKey,
    interactive ? undefined : props.settings.sources,
  );
  // The venue screen follows what the host saves; the dashboard preview shows the draft.
  const settings = (interactive && savedSettings) || props.settings;
  const locale = useLocale();
  const t = T[locale];
  const [paused, setPaused] = useState(false);
  const [idle, setIdle] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<() => void>(() => {});

  const brand = event.branding?.primaryColor ?? DEFAULT_BRAND_COLOR;
  const style = {
    "--ss-brand": brand,
    "--ss-brand-contrast": event.branding?.contrastColor ?? contrastText(brand),
    "--ss-interval": `${settings.intervalSec + 1.5}s`,
  } as React.CSSProperties;

  useVenueScreen(interactive, rootRef, { setIdle, setFullscreen, setPaused, skip: () => skipRef.current() });

  const date = new Date(event.date).toLocaleDateString(INTL_LOCALE[locale], { dateStyle: "long", timeZone: "UTC" });
  const shortUrl = guestUrl.replace(/^https?:\/\//, "");

  return (
    <div className={`ss-frame ${event.branding ? BRAND_FONT_CLASS[event.branding.fontId] : ""}`}>
      <div
        ref={rootRef}
        className="ss-root"
        style={style}
        data-theme={settings.theme}
        data-side={settings.panelSide}
        data-qr={settings.qrSize ?? "medium"}
        data-paused={paused}
        data-idle={interactive && idle}
      >
        <div className="ss-stage">
          {loaded && photos.length === 0 ? (
            <div className="ss-empty">
              <strong>{t.emptyTitle}</strong>
              <span>{t.emptyText}</span>
            </div>
          ) : settings.layout === "wall" ? (
            <Wall photos={photos} takeFresh={takeFresh} settings={settings} paused={paused} />
          ) : (
            <Spotlight
              photos={photos}
              photosRef={photosRef}
              takeFresh={takeFresh}
              settings={settings}
              paused={paused}
              skipRef={skipRef}
            />
          )}
          {interactive && (
            <div className="ss-controls">
              <button type="button" onClick={() => setPaused((p) => !p)}>
                {paused ? <Play /> : <Pause />}
                {paused ? t.resume : t.pause}
              </button>
              <button type="button" onClick={() => toggleFullscreen(rootRef.current)}>
                {fullscreen ? <Minimize /> : <Maximize />}
                {fullscreen ? t.exitFullscreen : t.fullscreen}
              </button>
            </div>
          )}
        </div>

        <aside className="ss-panel">
          <div className="ss-panel-text">
            {event.branding?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- branding asset from R2/CDN
              <img src={event.branding.logoUrl} alt="" className="ss-logo" />
            )}
            <h1 className="ss-headline">{settings.headline || event.title}</h1>
            {settings.showDate && <p className="ss-date">{date}</p>}
            {settings.message && <p className="ss-message">{settings.message}</p>}
          </div>
          {settings.showQr && (
            <div className="ss-qr-card">
              {/* SVG generated server-side by the qrcode library from our own URL */}
              <div className="ss-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <p className="ss-qr-caption">{settings.qrCaption || t.qrCaption}</p>
              <p className="ss-qr-url">{shortUrl}</p>
            </div>
          )}
          <div className="ss-panel-foot">
            <span>{t.total(total.toLocaleString(INTL_LOCALE[locale]))}</span>
            <span className="ss-powered">
              <BrandMark className="" />
              Tohs Event
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * Thumbnail in the strip / wall. Videos show their poster frame; when only a placeholder
 * poster exists, the browser draws the clip's own frame instead (no download of the whole clip).
 */
function TileMedia({ photo }: { photo: PublicPhoto }) {
  return (
    <>
      {photo.kind === "video" && photo.posterFallback && photo.videoUrl ? (
        <video src={`${photo.videoUrl}#t=0.5`} preload="metadata" muted playsInline />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN
        <img src={photo.thumbUrl} alt="" loading="lazy" />
      )}
      {photo.kind === "video" && (
        <span className="ss-play-badge">
          ▶{photo.durationSec !== undefined && ` ${formatDuration(photo.durationSec)}`}
        </span>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Spotlight: one big photo at a time (crossfade + slow zoom), new uploads jump the queue,
// and a strip of recent photos flows underneath.

function preload(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(resolve, 8_000);
    img.onload = img.onerror = () => {
      clearTimeout(timer);
      resolve();
    };
    img.src = url;
  });
}

interface Shown {
  photo: PublicPhoto;
  isNew: boolean;
  step: number;
}

function Spotlight({
  photos,
  photosRef,
  takeFresh,
  settings,
  paused,
  skipRef,
}: {
  photos: PublicPhoto[];
  photosRef: React.RefObject<PublicPhoto[]>;
  takeFresh: () => PublicPhoto | undefined;
  settings: SlideshowSettings;
  paused: boolean;
  skipRef: React.RefObject<() => void>;
}) {
  const [current, setCurrent] = useState<Shown | null>(null);
  const [previous, setPrevious] = useState<Shown | null>(null);
  const currentRef = useRef<Shown | null>(null);
  const advancing = useRef(false);

  const advance = useCallback(async () => {
    if (advancing.current) return;
    const list = photosRef.current;
    if (list.length === 0) return;
    advancing.current = true;
    try {
      const fresh = takeFresh();
      let next = fresh;
      if (!next) {
        const i = list.findIndex((p) => p.id === currentRef.current?.photo.id);
        next = list[(i + 1) % list.length];
      }
      if (next.kind !== "video") await preload(next.displayUrl);
      const shown = { photo: next, isNew: !!fresh, step: (currentRef.current?.step ?? 0) + 1 };
      setPrevious(currentRef.current);
      currentRef.current = shown;
      setCurrent(shown);
    } finally {
      advancing.current = false;
    }
  }, [photosRef, takeFresh]);

  useEffect(() => {
    skipRef.current = () => void advance();
  }, [advance, skipRef]);

  // First photo as soon as the list arrives.
  useEffect(() => {
    if (!currentRef.current && photos.length > 0) void advance();
  }, [photos.length, advance]);

  // Photos stay for the interval; videos play to the end (capped).
  useEffect(() => {
    if (!current || paused) return;
    const ms = current.photo.kind === "video" ? MAX_VIDEO_MS : settings.intervalSec * 1000;
    const timer = setTimeout(() => void advance(), ms);
    return () => clearTimeout(timer);
  }, [current, paused, settings.intervalSec, advance]);

  // Drop the faded-out layer once the crossfade is done.
  useEffect(() => {
    if (!previous) return;
    const timer = setTimeout(() => setPrevious(null), FADE_MS + 100);
    return () => clearTimeout(timer);
  }, [previous]);

  const strip = photos.slice(0, 30);
  const stripDuration = `${Math.max(30, strip.length * 4)}s`;

  return (
    <div className="ss-spotlight">
      <div className="ss-spotlight-main">
        {previous && previous.step !== current?.step && (
          <SpotlightLayer key={`p-${previous.step}`} shown={previous} enter={false} settings={settings} />
        )}
        {current && (
          <SpotlightLayer
            key={`c-${current.step}`}
            shown={current}
            enter
            settings={settings}
            paused={paused}
            onVideoEnd={() => void advance()}
          />
        )}
      </div>
      {strip.length > 2 && (
        <div className="ss-strip" style={{ "--ss-strip-duration": stripDuration } as React.CSSProperties}>
          <div className="ss-strip-track">
            {[...strip, ...strip].map((photo, i) => (
              <div key={`${photo.id}-${i}`} className="ss-strip-tile" data-current={photo.id === current?.photo.id}>
                <TileMedia photo={photo} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SpotlightLayer({
  shown,
  enter,
  settings,
  paused = false,
  onVideoEnd,
}: {
  shown: Shown;
  enter: boolean;
  settings: SlideshowSettings;
  paused?: boolean;
  onVideoEnd?: () => void;
}) {
  const t = T[useLocale()];
  const { photo } = shown;
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) video.pause();
    else void video.play().catch(() => {});
  }, [paused]);

  return (
    <div className="ss-layer" data-enter={enter}>
      {/* eslint-disable-next-line @next/next/no-img-element -- blurred fill behind portrait photos */}
      <img src={photo.thumbUrl} alt="" className="ss-backdrop" />
      {photo.kind === "video" && photo.videoUrl ? (
        <video
          ref={videoRef}
          src={photo.videoUrl}
          poster={photo.posterFallback ? undefined : photo.displayUrl}
          className="ss-media"
          autoPlay
          muted
          playsInline
          onEnded={onVideoEnd}
          onError={onVideoEnd}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN
        <img
          src={photo.displayUrl}
          alt=""
          className="ss-media"
          data-kenburns={!paused}
          style={{ transformOrigin: shown.step % 2 ? "30% 40%" : "70% 60%" }}
        />
      )}
      <div className="ss-caption">
        {shown.isNew && <span className="ss-new-chip">{t.isNew}</span>}
        {settings.showUploader && (photo.uploaderName || photo.source === "official") && (
          <span className="ss-chip">
            {photo.source === "official" ? `📸 ${t.photographer}` : `📷 ${photo.uploaderName}`}
            {photo.kind === "video" && photo.durationSec !== undefined && ` · ${formatDuration(photo.durationSec)}`}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wall: columns of photos drifting upwards; new uploads pop up in the middle for a moment.

function useColumnCount(ref: React.RefObject<HTMLDivElement | null>): number {
  const [count, setCount] = useState(4);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (height > 0) setCount(Math.min(6, Math.max(2, Math.round(width / (height * 0.34)))));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return count;
}

function Wall({
  photos,
  takeFresh,
  settings,
  paused,
}: {
  photos: PublicPhoto[];
  takeFresh: () => PublicPhoto | undefined;
  settings: SlideshowSettings;
  paused: boolean;
}) {
  const t = T[useLocale()];
  const wallRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const columns = useColumnCount(wallRef);
  const [popup, setPopup] = useState<PublicPhoto | null>(null);

  // Round-robin into columns; short lists are repeated so every column can loop.
  const lists: PublicPhoto[][] = Array.from({ length: columns }, () => []);
  const source = photos.slice(0, 120);
  if (source.length) {
    const perColumn = Math.max(5, Math.ceil(source.length / columns));
    for (let i = 0; i < perColumn * columns; i++) lists[i % columns].push(source[i % source.length]);
  }

  // Drift: one rAF loop moves every column; offsets survive re-renders.
  const offsets = useRef<number[]>([]);
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(100, now - last) / 1000;
      last = now;
      const height = wallRef.current?.clientHeight ?? 600;
      columnRefs.current.forEach((col, i) => {
        if (!col) return;
        const loop = col.scrollHeight / 2;
        // Full wall height every ~2.5 intervals; neighbouring columns at slightly different speeds.
        const speed = (height / (settings.intervalSec * 2.5)) * (1 + (i % 3) * 0.18);
        const offset = ((offsets.current[i] ?? 0) + (pausedRef.current ? 0 : speed * dt)) % Math.max(loop, 1);
        offsets.current[i] = offset;
        col.style.transform = `translate3d(0, ${-offset}px, 0)`;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [settings.intervalSec]);

  // New uploads: one at a time in the middle of the wall.
  useEffect(() => {
    if (popup || paused) return;
    const timer = setInterval(() => {
      const fresh = takeFresh();
      if (fresh) setPopup(fresh);
    }, 1_500);
    return () => clearInterval(timer);
  }, [popup, paused, takeFresh]);
  useEffect(() => {
    if (!popup) return;
    const ms = popup.kind === "video" ? Math.min(MAX_VIDEO_MS, ((popup.durationSec ?? 10) + 1) * 1000) : settings.intervalSec * 1000;
    const timer = setTimeout(() => setPopup(null), ms);
    return () => clearTimeout(timer);
  }, [popup, settings.intervalSec]);

  return (
    <>
      <div ref={wallRef} className="ss-wall">
        {lists.map((list, i) => (
          <div
            key={i}
            ref={(el) => {
              columnRefs.current[i] = el;
            }}
            className="ss-wall-column"
          >
            {[...list, ...list].map((photo, j) => (
              <div
                key={`${photo.id}-${j}`}
                className="ss-wall-tile"
                style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
              >
                <TileMedia photo={photo} />
              </div>
            ))}
          </div>
        ))}
      </div>
      {popup && (
        <div className="ss-popup">
          <div className="ss-popup-card">
            {popup.kind === "video" && popup.videoUrl ? (
              <video
                src={popup.videoUrl}
                poster={popup.posterFallback ? undefined : popup.displayUrl}
                autoPlay
                muted
                playsInline
                onEnded={() => setPopup(null)}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN
              <img src={popup.displayUrl} alt="" />
            )}
            <p>
              {popup.source === "official"
                ? `📸 ${t.newFromPhotographer}`
                : settings.showUploader && popup.uploaderName
                  ? `📷 ${t.newFrom(popup.uploaderName)}`
                  : `📷 ${t.newPhoto}`}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Venue screen behaviour.

function toggleFullscreen(el: HTMLElement | null) {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void el?.closest(".ss-frame")?.requestFullscreen?.().catch(() => {});
}

function useVenueScreen(
  enabled: boolean,
  rootRef: React.RefObject<HTMLDivElement | null>,
  handlers: {
    setIdle: (idle: boolean) => void;
    setFullscreen: (on: boolean) => void;
    setPaused: React.Dispatch<React.SetStateAction<boolean>>;
    skip: () => void;
  },
) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;
    const h = () => handlersRef.current;
    let idleTimer = setTimeout(() => h().setIdle(true), IDLE_MS);
    const onMove = () => {
      h().setIdle(false);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => h().setIdle(true), IDLE_MS);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") toggleFullscreen(rootRef.current);
      if (e.key === " ") {
        e.preventDefault();
        h().setPaused((p) => !p);
      }
      if (e.key === "ArrowRight") h().skip();
    };
    const onFullscreen = () => h().setFullscreen(!!document.fullscreenElement);

    // Keep the TV/laptop awake while the slideshow runs (re-acquired when the tab is shown again).
    let lock: WakeLockSentinel | null = null;
    const requestLock = () => {
      if (document.visibilityState === "visible") {
        navigator.wakeLock?.request("screen").then((l) => (lock = l), () => {});
      }
    };
    requestLock();

    window.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("visibilitychange", requestLock);
    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("visibilitychange", requestLock);
      void lock?.release().catch(() => {});
    };
  }, [enabled, rootRef]);
}
