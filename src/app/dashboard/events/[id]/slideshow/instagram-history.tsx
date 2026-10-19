"use client";

import { Download, EyeOff, Loader2, Lock, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { InstagramIcon } from "@/components/instagram-icon";
import { deleteHostPhoto, listInstagramShares, type InstagramShareItem } from "@/lib/api-client";
import { showError } from "@/lib/error-popup";

const time = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

/**
 * Host-only history of Instagram shares: the photo, the guest's @ and when it went up.
 * These photos are not in the album, the gallery or the slideshow rotation.
 */
export function InstagramHistory({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<InstagramShareItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(
    async (after: string | null) => {
      setLoading(true);
      try {
        const page = await listInstagramShares(eventId, after);
        setItems((prev) => (after && prev ? [...prev, ...page.items] : page.items));
        setCursor(page.nextCursor);
        setTotal(page.total);
      } catch {
        // Photographers (not the owner) get 404: the history is the owner's only.
        setForbidden(true);
      } finally {
        setLoading(false);
      }
    },
    [eventId],
  );

  // First page on mount (state is set in the callbacks, not in the effect body).
  useEffect(() => {
    let cancelled = false;
    listInstagramShares(eventId)
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setCursor(page.nextCursor);
        setTotal(page.total);
      })
      .catch(() => {
        if (!cancelled) setForbidden(true);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function remove(item: InstagramShareItem) {
    if (!window.confirm(`ลบรูปที่ @${item.instagram} แชร์? ลบแล้วกู้คืนไม่ได้`)) return;
    try {
      await deleteHostPhoto(eventId, item.id);
      setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? prev);
      setTotal((n) => Math.max(0, n - 1));
    } catch {
      showError("ลบรูปไม่สำเร็จ ลองอีกครั้ง");
    }
  }

  if (forbidden) return null;

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <InstagramIcon className="h-4 w-4 text-pink-500" />
            ประวัติการแชร์ Instagram {items && <span className="font-normal text-slate-500">({total})</span>}
          </h2>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <Lock className="h-3 w-3" /> เห็นเฉพาะเจ้าของงาน · รูปกลุ่มนี้ไม่อยู่ในอัลบั้ม แกลเลอรี และ Slideshow
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(null)}
          disabled={loading}
          aria-label="โหลดใหม่"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {items === null ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          ยังไม่มีแขกแชร์ขึ้นจอ เมื่อมีการแชร์ รูปพร้อม @ จะเก็บไว้ที่นี่
        </p>
      ) : (
        <>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {items.map((item) => (
              <li key={item.id} className="group overflow-hidden rounded-xl ring-1 ring-slate-200">
                <a href={item.photo.displayUrl} target="_blank" rel="noopener" className="relative block aspect-square bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN */}
                  <img src={item.photo.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  {item.status === "hidden" && (
                    <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-medium text-white">
                      <EyeOff className="h-3 w-3" /> ไม่ได้ขึ้นจอ
                    </span>
                  )}
                </a>
                <div className="space-y-1 p-2">
                  <a
                    href={`https://www.instagram.com/${encodeURIComponent(item.instagram)}/`}
                    target="_blank"
                    rel="noopener"
                    className="block truncate text-sm font-medium text-pink-600 hover:underline"
                  >
                    @{item.instagram}
                  </a>
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-xs text-slate-500">{time(item.at)}</span>
                    <span className="flex shrink-0">
                      <a
                        href={item.photo.displayUrl}
                        download
                        target="_blank"
                        rel="noopener"
                        title="ดาวน์โหลด"
                        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => void remove(item)}
                        title="ลบ"
                        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {cursor && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => void load(cursor)}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} ดูเพิ่ม
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
