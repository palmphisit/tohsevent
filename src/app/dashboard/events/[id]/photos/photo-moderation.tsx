"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lightbox } from "@/components/lightbox";
import { VideoBadge } from "@/components/video-badge";
import { Uploader, type UploadTarget } from "@/components/uploader";
import { uploadOriginal } from "@/lib/original-upload";
import type { VideoLimits } from "@/lib/video";
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

const REPORT_LABELS: Record<HostPhoto["reports"][number]["reason"], string> = {
  remove_me: "คนในรูปขอให้ลบ",
  inappropriate: "ไม่เหมาะสม",
  other: "อื่น ๆ",
};

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)} นาทีที่แล้ว`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} ชม.ที่แล้ว` : `${Math.round(hours / 24)} วันที่แล้ว`;
}

const TABS: { view: HostPhotoView; label: string }[] = [
  { view: "guest", label: "รูปจากแขก" },
  { view: "official", label: "รูป Official" },
  { view: "reported", label: "ถูกรายงาน" },
];

export function PhotoModeration({
  eventId,
  openReports,
  watermark,
  video,
  canModerate,
  originals,
}: {
  eventId: string;
  openReports: number;
  watermark: boolean;
  video: VideoLimits | null;
  /** Owners moderate everything; photographers only upload and manage their own official photos. */
  canModerate: boolean;
  /** The event's plan allows full-resolution originals. */
  originals: boolean;
}) {
  const [view, setView] = useState<HostPhotoView>(!canModerate ? "official" : openReports > 0 ? "reported" : "guest");
  const tabs = canModerate ? TABS : TABS.filter((t) => t.view === "official");
  const [reportCount, setReportCount] = useState(openReports);

  return (
    <div className="mt-6">
      <div role="tablist" className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.view}
            role="tab"
            type="button"
            aria-selected={view === tab.view}
            onClick={() => setView(tab.view)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${view === tab.view ? "bg-white shadow-sm" : "text-slate-500"}`}
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
        video={video}
        canModerate={canModerate}
        originals={originals}
        onReportsResolved={(n) => setReportCount((c) => Math.max(0, c - n))}
      />
    </div>
  );
}

function ModerationGrid({
  eventId,
  view,
  watermark,
  video,
  canModerate,
  originals,
  onReportsResolved,
}: {
  eventId: string;
  view: HostPhotoView;
  watermark: boolean;
  video: VideoLimits | null;
  canModerate: boolean;
  originals: boolean;
  onReportsResolved: (photos: number) => void;
}) {
  const [photos, setPhotos] = useState<HostPhoto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "error">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [withOriginals, setWithOriginals] = useState(originals);

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
          view === "reported" && updated.openReports === 0 && !updated.autoFlagged
            ? prev.filter((p) => p.id !== photo.id)
            : prev.map((p) => (p.id === photo.id ? updated : p)),
        );
      }
      if ((photo.openReports > 0 && action !== "show") || photo.autoFlagged) onReportsResolved(1);
    } catch {
      window.alert("ทำรายการไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  const onUploaded = useCallback(
    (photo: PublicPhoto) =>
      setPhotos((prev) => [
        {
          ...photo,
          status: photo.pendingReview ? "hidden" : "ready",
          openReports: 0,
          reports: [],
          autoFlagged: null,
          original: null,
        },
        ...prev.filter((p) => p.id !== photo.id),
      ]),
    [],
  );
  const uploadTarget = useMemo<UploadTarget>(
    () => ({
      watermark,
      video,
      reserve: (image) => reserveOfficialUpload(eventId, image),
      complete: (photoId) => completeOfficialUpload(eventId, photoId),
      ...(withOriginals
        ? { uploadOriginal: (photoId: string, file: Blob, onProgress: (f: number) => void) => uploadOriginal(eventId, photoId, file, onProgress) }
        : {}),
    }),
    [eventId, watermark, video, withOriginals],
  );

  return (
    <div className="mt-4">
      {view === "official" && (
        <div className="mb-4">
          <Uploader
            target={uploadTarget}
            onUploaded={onUploaded}
            persistKey={`official:${eventId}`}
            label={video ? "อัปโหลดรูป / วิดีโอ Official" : "อัปโหลดรูป Official"}
          />
          {originals && (
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={withOriginals}
                onChange={(e) => setWithOriginals(e.target.checked)}
                className="accent-primary"
              />
              อัปโหลดไฟล์ต้นฉบับของรูปด้วย (เก็บแบบส่วนตัว ไม่แสดงให้แขกเห็น · สูงสุด 200 MB ต่อไฟล์)
            </label>
          )}
          <p className="mt-2 text-xs text-slate-500">
            รูปจะถูกย่อเป็นความละเอียด 2560px ก่อนอัปโหลด การอัปโหลดไฟล์ต้นฉบับความละเอียดสูงจะมาพร้อมแอปสำหรับช่างภาพ
            {watermark && " · แพ็กเกจ Free: แขกจะเห็นรูปพร้อมลายน้ำ Tohs Event จนกว่าจะอัปเกรด"}
          </p>
        </div>
      )}

      {state === "error" && photos.length === 0 && <p className="py-8 text-center text-sm text-slate-500">โหลดรูปไม่สำเร็จ</p>}
      {state !== "loading" && photos.length === 0 && state !== "error" && (
        <p className="py-8 text-center text-sm text-slate-500">
          {view === "reported" ? "ไม่มีรูปที่ถูกรายงาน" : "ยังไม่มีรูป"}
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo, i) => (
          <li key={photo.id} className="overflow-hidden rounded-xl border border-slate-200">
            <button type="button" onClick={() => setOpenIndex(i)} className="relative block aspect-square w-full bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN */}
              <img
                src={photo.thumbUrl}
                alt=""
                loading="lazy"
                className={`h-full w-full object-cover ${photo.status === "hidden" ? "opacity-40 grayscale" : ""}`}
              />
              {photo.kind === "video" && <VideoBadge durationSec={photo.durationSec} />}
              <div className="absolute top-2 left-2 flex gap-1">
                {photo.autoFlagged ? (
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">AI ซ่อนไว้รอตรวจ</span>
                ) : (
                  photo.status === "hidden" && (
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">ซ่อนอยู่</span>
                  )
                )}
                {photo.openReports > 0 && (
                  <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
                    รายงาน {photo.openReports}
                  </span>
                )}
              </div>
            </button>
            <div className="flex gap-1 p-1.5 text-xs">
              {!canModerate ? null : photo.status === "ready" || photo.autoFlagged ? (
                <>
                  {photo.autoFlagged && (
                    <ActionButton disabled={busy === photo.id} onClick={() => act(photo, "show")}>
                      แสดง
                    </ActionButton>
                  )}
                  <ActionButton disabled={busy === photo.id} onClick={() => act(photo, "hide")}>
                    {photo.autoFlagged ? "ซ่อนต่อ" : "ซ่อน"}
                  </ActionButton>
                </>
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
            {photo.uploaderName && <p className="truncate px-2 pb-2 text-xs text-slate-500">{photo.uploaderName}</p>}
            {photo.original && (
              <p className="px-2 pb-2 text-xs">
                {photo.original.status === "ready" ? (
                  <a
                    href={`/api/v1/host/events/${eventId}/photos/${photo.id}/original`}
                    className="text-emerald-700 underline"
                  >
                    ต้นฉบับ {(photo.original.bytes / 1024 / 1024).toFixed(1)} MB ↓
                  </a>
                ) : (
                  <span className="text-amber-700">ต้นฉบับยังอัปไม่เสร็จ</span>
                )}
              </p>
            )}
            {photo.reports.length > 0 && (
              <ul className="space-y-1 border-t border-slate-100 px-2 py-2 text-xs">
                {photo.reports.map((r, i) => (
                  <li key={i} className={r.reason === "remove_me" ? "text-red-700" : "text-slate-600"}>
                    {REPORT_LABELS[r.reason]} · {timeAgo(r.createdAt)}
                    {r.note && <span className="block text-slate-500">“{r.note}”</span>}
                  </li>
                ))}
              </ul>
            )}
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
        danger ? "text-red-600 hover:bg-red-50" : "hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}
