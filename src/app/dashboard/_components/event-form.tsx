"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, createHostEvent, updateHostEvent, type HostEvent } from "@/lib/api-client";
import { showError } from "@/lib/error-popup";

const inputClass =
  "w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-50";

const ERRORS: Record<string, string> = {
  slug_taken: "ลิงก์นี้ถูกใช้แล้ว ลองชื่ออื่น",
  password_required: "กรุณาตั้งรหัสผ่านสำหรับงานที่ต้องใช้รหัสผ่าน",
  invalid_body: "ข้อมูลไม่ถูกต้อง ตรวจสอบอีกครั้ง",
  event_expired: "อัลบั้มนี้หมดอายุแล้ว อัปเกรดแพ็กเกจเพื่อเปิดอีกครั้ง",
};

function today(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in the local time zone
}

/** Create a new event (no `event`) or edit an existing one. */
export function EventForm({ event }: { event?: HostEvent }) {
  const router = useRouter();
  const editing = !!event;
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? today);
  const [slug, setSlug] = useState("");
  const [accessMode, setAccessMode] = useState<HostEvent["accessMode"]>(event?.accessMode ?? "public");
  const [password, setPassword] = useState("");
  const [guestUpload, setGuestUpload] = useState(event?.guestUpload ?? true);
  const [status, setStatus] = useState<"live" | "closed">(event?.status === "closed" ? "closed" : "live");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const needsPassword = accessMode === "password" && event?.accessMode !== "password";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setSaved(false);
    try {
      if (editing) {
        await updateHostEvent(event.id, {
          title,
          date,
          accessMode,
          guestUpload,
          status,
          ...(password ? { password } : {}),
        });
        setPassword("");
        setSaved(true);
        router.refresh();
      } else {
        const { event: created } = await createHostEvent({
          title,
          date,
          accessMode,
          ...(slug ? { slug } : {}),
          ...(password ? { password } : {}),
        });
        router.push(`/dashboard/events/${created.id}`);
      }
    } catch (err) {
      showError((err instanceof ApiError && ERRORS[err.code]) || "บันทึกไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="ชื่องาน">
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="เช่น งานแต่งงาน ต้น & ฝน"
          className={inputClass}
        />
      </Field>

      <Field label="วันที่จัดงาน">
        <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </Field>

      {!editing && (
        <Field label="ลิงก์ของงาน (ไม่บังคับ)" hint="เว้นว่างไว้เพื่อสุ่มให้อัตโนมัติ เปลี่ยนภายหลังไม่ได้เพราะจะทำให้ QR ที่พิมพ์ไปแล้วใช้ไม่ได้">
          <div className="flex items-center rounded-xl border border-slate-300 focus-within:border-primary">
            <span className="pl-4 text-slate-400">/e/</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]"
              title="ตัวอักษรภาษาอังกฤษพิมพ์เล็ก ตัวเลข หรือ - ความยาว 3–40 ตัว"
              placeholder="ton-fon-wedding"
              className="w-full rounded-xl px-1 py-3 text-base outline-none"
            />
          </div>
        </Field>
      )}

      <Field label="การเข้าถึง">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["public", "สาธารณะ", "ใครมี QR ก็เข้าได้"],
              ["password", "ใช้รหัสผ่าน", "แขกต้องกรอกรหัสก่อน"],
            ] as const
          ).map(([value, label, desc]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-xl border px-4 py-3 ${accessMode === value ? "border-primary bg-primary-soft" : "border-slate-300"}`}
            >
              <input
                type="radio"
                name="accessMode"
                value={value}
                checked={accessMode === value}
                onChange={() => setAccessMode(value)}
                className="sr-only"
              />
              <span className="block font-medium">{label}</span>
              <span className="block text-xs text-slate-500">{desc}</span>
            </label>
          ))}
        </div>
      </Field>

      {accessMode === "password" && (
        <Field label={needsPassword ? "รหัสผ่านของงาน" : "เปลี่ยนรหัสผ่าน (ไม่บังคับ)"}>
          <input
            required={needsPassword}
            type="text"
            minLength={4}
            maxLength={64}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            placeholder={needsPassword ? "อย่างน้อย 4 ตัวอักษร" : "เว้นว่างเพื่อใช้รหัสเดิม"}
            className={inputClass}
          />
        </Field>
      )}

      {editing && (
        <>
          <Toggle
            checked={guestUpload}
            onChange={setGuestUpload}
            label="เปิดให้แขกอัปโหลดรูป"
            hint="ปิดเมื่องานจบแล้ว แขกจะยังดูและเซฟรูปได้"
          />
          <Toggle
            checked={status === "live"}
            onChange={(on) => setStatus(on ? "live" : "closed")}
            label="เปิดหน้างานให้แขกเข้าชม"
            hint="ถ้าปิด แขกที่สแกน QR จะเข้าหน้างานไม่ได้"
          />
        </>
      )}
      {saved && <p className="text-sm text-emerald-700">บันทึกแล้ว</p>}

      <button
        disabled={pending}
        className="w-full rounded-xl bg-primary hover:bg-primary-hover px-4 py-3 font-medium text-white disabled:opacity-50 sm:w-auto sm:px-8"
      >
        {pending ? "กำลังบันทึก…" : editing ? "บันทึกการเปลี่ยนแปลง" : "สร้างงาน"}
      </button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-300 px-4 py-3">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-primary"
      />
    </label>
  );
}
