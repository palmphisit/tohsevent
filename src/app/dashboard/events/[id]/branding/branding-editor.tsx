"use client";

import { useRef, useState } from "react";
import { BRAND_FONT_CLASS } from "@/app/brand-fonts";
import {
  ApiError,
  saveBranding,
  uploadBrandingAsset,
  type BrandingAsset,
  type BrandingEditorState,
} from "@/lib/api-client";
import { BRAND_FONT_IDS, BRAND_FONT_LABELS, contrastText, type BrandFontId } from "@/lib/brand-fonts";
import { resizeImage } from "@/lib/image";
import { showError } from "@/lib/error-popup";

const PRESET_COLORS = ["#2563eb", "#18181b", "#be123c", "#c2410c", "#a16207", "#15803d", "#0f766e", "#1d4ed8", "#7e22ce"];
const MAX_SPONSORS = 12;

// Resize before upload so even large phone photos stay well under the 2 MB limit.
const ASSET_SPECS = {
  logo: { maxEdge: 800, type: "image/png" },
  cover: { maxEdge: 2000, type: "image/jpeg", quality: 0.85 },
  sponsor: { maxEdge: 600, type: "image/png" },
} as const;

type Sponsor = BrandingEditorState["sponsors"][number];

const inputClass = "w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

const ERRORS: Record<string, string> = {
  plan_required: "Custom Branding ใช้ได้กับแพ็กเกจ Premium เท่านั้น",
  asset_missing: "มีรูปที่ยังอัปโหลดไม่เสร็จ ลองอัปโหลดใหม่อีกครั้ง",
  invalid_body: "ข้อมูลไม่ถูกต้อง ตรวจสอบชื่อและลิงก์ของผู้สนับสนุน (ลิงก์ต้องขึ้นต้นด้วย https://)",
};

export function BrandingEditor({
  eventId,
  title,
  initial,
}: {
  eventId: string;
  title: string;
  initial: BrandingEditorState;
}) {
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor);
  const [fontId, setFontId] = useState<BrandFontId>(initial.fontId);
  const [logo, setLogo] = useState(initial.logo);
  const [cover, setCover] = useState(initial.cover);
  const [welcomeMessage, setWelcomeMessage] = useState(initial.welcomeMessage);
  const [sponsors, setSponsors] = useState<Sponsor[]>(initial.sponsors);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  const validColor = /^#[0-9a-fA-F]{6}$/.test(primaryColor);
  const upload = (kind: keyof typeof ASSET_SPECS) => async (file: File) =>
    uploadBrandingAsset(eventId, kind, await resizeImage(file, ASSET_SPECS[kind]));

  function updateSponsor(index: number, patch: Partial<Sponsor>) {
    setSponsors((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  async function save() {
    setState("saving");
    try {
      const { branding } = await saveBranding(eventId, {
        primaryColor,
        fontId,
        logoKey: logo?.key ?? null,
        coverKey: cover?.key ?? null,
        welcomeMessage: welcomeMessage || null,
        sponsors: sponsors.map((s) => ({
          id: s.id || undefined,
          name: s.name,
          imageKey: s.image.key,
          linkUrl: s.linkUrl.trim() || null,
        })),
      });
      setSponsors(branding.sponsors);
      setState("saved");
    } catch (err) {
      showError((err instanceof ApiError && ERRORS[err.code]) || "บันทึกไม่สำเร็จ ลองอีกครั้ง");
      setState("idle");
    }
  }

  const incompleteSponsor = sponsors.some((s) => !s.name.trim() || !s.image.key);

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Section title="สีประจำงาน" hint="ใช้กับปุ่มและไฮไลต์บนหน้าที่แขกเห็น">
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                onClick={() => setPrimaryColor(color)}
                className={`h-9 w-9 rounded-full border-2 ${primaryColor === color ? "border-primary" : "border-white shadow"}`}
                style={{ background: color }}
              />
            ))}
            <input
              type="color"
              value={validColor ? primaryColor : "#2563eb"}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-slate-300"
              aria-label="เลือกสีเอง"
            />
            <input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              maxLength={7}
              className="w-28 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </div>
        </Section>

        <Section title="ฟอนต์">
          <select value={fontId} onChange={(e) => setFontId(e.target.value as BrandFontId)} className={inputClass}>
            {BRAND_FONT_IDS.map((id) => (
              <option key={id} value={id}>
                {BRAND_FONT_LABELS[id]}
              </option>
            ))}
          </select>
        </Section>

        <Section title="โลโก้" hint="แนะนำ PNG พื้นหลังโปร่งใส">
          <ImagePicker value={logo} onChange={setLogo} upload={upload("logo")} previewClass="h-16 w-auto" />
        </Section>

        <Section title="รูปปก" hint="แสดงด้านบนสุดของหน้า อัตราส่วน 3:1 (เช่น 1800×600)">
          <ImagePicker value={cover} onChange={setCover} upload={upload("cover")} previewClass="aspect-[3/1] w-full object-cover" />
        </Section>

        <Section title="ข้อความต้อนรับ">
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="เช่น ขอบคุณที่มาร่วมงานแต่งของเรา แชร์รูปสวย ๆ ได้ที่นี่เลย"
            className={inputClass}
          />
        </Section>

        <Section title={`ผู้สนับสนุน (${sponsors.length}/${MAX_SPONSORS})`} hint="แสดงเป็นแถบโลโก้ท้ายหน้า">
          <ul className="space-y-3">
            {sponsors.map((sponsor, i) => (
              <li key={sponsor.id || i} className="flex flex-col gap-3 rounded-xl bg-white ring-1 ring-slate-200 p-3 sm:flex-row sm:items-start">
                <ImagePicker
                  value={sponsor.image.key ? sponsor.image : null}
                  onChange={(image) => updateSponsor(i, { image: image ?? { key: "", url: "" } })}
                  upload={upload("sponsor")}
                  previewClass="h-12 w-auto"
                  compact
                />
                <div className="flex-1 space-y-2">
                  <input
                    value={sponsor.name}
                    onChange={(e) => updateSponsor(i, { name: e.target.value })}
                    maxLength={80}
                    placeholder="ชื่อผู้สนับสนุน"
                    className={inputClass}
                  />
                  <input
                    value={sponsor.linkUrl}
                    onChange={(e) => updateSponsor(i, { linkUrl: e.target.value })}
                    placeholder="ลิงก์ (ไม่บังคับ) https://"
                    className={inputClass}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSponsors((prev) => prev.filter((_, j) => j !== i))}
                  className="self-start text-sm text-red-600"
                >
                  ลบ
                </button>
              </li>
            ))}
          </ul>
          {sponsors.length < MAX_SPONSORS && (
            <button
              type="button"
              onClick={() => setSponsors((prev) => [...prev, { id: "", name: "", image: { key: "", url: "" }, linkUrl: "" }])}
              className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm"
            >
              + เพิ่มผู้สนับสนุน
            </button>
          )}
        </Section>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={state === "saving" || !validColor || incompleteSponsor}
            className="rounded-xl bg-primary hover:bg-primary-hover px-6 py-3 font-medium text-white disabled:opacity-40"
          >
            {state === "saving" ? "กำลังบันทึก…" : "บันทึก"}
          </button>
          {state === "saved" && <span className="text-sm text-emerald-700">บันทึกแล้ว แขกจะเห็นหน้าใหม่ทันที</span>}
          {incompleteSponsor && <span className="text-sm text-slate-500">ผู้สนับสนุนต้องมีทั้งชื่อและรูป</span>}
        </div>
      </div>

      <Preview
        title={title}
        primaryColor={validColor ? primaryColor : "#2563eb"}
        fontId={fontId}
        logo={logo}
        cover={cover}
        welcomeMessage={welcomeMessage}
        sponsors={sponsors}
      />
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-medium">{title}</h2>
      {hint && <p className="mb-2 text-xs text-slate-500">{hint}</p>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </section>
  );
}

