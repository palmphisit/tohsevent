"use client";

import { Check, ExternalLink, HardDriveUpload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  cancelDriveExport,
  getDriveExport,
  runDriveExportStep,
  startDriveExport,
  type DriveExportView,
} from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { DRIVE_SCOPE } from "@/lib/google";

type Source = DriveExportView["sources"][number];

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

/**
 * Sends the album to the user's Google Drive. The server works in ~40 s steps; this panel
 * keeps calling the next step while the page is open, and picks up an unfinished transfer
 * when the page is opened again.
 */
export function DriveExportPanel({ eventId, counts }: { eventId: string; counts: Record<Source, number> }) {
  const [google, setGoogle] = useState<{ enabled: boolean; connected: boolean } | null>(null);
  const [job, setJob] = useState<DriveExportView | null>(null);
  const [sources, setSources] = useState<Source[]>(["official", "guest"]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getDriveExport(eventId)
      .then((data) => {
        if (cancelled) return;
        setGoogle(data.google);
        setJob(data.export);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Drive the transfer while it is running and this page is open.
  const pump = useCallback(
    async (start: DriveExportView) => {
      if (running.current) return;
      running.current = true;
      let current = start;
      try {
        while (current.status === "running") {
          current = (await runDriveExportStep(eventId, current.id)).export;
          setJob(current);
        }
      } catch {
        setError("การเชื่อมต่อขาดช่วง จะโอนต่อเมื่อกดปุ่มโอนต่อ");
      } finally {
        running.current = false;
      }
    },
    [eventId],
  );

  useEffect(() => {
    if (job?.status === "running" && !running.current) void pump(job);
  }, [job, pump]);

  const connect = () =>
    authClient.linkSocial({
      provider: "google",
      scopes: [DRIVE_SCOPE],
      callbackURL: `${window.location.pathname}?drive=connected`,
    });

  async function start() {
    setBusy(true);
    setError(null);
    try {
      setJob((await startDriveExport(eventId, sources.filter((s) => counts[s] > 0))).export);
    } catch (err) {
      if (err instanceof ApiError && err.code === "drive_not_connected") {
        setGoogle((g) => g && { ...g, connected: false });
        setError("ต้องเชื่อม Google Drive ใหม่อีกครั้ง");
      } else setError("เริ่มโอนไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!job || !window.confirm("หยุดโอนไฟล์? ไฟล์ที่โอนไปแล้วยังอยู่ใน Google Drive")) return;
    await cancelDriveExport(eventId, job.id);
    setJob({ ...job, status: "canceled" });
  }

  if (!google?.enabled) return null;
  const total = counts.official + counts.guest;
  if (total === 0 && !job) return null;

  const active = job && (job.status === "running" || job.status === "needs_auth");
  const percent = job && job.total > 0 ? Math.round(((job.done + job.failed) / job.total) * 100) : 0;

  return (
    <section className="mt-4 rounded-2xl bg-white px-4 py-4 ring-1 ring-slate-200">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <HardDriveUpload className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">โอนไฟล์ไปที่ Google Drive</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            สร้างโฟลเดอร์ &quot;Tohs Event · ชื่องาน&quot; ใน Drive ของคุณ แล้วส่งรูปและวิดีโอทั้งหมดไปให้ (ไฟล์ต้นฉบับของช่างภาพถ้ามี)
            · Tohs Event เข้าถึงได้เฉพาะไฟล์ที่สร้างเองเท่านั้น
          </p>
        </div>
      </div>

      {active || job?.status === "done" ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm">
            <span>
              {job!.status === "done" ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <Check className="h-4 w-4" /> โอนครบแล้ว
                </span>
              ) : job!.status === "needs_auth" ? (
                <span className="text-amber-700">หยุดชั่วคราว: ต้องเชื่อม Google Drive อีกครั้ง</span>
              ) : (
                "กำลังโอน… เปิดหน้านี้ไว้จนเสร็จ"
              )}
            </span>
            <span className="text-slate-500">
              {(job!.done + job!.failed).toLocaleString("th-TH")}/{job!.total.toLocaleString("th-TH")} ไฟล์ ·{" "}
              {formatBytes(job!.bytes)}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
          {job!.failed > 0 && (
            <p className="mt-2 text-xs text-amber-700">ส่งไม่สำเร็จ {job!.failed} ไฟล์ (ข้ามไปแล้ว)</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={job!.folderUrl}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4" /> เปิดโฟลเดอร์ใน Drive
            </a>
            {job!.status === "needs_auth" && (
              <button type="button" onClick={connect} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white">
                เชื่อม Google Drive อีกครั้ง
              </button>
            )}
            {job!.status === "running" && error && (
              <button type="button" onClick={() => void pump(job!)} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white">
                โอนต่อ
              </button>
            )}
            {active && (
              <button type="button" onClick={cancel} className="px-2 py-1.5 text-sm text-slate-500 underline">
                หยุดโอน
              </button>
            )}
            {job!.status === "done" && (
              <button type="button" onClick={() => setJob(null)} className="px-2 py-1.5 text-sm text-slate-500 underline">
                โอนใหม่อีกครั้ง
              </button>
            )}
          </div>
        </div>
      ) : !google.connected ? (
        <button
          type="button"
          onClick={connect}
          className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          เชื่อม Google Drive
        </button>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {(["official", "guest"] as const).map((source) => (
            <label key={source} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={sources.includes(source)}
                disabled={counts[source] === 0}
                onChange={(e) =>
                  setSources((prev) => (e.target.checked ? [...prev, source] : prev.filter((s) => s !== source)))
                }
              />
              {source === "official" ? "รูป Official" : "รูปจากแขก"} ({counts[source].toLocaleString("th-TH")})
            </label>
          ))}
          <button
            type="button"
            onClick={start}
            disabled={busy || sources.every((s) => counts[s] === 0)}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {busy ? "กำลังสร้างโฟลเดอร์…" : "เริ่มโอนไฟล์"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
