"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lightbox } from "@/components/lightbox";
import { listPhotos, type PublicPhoto } from "@/lib/api-client";
import { ReportPhotoButton, SavePhotoButton } from "./photo-actions";

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
      <div role="tablist" className="flex gap-1 rounded-xl bg-zinc-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.source}
            role="tab"
            aria-selected={source === tab.source}
            onClick={() => setSource(tab.source)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
              source === tab.source ? "bg-white shadow-sm" : "text-zinc-500"
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
    return [...recentUploads.filter((p) => !seen.has(p.id)), ...photos];
  }, [photos, recentUploads]);

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
    return <p className="mt-6 text-center text-sm text-zinc-500">โหลดรูปไม่สำเร็จ</p>;
  }
  if (state !== "loading" && visible.length === 0) {
    return (
      <p className="mt-6 text-center text-sm text-zinc-500">
        {source === "official" ? "ช่างภาพยังไม่ได้อัปโหลดรูป" : "ยังไม่มีรูป เป็นคนแรกที่แชร์รูปเลย!"}
      </p>
    );
  }

  return (
    <>
      <ul className="mt-4 grid grid-cols-3 gap-1 sm:grid-cols-4">
        {visible.map((photo, i) => (
          <li key={photo.id} className="aspect-square overflow-hidden bg-zinc-100">
            <button type="button" onClick={() => setOpenIndex(i)} className="block h-full w-full">
              {/* eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN */}
              <img
                src={photo.thumbUrl}
                alt={photo.uploaderName ? `รูปจาก ${photo.uploaderName}` : "รูปในงาน"}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>
      {cursor && (
        <button
          onClick={loadMore}
          disabled={state === "loading"}
          className="mt-4 w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium disabled:opacity-50"
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
              <ReportPhotoButton slug={slug} photo={photo} ensureSession={ensureSession} />
            </>
          )}
        />
      )}
    </>
  );
}
