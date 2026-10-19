"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listSlideshowPhotos, type PublicPhoto, type Shoutout, type SlideshowSettings } from "@/lib/api-client";

const INITIAL_LIMIT = 200;
const POLL_LIMIT = 60;
const POLL_MS = 10_000;
/** Faster while Instagram share is on, so a guest sees their popup a few seconds after sending. */
const POLL_MS_SHOUTOUTS = 4_000;
/** A screen that (re)opens only plays sends from the last minute. */
const SHOUTOUT_REPLAY_MS = 60_000;

/**
 * Photos for the slideshow, newest first, kept fresh by polling. Uploads that arrive after
 * the first load are queued (oldest first) so the screen can show them right away; so are
 * Instagram sends, which the screen pops up one at a time.
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
  const shoutoutQueue = useRef<Shoutout[]>([]);
  const savedRef = useRef<SlideshowSettings | null>(null);
  const shoutoutSeen = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    let first = true;
    let savedSources: string | null = null;
    let firstShoutouts = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function apply(next: PublicPhoto[]) {
      photosRef.current = next;
      setPhotos(next);
    }

    async function load() {
      const limit = first ? INITIAL_LIMIT : POLL_LIMIT;
      const page = await listSlideshowPhotos(slug, { key, sources, limit });
      if (cancelled) return;
      queueShoutouts(page.shoutouts ?? []);
      setTotal(page.total);
      savedRef.current = page.settings;
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

    function queueShoutouts(list: Shoutout[]) {
      const replayFrom = Date.now() - SHOUTOUT_REPLAY_MS;
      for (const item of list) {
        const id = `${item.photo.id}@${item.at}`;
        if (shoutoutSeen.current.has(id)) continue;
        shoutoutSeen.current.add(id);
        if (!firstShoutouts || Date.parse(item.at) >= replayFrom) shoutoutQueue.current.push(item);
      }
      firstShoutouts = false;
    }

    async function loop() {
      let fast = false;
      try {
        await load();
        fast = !!savedRef.current?.igShare;
      } catch {
        // Keep polling: the venue Wi-Fi may come back.
      }
      if (!cancelled) timer = setTimeout(loop, fast ? POLL_MS_SHOUTOUTS : POLL_MS);
    }
    void loop();
    return () => {
      cancelled = true;
      clearTimeout(timer);
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

  /** Next Instagram send waiting to pop up, if any. */
  const takeShoutout = useCallback((): Shoutout | undefined => shoutoutQueue.current.shift(), []);

  return { photos, photosRef, total, loaded, takeFresh, takeShoutout, savedSettings };
}
