"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Check, CheckSquare, Download, ImagePlus, Share2, X } from "lucide-react";
import { Lightbox } from "@/components/lightbox";
import { MediaThumb } from "@/components/media-thumb";
import { listPhotos, type Appearance, type PublicPhoto } from "@/lib/api-client";
import { showError } from "@/lib/error-popup";
import { GestureRequired, mediaFile, prefetchMedia, saveToDevice, shareMedia, type ShareInfo } from "@/lib/save-share";
import { DeleteMyPhotoButton, ReportPhotoButton, SaveMediaButton, ShareMediaButton, ShareSheet } from "./photo-actions";

type Source = PublicPhoto["source"];

const TABS: { source: Source; label: string }[] = [
  { source: "official", label: "รูปจากช่างภาพ" },
  { source: "guest", label: "รูปจากแขก" },
];
const POLL_MS = 15_000;
/** Share sheets and browsers cope with this many files at once. */
const MAX_SELECTED = 30;

export function Gallery({
  slug,
  recentUploads,
  ensureSession,
  layout = "grid",
  defaultTab = "guest",
  shareInfo,
}: {
  slug: string;
  recentUploads: PublicPhoto[];
  ensureSession: () => Promise<unknown>;
  layout?: Appearance["gallery"];
  defaultTab?: Source;
  shareInfo: ShareInfo;
}) {
  const [source, setSource] = useState<Source>(defaultTab);

  return (
    <section className="mt-10">
      <div role="tablist" className="flex gap-1 rounded-xl bg-surface p-1">
        {TABS.map((tab) => (
          <button
            key={tab.source}
            role="tab"
            aria-selected={source === tab.source}
            onClick={() => setSource(tab.source)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              source === tab.source ? "bg-card text-brand shadow-sm" : "text-muted hover:text-ink/85"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <PhotoGrid
        key={source}
        slug={slug}
        source={source}
        recentUploads={source === "guest" ? recentUploads : []}
        ensureSession={ensureSession}
        layout={layout}
        shareInfo={shareInfo}
      />
    </section>
  );
}

function PhotoGrid({
  slug,
  source,
  recentUploads,
  ensureSession,
  layout,
  shareInfo,
}: {
  slug: string;
  source: Source;
  recentUploads: PublicPhoto[];
  ensureSession: () => Promise<unknown>;
  layout: Appearance["gallery"];
  shareInfo: ShareInfo;
}) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [photos, setPhotos] = useState<PublicPhoto[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "error">("loading");

  const mergeNewest = useCallback((incoming: PublicPhoto[]) => {
    setPhotos((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      const fresh = incoming.filter((p) => !seen.has(p.id));
      return fresh.length ? [...fresh, ...prev] : prev;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    listPhotos(slug, { source })
      .then((page) => {
        if (cancelled) return;
        setPhotos(page.items);
        setCursor(page.nextCursor);
        setState("idle");
      })
      .catch(() => !cancelled && setState("error"));

    // Phase 1 uses polling for "live" updates; realtime push comes later.
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      listPhotos(slug, { source })
        .then((page) => !cancelled && mergeNewest(page.items))
        .catch(() => {});
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [slug, source, mergeNewest]);

  const visible = useMemo(() => {
    const seen = new Set(photos.map((p) => p.id));
    return [...recentUploads.filter((p) => !seen.has(p.id)), ...photos].filter((p) => !removed.has(p.id));
  }, [photos, recentUploads, removed]);

  function onDeleted(photoId: string) {
    setRemoved((prev) => new Set(prev).add(photoId));
    setOpenIndex(null);
  }

  async function loadMore() {
    if (!cursor) return;
    setState("loading");
    try {
      const page = await listPhotos(slug, { source, cursor });
      setPhotos((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  if (state === "error" && visible.length === 0) {
    return <p className="mt-6 text-center text-sm text-muted">โหลดรูปไม่สำเร็จ</p>;
  }
  if (state !== "loading" && visible.length === 0) {
    return (
      <div className="mt-6 flex flex-col items-center rounded-2xl bg-surface/60 px-6 py-10 text-center">
        {source === "official" ? (
          <Camera className="h-8 w-8 text-muted/50" />
        ) : (
          <ImagePlus className="h-8 w-8 text-muted/50" />
        )}
        <p className="mt-3 text-sm text-muted">
          {source === "official" ? "ช่างภาพยังไม่ได้อัปโหลดรูป กลับมาดูอีกครั้งหลังงาน" : "ยังไม่มีรูป เป็นคนแรกที่แชร์รูปเลย!"}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted">{visible.length.toLocaleString("th-TH")} รายการ</span>
        <button
          type="button"
          onClick={() => {
            setSelecting((v) => !v);
            setSelected([]);
          }}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-brand hover:bg-surface"
        >
          {selecting ? <X className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
          {selecting ? "ยกเลิก" : "เลือกหลายรูป"}
        </button>
      </div>
      <ul className={layout === "masonry" ? "mt-2 columns-2 gap-2 sm:columns-3" : "mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4"}>
        {visible.map((photo, i) => {
          const picked = selected.includes(photo.id);
          return (
            <li
              key={photo.id}
              className={`overflow-hidden rounded-xl bg-surface ${layout === "masonry" ? "mb-2 break-inside-avoid" : "aspect-square"} ${
                picked ? "ring-3 ring-brand ring-offset-2 ring-offset-[var(--g-page,#fff)]" : ""
              }`}
              style={layout === "masonry" ? { aspectRatio: `${photo.width} / ${photo.height}` } : undefined}
            >
              <button
                type="button"
                onClick={() => {
                  if (!selecting) return setOpenIndex(i);
                  if (picked) return setSelected((ids) => ids.filter((id) => id !== photo.id));
                  if (selected.length >= MAX_SELECTED) return showError(`เลือกได้ครั้งละไม่เกิน ${MAX_SELECTED} รายการ`);
                  prefetchMedia(photo); // ready before "save" is tapped, so the share sheet can open
                  setSelected((ids) => [...ids, photo.id]);
                }}
                aria-pressed={selecting ? picked : undefined}
                className="relative block h-full w-full"
              >
                <MediaThumb photo={photo} alt={photo.uploaderName ? `รูปจาก ${photo.uploaderName}` : "รูปในงาน"} />
                {selecting && (
                  <span
                    className={`absolute top-1.5 left-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-white shadow ${
                      picked ? "bg-brand text-brand-contrast" : "bg-black/25"
                    }`}
                  >
                    {picked && <Check className="h-3.5 w-3.5" />}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {selecting && (
        <SelectionBar
          photos={visible.filter((p) => selected.includes(p.id))}
          shareInfo={shareInfo}
          onDone={() => {
            setSelecting(false);
            setSelected([]);
          }}
        />
      )}
      {cursor && (
        <button
          onClick={loadMore}
          disabled={state === "loading"}
          className="mt-4 w-full rounded-xl border border-line px-4 py-3 text-sm font-medium disabled:opacity-50"
        >
          {state === "loading" ? "กำลังโหลด…" : "ดูรูปเพิ่มเติม"}
        </button>
      )}
      {openIndex !== null && (
        <Lightbox
          photos={visible}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
          actions={(photo) => (
            <>
              <SaveMediaButton photo={photo} />
              <ShareMediaButton photo={photo} info={shareInfo} />
              {photo.mine ? (
                <DeleteMyPhotoButton slug={slug} photo={photo} onDeleted={onDeleted} />
              ) : (
                <ReportPhotoButton slug={slug} photo={photo} ensureSession={ensureSession} />
              )}
            </>
          )}
        />
      )}
    </>
  );
}

/** Bottom bar in select mode: save or share the picked photos and videos in one go. */
function SelectionBar({ photos, shareInfo, onDone }: { photos: PublicPhoto[]; shareInfo: ShareInfo; onDone: () => void }) {
  const [phase, setPhase] = useState<"idle" | "working" | "tap-save" | "tap-share">("idle");
  const [fallback, setFallback] = useState(false);
  const count = photos.length;

  async function run(action: "save" | "share") {
    setPhase("working");
    try {
      const files = await Promise.all(photos.map(mediaFile));
      if (action === "save") {
        if ((await saveToDevice(files)) === "saved") onDone();
      } else if ((await shareMedia(files, shareInfo)) === "unsupported") {
        setFallback(true);
      }
      setPhase("idle");
    } catch (error) {
      if (error instanceof GestureRequired) setPhase(action === "save" ? "tap-save" : "tap-share");
      else {
        setPhase("idle");
        showError("เตรียมไฟล์ไม่สำเร็จ ลองอีกครั้ง");
      }
    }
  }

  const button = "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-40";
  return (
    <>
      <div className="sticky bottom-4 z-30 mt-4 rounded-2xl bg-card p-3 shadow-xl ring-1 ring-line">
        <p className="mb-2 text-center text-xs text-muted">
          {count === 0 ? "แตะรูปเพื่อเลือก" : `เลือกแล้ว ${count} รายการ`}
          {phase === "working" && " · กำลังเตรียมไฟล์…"}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={count === 0 || phase === "working"}
            onClick={() => run("save")}
            className={`${button} bg-brand text-brand-contrast`}
          >
            <Download className="h-4 w-4" />
            {phase === "tap-save" ? "แตะเพื่อบันทึก" : "บันทึกลงเครื่อง"}
          </button>
          <button
            type="button"
            disabled={count === 0 || phase === "working"}
            onClick={() => run("share")}
            className={`${button} bg-surface text-ink`}
          >
            <Share2 className="h-4 w-4" />
            {phase === "tap-share" ? "แตะเพื่อแชร์" : "แชร์"}
          </button>
        </div>
      </div>
      {fallback && <ShareSheet info={shareInfo} onClose={() => setFallback(false)} />}
    </>
  );
}
