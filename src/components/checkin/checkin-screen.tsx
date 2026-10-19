"use client";

import { AlertTriangle, CheckCircle2, Footprints, RefreshCw, Search, Undo2, UserPlus, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  checkInGuest,
  listCheckins,
  registerWalkIn,
  undoGuestCheckIn,
  type HostRegistration,
  type RegistrationStats,
} from "@/lib/api-client";
import { showError } from "@/lib/error-popup";
import { QrScanner } from "./qr-scanner";

type Flash =
  | { kind: "ok"; reg: HostRegistration }
  | { kind: "again"; reg: HostRegistration }
  | { kind: "error"; message: string };

const clock = (iso: string) => new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

const SCAN_ERRORS: Record<string, string> = {
  invalid_ticket: "QR นี้ไม่ใช่บัตรของงาน",
  ticket_not_found: "ไม่พบบัตรนี้ในงานนี้",
  registration_cancelled: "บัตรนี้ถูกยกเลิกแล้ว",
};

/**
 * Door check-in: scan tickets, search the list, sign up walk-ins. Every check-in stores the
 * arrival time. `staffKey` is the check-in link's key; without it the signed-in host is used.
 */
export function CheckinScreen({
  slug,
  staffKey,
  title,
  ask,
}: {
  slug: string;
  staffKey: string | null;
  title: string;
  ask: { phone: boolean; organization: boolean; partySize: boolean };
}) {
  const [stats, setStats] = useState<RegistrationStats | null>(null);
  const [items, setItems] = useState<HostRegistration[]>([]);
  const [q, setQ] = useState("");
  const [flash, setFlash] = useState<Flash | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const recent = useRef(new Map<string, number>());
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const data = await listCheckins(slug, { key: staffKey, q, filter: "all" });
      setItems(data.items);
      setStats(data.stats);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) showError("ลิงก์เช็กอินไม่ถูกต้อง ขอลิงก์ใหม่จากผู้จัดงาน");
    }
  }, [slug, staffKey, q]);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), q ? 250 : 0);
    const timer = setInterval(() => void refresh(), 10_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh, q]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), flash.kind === "ok" ? 2500 : 3500);
    return () => clearTimeout(timer);
  }, [flash]);

  function feedback(kind: Flash["kind"]) {
    navigator.vibrate?.(kind === "ok" ? 80 : [60, 60, 60]);
  }

  async function submit(body: { scan?: string; id?: string }) {
    if (busy.current) return;
    busy.current = true;
    try {
      const result = await checkInGuest(slug, { key: staffKey, ...body });
      const next: Flash = result.already ? { kind: "again", reg: result.registration } : { kind: "ok", reg: result.registration };
      setFlash(next);
      feedback(next.kind);
      void refresh();
    } catch (error) {
      setFlash({ kind: "error", message: (error instanceof ApiError && SCAN_ERRORS[error.code]) || "เช็กอินไม่สำเร็จ ลองอีกครั้ง" });
      feedback("error");
    } finally {
      busy.current = false;
    }
  }

  function onScan(text: string) {
    // The same QR stays in front of the camera for a while: ignore repeats for 5 s.
    const now = Date.now();
    if ((recent.current.get(text) ?? 0) > now - 5000) return;
    recent.current.set(text, now);
    void submit({ scan: text });
  }

  async function undo(reg: HostRegistration) {
    if (!window.confirm(`ยกเลิกการเช็กอินของ ${reg.name}?`)) return;
    try {
      await undoGuestCheckIn(slug, { key: staffKey, id: reg.id });
      void refresh();
    } catch {
      showError("ทำรายการไม่สำเร็จ");
    }
  }

  const pct = stats && stats.headcount > 0 ? Math.round((stats.checkedInHeadcount / stats.headcount) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-primary">เช็กอินหน้างาน</p>
          <h1 className="truncate text-xl font-semibold">{title}</h1>
        </div>
        <button type="button" onClick={() => void refresh()} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="รีเฟรช">
          <RefreshCw className="h-5 w-5" />
        </button>
      </header>

      {stats && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <div className="flex items-end justify-between">
            <p className="text-sm text-slate-500">เข้างานแล้ว</p>
            <p>
              <span className="text-3xl font-semibold tabular-nums">{stats.checkedInHeadcount.toLocaleString("th-TH")}</span>
              <span className="text-slate-400"> / {stats.headcount.toLocaleString("th-TH")} คน</span>
            </p>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            {pct}% · ลงทะเบียนหน้างาน {stats.onsite.toLocaleString("th-TH")} รายการ
          </p>
        </div>
      )}

      <div className="relative">
        <QrScanner onScan={onScan} paused={!!flash || walkIn} />
        {flash && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center rounded-3xl p-6 text-center text-white ${
              flash.kind === "ok" ? "bg-emerald-600/95" : flash.kind === "again" ? "bg-amber-500/95" : "bg-red-600/95"
            }`}
            onClick={() => setFlash(null)}
          >
            {flash.kind === "ok" ? <CheckCircle2 className="h-16 w-16" /> : flash.kind === "again" ? <AlertTriangle className="h-16 w-16" /> : <XCircle className="h-16 w-16" />}
            {flash.kind === "error" ? (
              <p className="mt-3 text-xl font-semibold">{flash.message}</p>
            ) : (
              <>
                <p className="mt-3 text-2xl font-semibold">{flash.reg.name}</p>
                {flash.reg.partySize > 1 && <p className="text-lg">{flash.reg.partySize} คน</p>}
                <p className="mt-1 text-white/90">
                  {flash.kind === "ok" ? `เช็กอินแล้ว ${clock(flash.reg.checkedInAt!)} น.` : `เช็กอินไปแล้วเมื่อ ${clock(flash.reg.checkedInAt!)} น.`}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setWalkIn(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3.5 font-medium text-white"
      >
        <UserPlus className="h-5 w-5" /> ลงทะเบียนหน้างาน (walk-in)
      </button>

      <section className="rounded-2xl bg-white ring-1 ring-slate-200">
        <div className="relative p-3">
          <Search className="pointer-events-none absolute top-1/2 left-6 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อ เบอร์โทร หรือรหัสบัตร"
            className="w-full rounded-xl border border-slate-300 py-3 pr-3 pl-9 text-base outline-none focus:border-primary"
          />
        </div>
        <ul className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto">
          {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">ไม่พบรายชื่อ</li>}
          {items.map((reg) => (
            <li key={reg.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-medium">
                  {reg.name}
                  {reg.partySize > 1 && <span className="text-xs text-slate-500">({reg.partySize})</span>}
                  {reg.source === "onsite" && <Footprints className="h-3.5 w-3.5 text-amber-600" />}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {[reg.phone, reg.organization].filter(Boolean).join(" · ") || reg.email || "—"} · <span className="font-mono">{reg.code}</span>
                </p>
              </div>
              {reg.checkedInAt ? (
                <span className="flex items-center gap-1">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">{clock(reg.checkedInAt)} น.</span>
                  <button type="button" onClick={() => undo(reg)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="ยกเลิกการเช็กอิน">
                    <Undo2 className="h-4 w-4" />
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => void submit({ id: reg.id })} className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white">
                  เช็กอิน
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {walkIn && (
        <WalkInSheet
          ask={ask}
          onClose={() => setWalkIn(false)}
          onSubmit={async (input) => {
            const { registration } = await registerWalkIn(slug, { ...input, consent: true }, staffKey);
            setWalkIn(false);
            setFlash({ kind: "ok", reg: registration });
            feedback("ok");
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function WalkInSheet({
  ask,
  onClose,
  onSubmit,
}: {
  ask: { phone: boolean; organization: boolean; partySize: boolean };
  onClose: () => void;
  onSubmit: (input: { name: string; phone: string | null; email: string | null; organization: string | null; partySize?: number }) => Promise<void>;
}) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", organization: "", partySize: 1 });
  const [pending, setPending] = useState(false);
  const input = "w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-primary";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await onSubmit({
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        organization: form.organization || null,
        partySize: ask.partySize ? form.partySize : undefined,
      });
    } catch (error) {
      showError(
        error instanceof ApiError && error.code === "registration_full"
          ? "ที่นั่งเต็มแล้ว"
          : error instanceof ApiError && error.code === "already_registered"
            ? "อีเมลนี้ลงทะเบียนไว้แล้ว ค้นหาชื่อในรายการแทน"
            : "ลงทะเบียนไม่สำเร็จ ลองอีกครั้ง",
      );
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">ลงทะเบียนหน้างาน</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="rounded-lg p-1 text-slate-400">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-slate-500">บันทึกเวลาเข้างานทันทีหลังลงทะเบียน · ผู้ลงทะเบียนยินยอมให้ใช้ข้อมูลเพื่อการลงทะเบียนของงานนี้</p>
        <input required autoFocus maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ชื่อ-นามสกุล *" className={input} />
        {ask.phone && <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="เบอร์โทรศัพท์" className={input} />}
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="อีเมล (ไม่บังคับ)" className={input} />
        {ask.organization && (
          <input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} placeholder="บริษัท / องค์กร" className={input} />
        )}
        {ask.partySize && (
          <label className="flex items-center justify-between rounded-xl border border-slate-300 px-4 py-2.5 text-sm">
            จำนวนคน
            <select value={form.partySize} onChange={(e) => setForm({ ...form, partySize: Number(e.target.value) })} className="font-semibold">
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
        )}
        <button disabled={pending} className="w-full rounded-2xl bg-primary px-4 py-3.5 font-semibold text-white disabled:opacity-50">
          {pending ? "กำลังบันทึก…" : "ลงทะเบียนและเช็กอิน"}
        </button>
      </form>
    </div>
  );
}
