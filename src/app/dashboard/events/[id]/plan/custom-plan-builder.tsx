"use client";

import { CalendarRange, HardDrive, Images, Sparkles, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { startUpgradeCheckout } from "@/lib/api-client";
import { CUSTOM_PLAN, quoteCustomPlan, type CustomField, type CustomPlanConfig } from "@/lib/custom-plan";
import { showError } from "@/lib/error-popup";

const thb = (n: number) => n.toLocaleString("th-TH");

const FIELDS: { key: CustomField; label: string; unit: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "maxGuests", label: "จำนวนแขก", unit: "คน", icon: Users },
  { key: "maxFiles", label: "รูปและวิดีโอ", unit: "ไฟล์", icon: Images },
  { key: "storageGB", label: "พื้นที่จัดเก็บ", unit: "GB", icon: HardDrive },
  { key: "retentionDays", label: "เก็บอัลบั้ม", unit: "วัน", icon: CalendarRange },
];

/**
 * Pick-your-own package. Every slider starts at Premium (or at the current Custom package
 * when enlarging it), so it can never be smaller; the price updates as the host drags.
 */
export function CustomPlanBuilder({
  eventId,
  current,
  paidThb,
  canPay,
}: {
  eventId: string;
  /** The event's Custom package, when it already has one. */
  current: CustomPlanConfig | null;
  /** What was already paid for this event (subtracted from the price). */
  paidThb: number;
  canPay: boolean;
}) {
  const floor = current ?? CUSTOM_PLAN.min;
  const [config, setConfig] = useState<CustomPlanConfig>(floor);
  const [pending, setPending] = useState(false);
  const quote = useMemo(() => quoteCustomPlan(config), [config]);
  const toPay = Math.max(0, quote.totalThb - paidThb);
  const unchanged = current !== null && FIELDS.every(({ key }) => config[key] === current[key]);

  async function buy() {
    setPending(true);
    try {
      window.location.assign(await startUpgradeCheckout(eventId, { tier: "custom", custom: config }));
    } catch {
      showError("เริ่มการชำระเงินไม่สำเร็จ ลองอีกครั้ง");
      setPending(false);
    }
  }

  return (
    <section className="mt-8 overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200">
      <div className="bg-gradient-to-br from-primary-ink via-primary to-accent px-5 py-5 text-white sm:px-6">
        <p className="flex items-center gap-2 text-sm text-blue-100">
          <Sparkles className="h-4 w-4" /> Custom
        </p>
        <h2 className="mt-1 text-xl font-semibold">{current ? "ขยายแพ็กเกจ Custom ของคุณ" : "กำหนดแพ็กเกจเองตามขนาดงาน"}</h2>
        <p className="mt-1 text-sm text-blue-100">
          ทุกอย่างของ Premium + ไม่จำกัดขนาดไฟล์ (สูงสุด 5 GB ต่อไฟล์ วิดีโอยาวสูงสุด 3 ชั่วโมง) เลือกจำนวนได้เองไม่ต่ำกว่า Premium
        </p>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {FIELDS.map(({ key, label, unit, icon: Icon }) => (
            <div key={key}>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={`custom-${key}`} className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4 text-primary" />
                  {label}
                </label>
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={floor[key]}
                    max={CUSTOM_PLAN.max[key]}
                    step={CUSTOM_PLAN.step[key]}
                    value={config[key]}
                    onChange={(e) => setConfig((c) => ({ ...c, [key]: Number(e.target.value) }))}
                    onBlur={() =>
                      setConfig((c) => ({
                        ...c,
                        [key]: Math.min(CUSTOM_PLAN.max[key], Math.max(floor[key], Math.round(c[key] / CUSTOM_PLAN.step[key]) * CUSTOM_PLAN.step[key])),
                      }))
                    }
                    className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm font-semibold tabular-nums"
                  />
                  <span className="w-8 text-xs text-slate-500">{unit}</span>
                </span>
              </div>
              <input
                id={`custom-${key}`}
                type="range"
                min={floor[key]}
                max={CUSTOM_PLAN.max[key]}
                step={CUSTOM_PLAN.step[key]}
                value={Math.max(floor[key], config[key])}
                onChange={(e) => setConfig((c) => ({ ...c, [key]: Number(e.target.value) }))}
                className="mt-2 w-full accent-primary"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>
                  {current ? "ปัจจุบัน" : "เริ่มต้น"} {thb(floor[key])}
                </span>
                <span>สูงสุด {thb(CUSTOM_PLAN.max[key])}</span>
              </div>
            </div>
          ))}
        </div>

        <aside className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 lg:self-start">
          <p className="text-sm font-medium">ราคาประเมิน</p>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
            {quote.lines.map((line) => (
              <li key={line.label} className="flex justify-between gap-3">
                <span>{line.label}</span>
                <span className="shrink-0 tabular-nums">{thb(line.thb)} ฿</span>
              </li>
            ))}
            {paidThb > 0 && (
              <li className="flex justify-between gap-3 text-emerald-700">
                <span>หักที่จ่ายแล้ว</span>
                <span className="shrink-0 tabular-nums">−{thb(paidThb)} ฿</span>
              </li>
            )}
          </ul>
          <div className="mt-3 flex items-baseline justify-between border-t border-slate-200 pt-3">
            <span className="text-sm text-slate-600">ชำระ</span>
            <span className="text-2xl font-semibold text-slate-900 tabular-nums">{thb(toPay)} ฿</span>
          </div>
          <button
            type="button"
            onClick={buy}
            disabled={!canPay || pending || toPay <= 0 || unchanged}
            className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40"
          >
            {pending ? "กำลังไปหน้าชำระเงิน…" : current ? "ขยายแพ็กเกจ" : "ซื้อแพ็กเกจ Custom"}
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            ชำระครั้งเดียวต่องาน · ขยายเพิ่มภายหลังได้โดยจ่ายแค่ส่วนต่าง · อายุอัลบั้มนับจากวันจัดงาน
          </p>
        </aside>
      </div>
    </section>
  );
}
