"use client";

import { Camera, Images, LayoutGrid, Moon, Palette, Sun } from "lucide-react";
import { useState } from "react";
import { BRAND_FONT_CLASS } from "@/app/brand-fonts";
import { EventHeader, HeroHeader } from "@/app/e/[slug]/_components/event-header";
import { ApiError, saveAppearance, type Appearance, type PublicEvent } from "@/lib/api-client";
import { showError } from "@/lib/error-popup";

const inputClass =
  "w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; text: string; icon: React.ComponentType<{ className?: string }> }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-w-[8.5rem] flex-1 rounded-xl p-3 text-left ring-1 transition ${
            value === o.value ? "bg-primary-soft ring-2 ring-primary" : "bg-white ring-slate-200 hover:ring-slate-300"
          }`}
        >
          <o.icon className="h-5 w-5 text-primary" />
          <span className="mt-1.5 block text-sm font-medium">{o.label}</span>
          <span className="block text-xs leading-snug text-slate-500">{o.text}</span>
        </button>
      ))}
    </div>
  );
}

const SAMPLE_TILES = [
  ["#60a5fa", "#2563eb", 4 / 3],
  ["#f9a8d4", "#db2777", 3 / 4],
  ["#fcd34d", "#f97316", 1],
  ["#a5b4fc", "#6366f1", 3 / 4],
  ["#6ee7b7", "#059669", 4 / 3],
  ["#c4b5fd", "#7c3aed", 1],
] as const;

/** A phone-sized mock of the guest page with the draft look applied. */
function GuestPreview({ event, appearance }: { event: PublicEvent; appearance: Appearance }) {
  const branding = event.branding;
  const style = branding
    ? ({ "--brand": branding.primaryColor, "--brand-contrast": branding.contrastColor } as React.CSSProperties)
    : undefined;
  const date = new Date(event.date).toLocaleDateString("th-TH", { dateStyle: "long" });
  return (
    <div className="mx-auto w-full max-w-[340px] rounded-[2.2rem] bg-slate-900 p-2.5 shadow-xl">
      <div
        style={style}
        data-theme={appearance.theme}
        className={`guest-page h-[620px] overflow-y-auto rounded-[1.7rem] ${branding ? BRAND_FONT_CLASS[branding.fontId] : ""}`}
      >
        {appearance.header === "hero" && <HeroHeader event={event} date={date} appearance={appearance} />}
        <div className={`px-3 pb-6 ${appearance.header === "hero" ? "relative -mt-8" : "pt-4"}`}>
          {appearance.header !== "hero" && <EventHeader event={event} date={date} appearance={appearance} />}
          <div className={`rounded-3xl bg-card p-3 shadow-sm ring-1 ring-line ${appearance.header === "hero" ? "" : "mt-5"}`}>
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-brand px-3 py-3 text-sm font-medium text-brand-contrast">
              <Camera className="h-4 w-4" />
              {appearance.uploadLabel || "ถ่ายรูป / เลือกรูปเพื่ออัปโหลด"}
            </div>
          </div>
          <div className="mt-6 flex gap-1 rounded-xl bg-surface p-1 text-xs font-medium">
            {(["official", "guest"] as const).map((tab) => (
              <span
                key={tab}
                className={`flex-1 rounded-lg py-1.5 text-center ${appearance.defaultTab === tab ? "bg-card text-brand shadow-sm" : "text-muted"}`}
              >
                {tab === "official" ? "รูปจากช่างภาพ" : "รูปจากแขก"}
              </span>
            ))}
          </div>
          <div className={appearance.gallery === "masonry" ? "mt-3 columns-2 gap-1.5" : "mt-3 grid grid-cols-3 gap-1.5"}>
            {SAMPLE_TILES.map(([from, to, ratio], i) => (
              <div
                key={i}
                className={`rounded-lg ${appearance.gallery === "masonry" ? "mb-1.5 break-inside-avoid" : "aspect-square"}`}
                style={{
                  background: `linear-gradient(135deg, ${from}, ${to})`,
                  ...(appearance.gallery === "masonry" ? { aspectRatio: String(ratio) } : {}),
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Guest page look, available on every plan (colors, logo and cover are Premium branding). */
export function AppearanceEditor({
  eventId,
  event,
  initial,
}: {
  eventId: string;
  event: PublicEvent;
  initial: Appearance;
}) {
  const [appearance, setAppearance] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  function set<K extends keyof Appearance>(key: K, value: Appearance[K]) {
    setAppearance((prev) => ({ ...prev, [key]: value }));
    setState("idle");
  }

  async function save() {
    setState("saving");
    try {
      setAppearance((await saveAppearance(eventId, appearance)).appearance);
      setState("saved");
    } catch (err) {
      setState("idle");
      showError(err instanceof ApiError && err.code === "invalid_body" ? "ข้อความยาวเกินไป" : "บันทึกไม่สำเร็จ ลองอีกครั้ง");
    }
  }

  return (
    <section className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
        <div>
          <h2 className="font-semibold">หน้าตาหน้าแขก</h2>
          <p className="mt-0.5 text-sm text-slate-500">ใช้ได้ทุกแพ็กเกจ · แขกเห็นทันทีหลังบันทึก</p>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium">ธีม</h3>
          <Choice
            value={appearance.theme}
            onChange={(v) => set("theme", v)}
            options={[
              { value: "light", label: "สว่าง", text: "พื้นขาว สะอาดตา", icon: Sun },
              { value: "soft", label: "โทนสีงาน", text: "พื้นอ่อนตามสีของงาน", icon: Palette },
              { value: "dark", label: "มืด", text: "หรูหรา เหมาะกับงานกลางคืน", icon: Moon },
            ]}
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium">ส่วนหัว</h3>
          <Choice
            value={appearance.header}
            onChange={(v) => set("header", v)}
            options={[
              { value: "banner", label: "แบนเนอร์", text: "รูปปกแถบบน ชื่องานด้านล่าง", icon: Images },
              { value: "hero", label: "ภาพเต็มจอ", text: "รูปปกใหญ่ ชื่องานบนรูป", icon: Images },
              { value: "minimal", label: "เรียบง่าย", text: "ตัวอักษรกึ่งกลาง ไม่มีรูปปก", icon: Images },
            ]}
          />
          {!event.branding?.coverUrl && (
            <p className="mt-1.5 text-xs text-slate-500">ยังไม่มีรูปปก จะใช้ลวดลายสีของงานแทน (ใส่รูปปกได้ในส่วนแบรนด์ด้านล่าง)</p>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium">การจัดเรียงรูป</h3>
          <Choice
            value={appearance.gallery}
            onChange={(v) => set("gallery", v)}
            options={[
              { value: "grid", label: "ตาราง", text: "ช่องสี่เหลี่ยมเท่ากัน", icon: LayoutGrid },
              { value: "masonry", label: "ตามสัดส่วน", text: "รูปแนวตั้ง-นอนเต็มสัดส่วน", icon: LayoutGrid },
            ]}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">แท็บที่เปิดก่อน</span>
            <select
              value={appearance.defaultTab}
              onChange={(e) => set("defaultTab", e.target.value as Appearance["defaultTab"])}
              className={`mt-1.5 ${inputClass}`}
            >
              <option value="guest">รูปจากแขก</option>
              <option value="official">รูปจากช่างภาพ</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">ข้อความปุ่มอัปโหลด</span>
            <input
              value={appearance.uploadLabel ?? ""}
              onChange={(e) => set("uploadLabel", e.target.value || null)}
              maxLength={40}
              placeholder="ถ่ายรูป / เลือกรูปเพื่ออัปโหลด"
              className={`mt-1.5 ${inputClass}`}
            />
          </label>
        </div>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">แสดงวันที่งาน</span>
          <input
            type="checkbox"
            checked={appearance.showDate}
            onChange={(e) => set("showDate", e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
        </label>
        <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={save}
            disabled={state === "saving"}
            className="rounded-xl bg-primary px-6 py-2.5 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {state === "saving" ? "กำลังบันทึก…" : "บันทึก"}
          </button>
          {state === "saved" && <span className="text-sm text-emerald-700">บันทึกแล้ว</span>}
        </div>
      </div>
      <div className="lg:sticky lg:top-20 lg:self-start">
        <p className="mb-2 text-center text-xs text-slate-500">ตัวอย่างบนมือถือ</p>
        <GuestPreview event={event} appearance={appearance} />
      </div>
    </section>
  );
}
