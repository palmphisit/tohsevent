"use client";

import { CheckCircle2, Ticket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, registerForEvent } from "@/lib/api-client";
import { showError } from "@/lib/error-popup";
import { useLocale } from "@/lib/use-locale";
import { INTL_LOCALE, localePath, switchLocalePath } from "@/lib/i18n";

const input =
  "w-full rounded-xl border border-line bg-transparent px-4 py-3 text-base outline-none placeholder:text-muted focus:border-brand";


const T = {
  en: {
    errors: {
      already_registered: "This email is already registered for this event. Check your ticket or contact the organizer.",
      registration_full: "Fully booked",
      registration_closed: "Online registration has closed",
      registration_off: "Registration isn't open for this event",
      email_required: "Please enter your email to receive your ticket",
      phone_required: "Please enter your phone number",
    } as Record<string, string>,
    failed: "Registration failed. Please try again.",
    doneTitle: "You're registered and checked in",
    arrivedAt: (time: string) => `Arrived at ${time}. Welcome!`,
    myTicket: "View my ticket",
    fullName: "Full name *",
    emailOptional: "Email (optional)",
    emailRequired: "Email * (for your ticket)",
    phoneOptional: "Phone (optional)",
    phoneRequired: "Phone *",
    organization: "Company / organization",
    partySize: "People attending (including you)",
    people: (n: number) => `${n} ${n === 1 ? "person" : "people"}`,
    consent: "I agree that the organizer may use this information for this event's registration and check-in, under the",
    privacy: "privacy policy",
    registering: "Registering…",
    registerCheckIn: "Register and check in",
    register: "Register",
  },
  th: {
    errors: {
      already_registered: "อีเมลนี้ลงทะเบียนงานนี้ไว้แล้ว ตรวจสอบบัตรในอีเมลหรือติดต่อผู้จัดงาน",
      registration_full: "ที่นั่งเต็มแล้ว",
      registration_closed: "ปิดรับลงทะเบียนออนไลน์แล้ว",
      registration_off: "งานนี้ยังไม่เปิดลงทะเบียน",
      email_required: "กรุณากรอกอีเมลเพื่อรับบัตรเข้างาน",
      phone_required: "กรุณากรอกเบอร์โทรศัพท์",
    } as Record<string, string>,
    failed: "ลงทะเบียนไม่สำเร็จ ลองอีกครั้ง",
    doneTitle: "ลงทะเบียนและเช็กอินแล้ว",
    arrivedAt: (time: string) => `เวลาเข้างาน ${time} น. ยินดีต้อนรับ!`,
    myTicket: "ดูบัตรของฉัน",
    fullName: "ชื่อ-นามสกุล *",
    emailOptional: "อีเมล (ไม่บังคับ)",
    emailRequired: "อีเมล * (ใช้รับบัตรเข้างาน)",
    phoneOptional: "เบอร์โทรศัพท์ (ไม่บังคับ)",
    phoneRequired: "เบอร์โทรศัพท์ *",
    organization: "บริษัท / องค์กร",
    partySize: "จำนวนผู้มาร่วมงาน (รวมตัวคุณ)",
    people: (n: number) => `${n} คน`,
    consent: "ยินยอมให้ผู้จัดงานใช้ข้อมูลนี้เพื่อการลงทะเบียนและเช็กอินของงานนี้ ตาม",
    privacy: "นโยบายความเป็นส่วนตัว",
    registering: "กำลังลงทะเบียน…",
    registerCheckIn: "ลงทะเบียนและเช็กอิน",
    register: "ลงทะเบียนร่วมงาน",
  },
};

export interface RegisterFormProps {
  slug: string;
  ask: { phone: boolean; organization: boolean; partySize: boolean; question: string | null };
  /** On-site poster key: sign-up at the door, checked in right away. */
  onsiteKey: string | null;
}

export function RegisterForm({ slug, ask, onsiteKey }: RegisterFormProps) {
  const locale = useLocale();
  const t = T[locale];
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
      const ticketPath = switchLocalePath(new URL(result.ticketUrl).pathname, locale);
      if (onsite && result.checkedInAt) {
        setArrived({
          time: new Date(result.checkedInAt).toLocaleTimeString(INTL_LOCALE[locale], { hour: "2-digit", minute: "2-digit" }),
          ticket: ticketPath,
        });
      } else router.push(ticketPath);
    } catch (err) {
      showError((err instanceof ApiError && t.errors[err.code]) || t.failed);
    } finally {
      setPending(false);
    }
  }

  if (arrived) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <CheckCircle2 className="h-14 w-14 text-emerald-500" />
        <p className="mt-3 text-xl font-semibold">{t.doneTitle}</p>
        <p className="mt-1 text-ink/70">{t.arrivedAt(arrived.time)}</p>
        <Link href={arrived.ticket} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-surface px-4 py-2.5 text-sm font-medium">
          <Ticket className="h-4 w-4" /> {t.myTicket}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input required maxLength={80} value={form.name} onChange={set("name")} placeholder={t.fullName} autoComplete="name" className={input} />
      <input
        type="email"
        required={!onsite}
        value={form.email}
        onChange={set("email")}
        placeholder={onsite ? t.emailOptional : t.emailRequired}
        autoComplete="email"
        className={input}
      />
      {ask.phone && (
        <input
          type="tel"
          required={!onsite}
          value={form.phone}
          onChange={set("phone")}
          placeholder={onsite ? t.phoneOptional : t.phoneRequired}
          autoComplete="tel"
          className={input}
        />
      )}
      {ask.organization && (
        <input value={form.organization} onChange={set("organization")} maxLength={120} placeholder={t.organization} className={input} />
      )}
      {ask.partySize && (
        <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5 text-sm">
          <span>{t.partySize}</span>
          <select value={form.partySize} onChange={set("partySize")} className="rounded-lg bg-transparent px-2 py-1 font-semibold">
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {t.people(i + 1)}
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
          {t.consent}{" "}
          <Link href={localePath(locale, "/privacy")} target="_blank" className="underline">
            {t.privacy}
          </Link>
        </span>
      </label>
      <button
        disabled={pending}
        className="w-full rounded-2xl bg-brand px-4 py-4 text-lg font-semibold text-brand-contrast shadow-lg shadow-black/5 transition hover:opacity-95 disabled:opacity-50"
      >
        {pending ? t.registering : onsite ? t.registerCheckIn : t.register}
      </button>
    </form>
  );
}
