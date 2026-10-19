"use client";

import { useState } from "react";
import { saveRegistrationSettings, type RegistrationSettings } from "@/lib/api-client";
import { showError } from "@/lib/error-popup";

const input =
  "w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

/** "YYYY-MM-DDTHH:mm" in Bangkok time <-> Date, for <input type="datetime-local">. */
const toLocal = (iso: string | Date | null) =>
  iso ? new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString().slice(0, 16) : "";
const fromLocal = (value: string) => (value ? new Date(`${value}:00+07:00`) : null);

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2.5">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-primary" />
        <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/** Registration on/off, capacity, deadline and which questions to ask. */
export function SettingsForm({ eventId, initial, maxGuests }: { eventId: string; initial: RegistrationSettings; maxGuests: number }) {
  const [settings, setSettings] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  function set<K extends keyof RegistrationSettings>(key: K, value: RegistrationSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setState("idle");
  }

  async function save(next = settings) {
    setState("saving");
    try {
      setSettings((await saveRegistrationSettings(eventId, next)).settings);
      setState("saved");
    } catch {
      setState("idle");
      showError("บันทึกไม่สำเร็จ ลองอีกครั้ง");
    }
  }

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
      <div className="divide-y divide-slate-100">
        <Toggle
          label="เปิดรับลงทะเบียน"
          hint="แขกลงทะเบียนล่วงหน้าที่หน้ารายละเอียดงาน และรับบัตรพร้อม QR สำหรับเช็กอิน"
          checked={settings.enabled}
          onChange={(v) => {
            const next = { ...settings, enabled: v };
            setSettings(next);
            void save(next);
          }}
        />
        <div className="grid gap-3 py-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-slate-600">จำนวนที่รับ (คน)</span>
            <input
              type="number"
              min={1}
              max={maxGuests}
              value={settings.capacity ?? ""}
              onChange={(e) => set("capacity", e.target.value ? Number(e.target.value) : null)}
              placeholder={`ไม่ระบุ = สูงสุดตามแพ็กเกจ (${maxGuests.toLocaleString("th-TH")})`}
              className={`mt-1 ${input}`}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">ปิดรับลงทะเบียนออนไลน์</span>
            <input
              type="datetime-local"
              value={toLocal(settings.closesAt)}
              onChange={(e) => set("closesAt", fromLocal(e.target.value))}
              className={`mt-1 ${input}`}
            />
            <span className="mt-1 block text-xs text-slate-500">ไม่ระบุ = ปิดเมื่อจบวันงาน (ลงทะเบียนหน้างานได้ตลอด)</span>
          </label>
        </div>
        <Toggle label="ถามเบอร์โทรศัพท์" checked={settings.askPhone} onChange={(v) => set("askPhone", v)} />
        <Toggle label="ถามบริษัท / องค์กร" checked={settings.askOrganization} onChange={(v) => set("askOrganization", v)} />
        <Toggle label="ให้ระบุจำนวนผู้ติดตาม" hint="นับรวมในจำนวนที่รับ" checked={settings.askPartySize} onChange={(v) => set("askPartySize", v)} />
        <label className="block py-3 text-sm">
          <span className="text-slate-600">คำถามเพิ่มเติม (ไม่บังคับ)</span>
          <input
            value={settings.question ?? ""}
            onChange={(e) => set("question", e.target.value || null)}
            maxLength={200}
            placeholder="เช่น แพ้อาหารอะไรไหม? / ไซซ์เสื้อ"
            className={`mt-1 ${input}`}
          />
        </label>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button type="button" onClick={() => save()} disabled={state === "saving"} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50">
          {state === "saving" ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
        </button>
        {state === "saved" && <span className="text-sm text-emerald-700">บันทึกแล้ว</span>}
      </div>
    </section>
  );
}
