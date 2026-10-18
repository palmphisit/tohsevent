"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listSlideshowPhotos, type PublicPhoto, type SlideshowSettings } from "@/lib/api-client";

const INITIAL_LIMIT = 200;
const POLL_LIMIT = 60;
const POLL_MS = 10_000;

/**
 * Photos for the slideshow, newest first, kept fresh by polling. Uploads that arrive after
 * the first load are queued (oldest first) so the screen can show them right away.
 */
export function useSlideshowPhotos(
  slug: string,
  key: string | null,
  /** Draft value from the dashboard preview; undefined uses the saved setting. */
  sources: SlideshowSettings["sources"] | undefined,
) {
  const [photos, setPhotos] = useState<PublicPhoto[]>([]);
  const [savedSettings, setSavedSettings] = useState<SlideshowSettings | null>(null);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const photosRef = useRef<PublicPhoto[]>([]);
  const freshRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    let first = true;
    let savedSources: string | null = null;

    function apply(next: PublicPhoto[]) {
      photosRef.current = next;
      setPhotos(next);
    }

    async function load() {
      const limit = first ? INITIAL_LIMIT : POLL_LIMIT;
      const page = await listSlideshowPhotos(slug, { key, sources, limit });
      if (cancelled) return;
      setTotal(page.total);
      setSavedSettings((prev) => (JSON.stringify(prev) === JSON.stringify(page.settings) ? prev : page.settings));
      setLoaded(true);
      // The host switched which photos the venue screen shows: start over with the new set.
      const sourcesChanged = !sources && savedSources !== null && savedSources !== page.settings.sources;
      savedSources = page.settings.sources;
      if (sourcesChanged) first = true;
      if (first) {
        first = false;
        freshRef.current = [];
        apply(page.items);
        return;
      }
      const ids = new Set(page.items.map((p) => p.id));
      // The poll covers everything newer than its oldest item: anything missing there was hidden or deleted.
      const oldest = page.items.length === limit ? page.items.at(-1)!.id : "";
      const kept = photosRef.current.filter((p) => ids.has(p.id) || p.id < oldest);
      const seen = new Set(kept.map((p) => p.id));
      const added = page.items.filter((p) => !seen.has(p.id));
      if (added.length) freshRef.current.push(...added.map((p) => p.id).reverse());
      if (added.length || kept.length !== photosRef.current.length) apply([...added, ...kept]);
    }

    load().catch(() => {});
    const timer = setInterval(() => load().catch(() => {}), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [slug, key, sources]);

  /** Next newly uploaded photo still in the list, if any. */
  const takeFresh = useCallback((): PublicPhoto | undefined => {
    while (freshRef.current.length) {
      const id = freshRef.current.shift()!;
      const photo = photosRef.current.find((p) => p.id === id);
      if (photo) return photo;
    }
    return undefined;
  }, []);

  return { photos, photosRef, total, loaded, takeFresh, savedSettings };
}
