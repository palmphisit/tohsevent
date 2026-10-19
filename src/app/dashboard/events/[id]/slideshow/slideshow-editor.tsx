"use client";

import { ExternalLink, LayoutGrid, MonitorPlay, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { InstagramIcon } from "@/components/instagram-icon";
import { SlideshowView } from "@/components/slideshow/slideshow-view";
import { ApiError, saveSlideshow, type PublicEvent, type SlideshowSettings } from "@/lib/api-client";
import { CopyButton } from "../../../_components/copy-button";
import { showError } from "@/lib/error-popup";

const inputClass =
  "w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            value === o.value ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-primary" />
    </label>
  );
}

export function SlideshowEditor({
  eventId,
  slug,
  apiKey,
  url,
  event,
  initial,
  qrSvg,
  guestUrl,
}: {
  eventId: string;
  slug: string;
  apiKey: string;
  url: string;
  event: PublicEvent;
  initial: SlideshowSettings;
  qrSvg: string;
  guestUrl: string;
}) {
  const [settings, setSettings] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const demoRef = useRef<(() => void) | null>(null);
  const dirty = JSON.stringify(settings) !== JSON.stringify(initial) && state !== "saved";

  function set<K extends keyof SlideshowSettings>(key: K, value: SlideshowSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setState("idle");
  }

  async function save() {
    setState("saving");
    try {
      const { slideshow } = await saveSlideshow(eventId, settings);
      setSettings(slideshow);
      setState("saved");
    } catch (err) {
      setState("idle");
      showError(err instanceof ApiError && err.code === "invalid_body" ? "ข้อมูลไม่ถูกต้อง ตรวจสอบความยาวข้อความ" : "บันทึกไม่สำเร็จ ลองอีกครั้ง");
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{url}</span>
            <CopyButton text={url} />
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <ExternalLink className="h-4 w-4" />
            เปิดจอ Slideshow
          </a>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          เปิดลิงก์บนคอมที่ต่อทีวีหรือโปรเจกเตอร์ แล้วกดปุ่ม &quot;เต็มจอ&quot; (หรือกด F) · Space หยุด/เล่น · → รูปถัดไป ·
          ลิงก์นี้เปิดได้แม้งานตั้งรหัสผ่าน อย่าแชร์ให้คนนอกงาน
        </p>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">ตัวอย่าง</h2>
          {dirty && <span className="text-xs text-amber-600">ยังไม่ได้บันทึก จอในงานยังแสดงแบบเดิม</span>}
        </div>
        <div className="mt-2 aspect-video w-full overflow-hidden rounded-2xl shadow-lg ring-1 ring-slate-200">
          <SlideshowView
            slug={slug}
            apiKey={apiKey}
            event={event}
            settings={settings}
            qrSvg={qrSvg}
            guestUrl={guestUrl}
            demoRef={demoRef}
          />
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-5 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
          <div>
            <h2 className="mb-2 text-sm font-medium">รูปแบบการแสดง</h2>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "spotlight", label: "Spotlight", text: "รูปใหญ่ทีละรูป + แถบรูปไหล", icon: MonitorPlay },
                  { value: "wall", label: "กำแพงรูป", text: "รูปไหลเป็นคอลัมน์ รูปใหม่เด้งขึ้นกลางจอ", icon: LayoutGrid },
                ] as const
              ).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={settings.layout === o.value}
                  onClick={() => set("layout", o.value)}
                  className={`rounded-xl p-3 text-left ring-1 transition ${
                    settings.layout === o.value ? "bg-primary-soft ring-2 ring-primary" : "ring-slate-200 hover:ring-slate-300"
                  }`}
                >
                  <o.icon className="h-5 w-5 text-primary" />
                  <span className="mt-1.5 block text-sm font-medium">{o.label}</span>
                  <span className="block text-xs text-slate-500">{o.text}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium">ธีมสี</h2>
            <Segmented
              value={settings.theme}
              onChange={(v) => set("theme", v)}
              options={[
                { value: "dark", label: "มืด" },
                { value: "light", label: "สว่าง" },
                { value: "brand", label: "สีแบรนด์" },
              ]}
            />
            {!event.branding && (
              <p className="mt-1.5 text-xs text-slate-500">สีแบรนด์ ฟอนต์ และโลโก้ของงานตั้งได้ในเมนูปรับแต่งหน้างาน (Premium)</p>
            )}
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium">แสดงรูปจาก</h2>
            <Segmented
              value={settings.sources}
              onChange={(v) => set("sources", v)}
              options={[
                { value: "all", label: "ทั้งหมด" },
                { value: "guest", label: "แขก" },
                { value: "official", label: "ช่างภาพ" },
              ]}
            />
          </div>
          <div>
            <h2 className="mb-2 flex justify-between text-sm font-medium">
              ความเร็ว <span className="font-normal text-slate-500">{settings.intervalSec} วินาที/รูป</span>
            </h2>
            <input
              type="range"
              min={4}
              max={20}
              value={settings.intervalSec}
              onChange={(e) => set("intervalSec", Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium">ขนาด QR Code</h2>
            <Segmented
              value={settings.qrSize ?? "medium"}
              onChange={(v) => set("qrSize", v)}
              options={[
                { value: "small", label: "เล็ก" },
                { value: "medium", label: "กลาง" },
                { value: "large", label: "ใหญ่" },
              ]}
            />
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium">แผงข้อมูลอยู่ด้าน</h2>
            <Segmented
              value={settings.panelSide}
              onChange={(v) => set("panelSide", v)}
              options={[
                { value: "left", label: "ซ้าย" },
                { value: "right", label: "ขวา" },
              ]}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
          <h2 className="text-sm font-medium">ข้อมูลงานบนจอ</h2>
          <label className="block text-sm">
            <span className="text-slate-600">หัวข้อ</span>
            <input
              value={settings.headline ?? ""}
              onChange={(e) => set("headline", e.target.value || null)}
              maxLength={80}
              placeholder={event.title}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">ข้อความ</span>
            <textarea
              value={settings.message ?? ""}
              onChange={(e) => set("message", e.target.value || null)}
              maxLength={200}
              rows={3}
              placeholder="เช่น ขอบคุณที่มาร่วมเป็นส่วนหนึ่งของวันสำคัญ #NattAndPloy"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">ข้อความใต้ QR</span>
            <input
              value={settings.qrCaption ?? ""}
              onChange={(e) => set("qrCaption", e.target.value || null)}
              maxLength={60}
              placeholder="สแกนเพื่อแชร์รูปของคุณ"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <div className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
            <Toggle label="แสดง QR Code" checked={settings.showQr} onChange={(v) => set("showQr", v)} />
            <Toggle label="แสดงวันที่งาน" checked={settings.showDate} onChange={(v) => set("showDate", v)} />
            <Toggle label="แสดงชื่อคนอัปโหลด" checked={settings.showUploader} onChange={(v) => set("showUploader", v)} />
          </div>
        </section>
      </div>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-300 via-pink-500 to-violet-600 text-white">
              <InstagramIcon />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-medium">แชร์ Instagram ขึ้นจอ</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                แขกถ่ายหรือเลือกรูป กรอก Instagram @ แล้วกดแชร์ จอจะเด้ง Popup รูปพร้อม @ ขึ้นกลางจอ 1 ครั้ง
                รูปกลุ่มนี้แยกจากอัลบั้มและ Slideshow ดูย้อนหลังได้ที่ประวัติด้านล่าง (แขกแชร์ได้คนละครั้งต่อ 30 วินาที)
              </p>
            </div>
          </div>
          <label className="relative inline-flex shrink-0 cursor-pointer items-center">
            <input
              type="checkbox"
              checked={settings.igShare}
              onChange={(e) => set("igShare", e.target.checked)}
              className="peer sr-only"
              aria-label="เปิดแชร์ Instagram"
            />
            <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
            <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
          </label>
        </div>
        <div className={`mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end ${settings.igShare ? "" : "opacity-50"}`}>
          <div>
            <h3 className="mb-2 flex justify-between text-sm font-medium">
              เวลาแสดง Popup <span className="font-normal text-slate-500">{settings.igPopupSec} วินาที/คน</span>
            </h3>
            <input
              type="range"
              min={3}
              max={30}
              value={settings.igPopupSec}
              disabled={!settings.igShare}
              onChange={(e) => set("igPopupSec", Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
          <button
            type="button"
            onClick={() => demoRef.current?.()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            <Sparkles className="h-4 w-4" /> ลองดู Popup ในตัวอย่าง
          </button>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        {state === "saved" && <p className="text-sm text-emerald-600">บันทึกแล้ว จอในงานจะเปลี่ยนตามภายใน 10 วินาที</p>}
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {state === "saving" ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </div>
    </div>
  );
}
