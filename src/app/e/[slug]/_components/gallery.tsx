"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { Lightbox } from "@/components/lightbox";
import { MediaThumb } from "@/components/media-thumb";
import { listPhotos, type Appearance, type PublicPhoto } from "@/lib/api-client";
import { DeleteMyPhotoButton, ReportPhotoButton, SavePhotoButton } from "./photo-actions";

type Source = PublicPhoto["source"];

const TABS: { source: Source; label: string }[] = [
  { source: "official", label: "รูปจากช่างภาพ" },
  { source: "guest", label: "รูปจากแขก" },
];
const POLL_MS = 15_000;

export function Gallery({
  slug,
  recentUploads,
  ensureSession,
  layout = "grid",
  defaultTab = "guest",
}: {
  slug: string;
  recentUploads: PublicPhoto[];
  ensureSession: () => Promise<unknown>;
  layout?: Appearance["gallery"];
  defaultTab?: Source;
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
}: {
  slug: string;
  source: Source;
  recentUploads: PublicPhoto[];
  ensureSession: () => Promise<unknown>;
  layout: Appearance["gallery"];
}) {
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
      <ul className={layout === "masonry" ? "mt-4 columns-2 gap-2 sm:columns-3" : "mt-4 grid grid-cols-3 gap-1.5 sm:grid-cols-4"}>
        {visible.map((photo, i) => (
          <li
            key={photo.id}
            className={`overflow-hidden rounded-xl bg-surface ${layout === "masonry" ? "mb-2 break-inside-avoid" : "aspect-square"}`}
            style={layout === "masonry" ? { aspectRatio: `${photo.width} / ${photo.height}` } : undefined}
          >
            <button type="button" onClick={() => setOpenIndex(i)} className="relative block h-full w-full">
              <MediaThumb photo={photo} alt={photo.uploaderName ? `รูปจาก ${photo.uploaderName}` : "รูปในงาน"} />
            </button>
          </li>
        ))}
      </ul>
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
              <SavePhotoButton photo={photo} />
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
