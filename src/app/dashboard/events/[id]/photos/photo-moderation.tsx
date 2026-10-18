"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lightbox } from "@/components/lightbox";
import { Uploader, type UploadTarget } from "@/components/uploader";
import {
  completeOfficialUpload,
  deleteHostPhoto,
  listHostPhotos,
  moderateHostPhoto,
  reserveOfficialUpload,
  type HostPhoto,
  type HostPhotoView,
  type PublicPhoto,
} from "@/lib/api-client";

const TABS: { view: HostPhotoView; label: string }[] = [
  { view: "guest", label: "รูปจากแขก" },
  { view: "official", label: "รูป Official" },
  { view: "reported", label: "ถูกรายงาน" },
];

export function PhotoModeration({
  eventId,
  openReports,
  watermark,
}: {
  eventId: string;
  openReports: number;
  watermark: boolean;
}) {
  const [view, setView] = useState<HostPhotoView>(openReports > 0 ? "reported" : "guest");
  const [reportCount, setReportCount] = useState(openReports);

  return (
    <div className="mt-6">
      <div role="tablist" className="flex gap-1 rounded-xl bg-zinc-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.view}
            role="tab"
            type="button"
            aria-selected={view === tab.view}
            onClick={() => setView(tab.view)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${view === tab.view ? "bg-white shadow-sm" : "text-zinc-500"}`}
          >
            {tab.label}
            {tab.view === "reported" && reportCount > 0 && (
              <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-xs text-white">{reportCount}</span>
            )}
          </button>
        ))}
      </div>
      <ModerationGrid
        key={view}
        eventId={eventId}
        view={view}
        watermark={watermark}
        onReportsResolved={(n) => setReportCount((c) => Math.max(0, c - n))}
      />
    </div>
  );
}

function ModerationGrid({
  eventId,
  view,
  watermark,
  onReportsResolved,
}: {
  eventId: string;
  view: HostPhotoView;
  watermark: boolean;
  onReportsResolved: (photos: number) => void;
}) {
  const [photos, setPhotos] = useState<HostPhoto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "error">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    listHostPhotos(eventId, { view })
      .then((page) => {
        if (cancelled) return;
        setPhotos(page.items);
        setCursor(page.nextCursor);
        setState("idle");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [eventId, view]);

  async function loadMore() {
    if (!cursor) return;
    setState("loading");
    try {
      const page = await listHostPhotos(eventId, { view, cursor });
      setPhotos((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  async function act(photo: HostPhoto, action: "hide" | "show" | "keep" | "delete") {
    if (action === "delete" && !window.confirm("ลบรูปนี้ถาวร? กู้คืนไม่ได้")) return;
    setBusy(photo.id);
    try {
      if (action === "delete") {
        await deleteHostPhoto(eventId, photo.id);
        setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      } else {
        const { photo: updated } = await moderateHostPhoto(
          eventId,
          photo.id,
          action === "keep" ? { dismissReports: true } : { status: action === "hide" ? "hidden" : "ready" },
        );
        setPhotos((prev) =>
          view === "reported" && updated.openReports === 0
            ? prev.filter((p) => p.id !== photo.id)
            : prev.map((p) => (p.id === photo.id ? updated : p)),
        );
      }
      if (photo.openReports > 0 && action !== "show") onReportsResolved(1);
    } catch {
      window.alert("ทำรายการไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  const onUploaded = useCallback(
    (photo: PublicPhoto) =>
      setPhotos((prev) => [{ ...photo, status: "ready", openReports: 0 }, ...prev.filter((p) => p.id !== photo.id)]),
    [],
  );
  const uploadTarget = useMemo<UploadTarget>(
    () => ({
      watermark,
      reserve: (image) => reserveOfficialUpload(eventId, image),
      complete: (photoId) => completeOfficialUpload(eventId, photoId),
    }),
    [eventId, watermark],
  );

  return (
    <div className="mt-4">
      {view === "official" && (
        <div className="mb-4">
          <Uploader
            target={uploadTarget}
            onUploaded={onUploaded}
            persistKey={`official:${eventId}`}
            label="อัปโหลดรูป Official"
          />
          <p className="mt-2 text-xs text-zinc-500">
            รูปจะถูกย่อเป็นความละเอียด 2560px ก่อนอัปโหลด การอัปโหลดไฟล์ต้นฉบับความละเอียดสูงจะมาพร้อมแอปสำหรับช่างภาพ
            {watermark && " · แพ็กเกจ Free: แขกจะเห็นรูปพร้อมลายน้ำ Tohs Event จนกว่าจะอัปเกรด"}
          </p>
        </div>
      )}

      {state === "error" && photos.length === 0 && <p className="py-8 text-center text-sm text-zinc-500">โหลดรูปไม่สำเร็จ</p>}
      {state !== "loading" && photos.length === 0 && state !== "error" && (
        <p className="py-8 text-center text-sm text-zinc-500">
          {view === "reported" ? "ไม่มีรูปที่ถูกรายงาน" : "ยังไม่มีรูป"}
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo, i) => (
          <li key={photo.id} className="overflow-hidden rounded-xl border border-zinc-200">
            <button type="button" onClick={() => setOpenIndex(i)} className="relative block aspect-square w-full bg-zinc-100">
              {/* eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN */}
              <img
                src={photo.thumbUrl}
                alt=""
                loading="lazy"
                className={`h-full w-full object-cover ${photo.status === "hidden" ? "opacity-40 grayscale" : ""}`}
              />
              <div className="absolute top-2 left-2 flex gap-1">
                {photo.status === "hidden" && (
                  <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-white">ซ่อนอยู่</span>
                )}
                {photo.openReports > 0 && (
                  <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
                    รายงาน {photo.openReports}
                  </span>
                )}
              </div>
            </button>
            <div className="flex gap-1 p-1.5 text-xs">
              {photo.status === "ready" ? (
                <ActionButton disabled={busy === photo.id} onClick={() => act(photo, "hide")}>
                  ซ่อน
                </ActionButton>
              ) : (
                <ActionButton disabled={busy === photo.id} onClick={() => act(photo, "show")}>
                  แสดง
                </ActionButton>
              )}
              {photo.openReports > 0 && photo.status === "ready" && (
                <ActionButton disabled={busy === photo.id} onClick={() => act(photo, "keep")}>
                  เก็บไว้
                </ActionButton>
              )}
              <ActionButton danger disabled={busy === photo.id} onClick={() => act(photo, "delete")}>
                ลบ
              </ActionButton>
            </div>
            {photo.uploaderName && <p className="truncate px-2 pb-2 text-xs text-zinc-500">{photo.uploaderName}</p>}
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
        <Lightbox photos={photos} index={openIndex} onClose={() => setOpenIndex(null)} onNavigate={setOpenIndex} />
      )}
    </div>
  );
}

function ActionButton({
  children,
  danger,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`flex-1 rounded-lg px-2 py-1.5 font-medium disabled:opacity-50 ${
        danger ? "text-red-600 hover:bg-red-50" : "hover:bg-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}