function ImagePicker({
  value,
  onChange,
  upload,
  previewClass,
  compact,
}: {
  value: BrandingAsset | null;
  onChange: (asset: BrandingAsset | null) => void;
  upload: (file: File) => Promise<BrandingAsset>;
  previewClass: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setFailed(false);
    try {
      onChange(await upload(file));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={compact ? "w-40 shrink-0" : ""}>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      {value ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded asset preview */}
          <img src={value.url} alt="" className={`rounded-lg bg-slate-50 object-contain ${previewClass}`} />
          <div className="flex gap-3 text-sm">
            <button type="button" onClick={() => inputRef.current?.click()} className="underline">
              เปลี่ยน
            </button>
            <button type="button" onClick={() => onChange(null)} className="text-red-600">
              เอาออก
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 disabled:opacity-50"
        >
          {busy ? "กำลังอัปโหลด…" : "เลือกรูป"}
        </button>
      )}
      {failed && <p className="mt-1 text-xs text-red-600">อัปโหลดไม่สำเร็จ</p>}
    </div>
  );
}

function Preview({
  title,
  primaryColor,
  fontId,
  logo,
  cover,
  welcomeMessage,
  sponsors,
}: {
  title: string;
  primaryColor: string;
  fontId: BrandFontId;
  logo: BrandingAsset | null;
  cover: BrandingAsset | null;
  welcomeMessage: string;
  sponsors: Sponsor[];
}) {
  const style = { "--brand": primaryColor, "--brand-contrast": contrastText(primaryColor) } as React.CSSProperties;
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <p className="mb-2 text-xs text-slate-500">ตัวอย่างหน้าที่แขกเห็น</p>
      <div style={style} className={`overflow-hidden rounded-3xl border-8 border-primary bg-white p-4 ${BRAND_FONT_CLASS[fontId]}`}>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded asset preview
          <img src={cover.url} alt="" className="mb-3 aspect-[3/1] w-full rounded-xl object-cover" />
        )}
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded asset preview
          <img src={logo.url} alt="" className="mb-2 h-10 w-auto object-contain" />
        )}
        <p className="text-xs text-slate-500">วันที่จัดงาน</p>
        <p className="text-lg font-semibold">{title}</p>
        {welcomeMessage && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{welcomeMessage}</p>}
        <div className="mt-4 rounded-xl bg-brand px-4 py-3 text-center font-medium text-brand-contrast">
          ถ่ายรูป / เลือกรูปเพื่ออัปโหลด
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="aspect-square bg-slate-100" />
          ))}
        </div>
        {sponsors.some((s) => s.image.url) && (
          <div className="mt-4 border-t border-slate-200 pt-3">
            <p className="text-center text-xs text-slate-500">ขอบคุณผู้สนับสนุน</p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {sponsors
                .filter((s) => s.image.url)
                .map((s, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded asset preview
                  <img key={s.id || i} src={s.image.url} alt={s.name} className="h-6 w-auto object-contain" />
                ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
