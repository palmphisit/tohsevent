"use client";

import { CheckCircle2, Download, Footprints, Mail, Search, Undo2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { listHostRegistrations, updateRegistration, type HostRegistration, type RegistrationStats } from "@/lib/api-client";
import { showError } from "@/lib/error-popup";

type Filter = "all" | "in" | "out" | "cancelled";

const time = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

/** Attendee list with search, filters, check-in/undo, cancel, re-send ticket and CSV export. */
export function AttendeeList({
  eventId,
  initial,
  emailAvailable,
}: {
  eventId: string;
  initial: { items: HostRegistration[]; stats: RegistrationStats };
  /** Email is set up, so tickets can be sent again. */
  emailAvailable: boolean;
}) {
  const [items, setItems] = useState(initial.items);
  const [stats, setStats] = useState(initial.stats);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await listHostRegistrations(eventId, { q, filter });
    setItems(data.items);
    setStats(data.stats);
  }, [eventId, q, filter]);

  useEffect(() => {
    const timer = setTimeout(() => void load().catch(() => {}), 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function act(reg: HostRegistration, action: "checkin" | "undo" | "cancel" | "email") {
    if (action === "cancel" && !window.confirm(`ยกเลิกการลงทะเบียนของ ${reg.name}?`)) return;
    if (action === "email" && !window.confirm(`ส่งบัตรเข้างานไปที่ ${reg.email} อีกครั้ง?`)) return;
    setBusy(reg.id);
    try {
      await updateRegistration(eventId, reg.id, action);
      await load();
    } catch {
      showError(action === "email" ? "ส่งอีเมลไม่สำเร็จ ลองอีกครั้ง" : "ทำรายการไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: `ทั้งหมด ${stats.registrations}` },
    { value: "in", label: `เข้างานแล้ว ${stats.checkedIn}` },
    { value: "out", label: `ยังไม่มา ${stats.registrations - stats.checkedIn}` },
    { value: "cancelled", label: "ยกเลิก" },
  ];

  return (
    <section className="rounded-2xl bg-white ring-1 ring-slate-200">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อ อีเมล เบอร์โทร หรือรหัสบัตร"
            className="w-full rounded-xl border border-slate-300 py-2.5 pr-3 pl-9 text-sm outline-none focus:border-primary"
          />
        </div>
        <a
          href={`/api/v1/host/events/${eventId}/registrations/export`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
        >
          <Download className="h-4 w-4" /> Export CSV
        </a>
      </div>
      <div className="flex gap-1 overflow-x-auto px-4 pt-3 [scrollbar-width:none]">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${filter === f.value ? "bg-primary text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">ยังไม่มีรายชื่อ</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {items.map((reg) => (
            <li key={reg.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {reg.name}
                  {reg.partySize > 1 && <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-600">{reg.partySize} คน</span>}
                  {reg.source === "onsite" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 text-xs text-amber-800">
                      <Footprints className="h-3 w-3" /> หน้างาน
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {[reg.email, reg.phone, reg.organization].filter(Boolean).join(" · ") || "—"} · <span className="font-mono">{reg.code}</span>
                </p>
                {reg.answer && <p className="text-xs text-slate-600">“{reg.answer}”</p>}
              </div>
              <div className="flex items-center gap-2 text-sm">
                {reg.status === "cancelled" ? (
                  <span className="text-slate-400">ยกเลิกแล้ว</span>
                ) : reg.checkedInAt ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> เข้างาน {time(reg.checkedInAt)}
                    </span>
                    <button type="button" disabled={busy === reg.id} onClick={() => act(reg, "undo")} title="ยกเลิกการเช็กอิน" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                      <Undo2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-slate-400">ลงทะเบียน {time(reg.createdAt)}</span>
                    {emailAvailable && reg.email && (
                      <button
                        type="button"
                        disabled={busy === reg.id}
                        onClick={() => act(reg, "email")}
                        title={reg.emailedAt ? `ส่งบัตรทางอีเมลอีกครั้ง (ส่งล่าสุด ${time(reg.emailedAt)})` : "ส่งบัตรทางอีเมล"}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary"
                      >
                        <Mail className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy === reg.id}
                      onClick={() => act(reg, "checkin")}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                    >
                      เช็กอิน
                    </button>
                    <button type="button" disabled={busy === reg.id} onClick={() => act(reg, "cancel")} title="ยกเลิกการลงทะเบียน" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600">
                      <XCircle className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
