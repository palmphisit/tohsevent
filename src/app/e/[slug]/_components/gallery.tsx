"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { Lightbox } from "@/components/lightbox";
import { MediaThumb } from "@/components/media-thumb";
import { listPhotos, type PublicPhoto } from "@/lib/api-client";
import { DeleteMyPhotoButton, ReportPhotoButton, SavePhotoButton } from "./photo-actions";

type Source = PublicPhoto["source"];

const TABS: { source: Source; label: string }[] = [
  { source: "official", label: "Official" },
  { source: "guest", label: "Guest Photos" },
];
const POLL_MS = 15_000;

export function Gallery({
  slug,
  recentUploads,
  ensureSession,
}: {
  slug: string;
  recentUploads: PublicPhoto[];
  ensureSession: () => Promise<unknown>;
}) {
  const [source, setSource] = useState<Source>("guest");

  return (
    <section className="mt-10">
      <div role="tablist" className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.source}
            role="tab"
            aria-selected={source === tab.source}
            onClick={() => setSource(tab.source)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              source === tab.source ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700"
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
      />
    </section>
  );
}

function PhotoGrid({
  slug,
  source,
  recentUploads,
  ensureSession,
}: {
  slug: string;
  source: Source;
  recentUploads: PublicPhoto[];
  ensureSession: () => Promise<unknown>;
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
    return <p className="mt-6 text-center text-sm text-slate-500">โหลดรูปไม่สำเร็จ</p>;
  }
  if (state !== "loading" && visible.length === 0) {
    return (
      <div className="mt-6 flex flex-col items-center rounded-2xl bg-slate-50 px-6 py-10 text-center">
        {source === "official" ? (
          <Camera className="h-8 w-8 text-slate-300" />
        ) : (
          <ImagePlus className="h-8 w-8 text-slate-300" />
        )}
        <p className="mt-3 text-sm text-slate-500">
          {source === "official" ? "ช่างภาพยังไม่ได้อัปโหลดรูป กลับมาดูอีกครั้งหลังงาน" : "ยังไม่มีรูป เป็นคนแรกที่แชร์รูปเลย!"}
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="mt-4 grid grid-cols-3 gap-1 sm:grid-cols-4">
        {visible.map((photo, i) => (
          <li key={photo.id} className="aspect-square overflow-hidden bg-slate-100">
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
          className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium disabled:opacity-50"
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
