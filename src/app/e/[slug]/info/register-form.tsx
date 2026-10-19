"use client";

import { CheckCircle2, Ticket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, registerForEvent } from "@/lib/api-client";
import { showError } from "@/lib/error-popup";

const input =
  "w-full rounded-xl border border-line bg-transparent px-4 py-3 text-base outline-none placeholder:text-muted focus:border-brand";

const ERRORS: Record<string, string> = {
  already_registered: "อีเมลนี้ลงทะเบียนงานนี้ไว้แล้ว ตรวจสอบบัตรในอีเมลหรือติดต่อผู้จัดงาน",
  registration_full: "ที่นั่งเต็มแล้ว",
  registration_closed: "ปิดรับลงทะเบียนออนไลน์แล้ว",
  registration_off: "งานนี้ยังไม่เปิดลงทะเบียน",
  email_required: "กรุณากรอกอีเมลเพื่อรับบัตรเข้างาน",
  phone_required: "กรุณากรอกเบอร์โทรศัพท์",
};

export interface RegisterFormProps {
  slug: string;
  ask: { phone: boolean; organization: boolean; partySize: boolean; question: string | null };
  /** On-site poster key: sign-up at the door, checked in right away. */
  onsiteKey: string | null;
}

export function RegisterForm({ slug, ask, onsiteKey }: RegisterFormProps) {
  const router = useRouter();
  const onsite = !!onsiteKey;
  const [form, setForm] = useState({ name: "", email: "", phone: "", organization: "", partySize: 1, answer: "" });
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [arrived, setArrived] = useState<{ time: string; ticket: string } | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: key === "partySize" ? Number(e.target.value) : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await registerForEvent(
        slug,
        {
          name: form.name,
          email: form.email || null,
          phone: ask.phone ? form.phone || null : null,
          organization: ask.organization ? form.organization || null : null,
          partySize: ask.partySize ? form.partySize : undefined,
          answer: ask.question ? form.answer || null : null,
          consent: true,
        },
        onsiteKey,
      );
      const ticketPath = new URL(result.ticketUrl).pathname;
      if (onsite && result.checkedInAt) {
        setArrived({
          time: new Date(result.checkedInAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
          ticket: ticketPath,
        });
      } else router.push(ticketPath);
    } catch (err) {
      showError((err instanceof ApiError && ERRORS[err.code]) || "ลงทะเบียนไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setPending(false);
    }
  }

  if (arrived) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <CheckCircle2 className="h-14 w-14 text-emerald-500" />
        <p className="mt-3 text-xl font-semibold">ลงทะเบียนและเช็กอินแล้ว</p>
        <p className="mt-1 text-ink/70">เวลาเข้างาน {arrived.time} น. ยินดีต้อนรับ!</p>
        <Link href={arrived.ticket} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-surface px-4 py-2.5 text-sm font-medium">
          <Ticket className="h-4 w-4" /> ดูบัตรของฉัน
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input required maxLength={80} value={form.name} onChange={set("name")} placeholder="ชื่อ-นามสกุล *" autoComplete="name" className={input} />
      <input
        type="email"
        required={!onsite}
        value={form.email}
        onChange={set("email")}
        placeholder={onsite ? "อีเมล (ไม่บังคับ)" : "อีเมล * (ใช้รับบัตรเข้างาน)"}
        autoComplete="email"
        className={input}
      />
      {ask.phone && (
        <input
          type="tel"
          required={!onsite}
          value={form.phone}
          onChange={set("phone")}
          placeholder={onsite ? "เบอร์โทรศัพท์ (ไม่บังคับ)" : "เบอร์โทรศัพท์ *"}
          autoComplete="tel"
          className={input}
        />
      )}
      {ask.organization && (
        <input value={form.organization} onChange={set("organization")} maxLength={120} placeholder="บริษัท / องค์กร" className={input} />
      )}
      {ask.partySize && (
        <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5 text-sm">
          <span>จำนวนผู้มาร่วมงาน (รวมตัวคุณ)</span>
          <select value={form.partySize} onChange={set("partySize")} className="rounded-lg bg-transparent px-2 py-1 font-semibold">
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} คน
              </option>
            ))}
          </select>
        </label>
      )}
      {ask.question && (
        <label className="block text-sm">
          <span className="text-ink/80">{ask.question}</span>
          <textarea value={form.answer} onChange={set("answer")} maxLength={500} rows={2} className={`mt-1.5 ${input}`} />
        </label>
      )}
      <label className="flex items-start gap-2.5 text-sm text-ink/75">
        <input type="checkbox" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-brand)]" />
        <span>
          ยินยอมให้ผู้จัดงานใช้ข้อมูลนี้เพื่อการลงทะเบียนและเช็กอินของงานนี้ ตาม{" "}
          <Link href="/privacy" target="_blank" className="underline">
            นโยบายความเป็นส่วนตัว
          </Link>
        </span>
      </label>
      <button
        disabled={pending}
        className="w-full rounded-2xl bg-brand px-4 py-4 text-lg font-semibold text-brand-contrast shadow-lg shadow-black/5 transition hover:opacity-95 disabled:opacity-50"
      >
        {pending ? "กำลังลงทะเบียน…" : onsite ? "ลงทะเบียนและเช็กอิน" : "ลงทะเบียนร่วมงาน"}
      </button>
    </form>
  );
}
