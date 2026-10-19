// Custom (on-demand) package: the host picks guests, files, storage and how long the album
// stays open, never below Premium. Shared by the browser (live quote) and the server (charge).

export interface CustomPlanConfig {
  maxGuests: number;
  /** Photos + videos in the whole event. */
  maxFiles: number;
  storageGB: number;
  retentionDays: number;
}

export type CustomField = keyof CustomPlanConfig;

export const CUSTOM_PLAN = {
  /** Premium's limits (storage: what a full Premium album typically uses). */
  min: { maxGuests: 1_000, maxFiles: 20_000, storageGB: 100, retentionDays: 180 },
  max: { maxGuests: 20_000, maxFiles: 500_000, storageGB: 5_000, retentionDays: 720 },
  step: { maxGuests: 100, maxFiles: 1_000, storageGB: 10, retentionDays: 30 },
  basePriceThb: 2_490,
  /** Per file: the largest object a single browser upload can send to storage. */
  maxFileBytes: 5 * 1024 ** 3,
  maxVideoSeconds: 3 * 60 * 60,
} as const satisfies { min: CustomPlanConfig; max: CustomPlanConfig; step: CustomPlanConfig } & Record<string, unknown>;

const RATES = {
  /** ฿ per guest above the minimum. */
  guest: 0.4,
  /** ฿ per file above the minimum. */
  file: 0.02,
  /** ฿ per GB above the minimum (storage for the whole retention window up to 180 days). */
  storageGB: 8,
  /** ฿ per extra 30 days: a fixed part plus the storage kept for longer. */
  monthBase: 150,
  monthPerGB: 0.6,
};

export interface CustomQuote {
  totalThb: number;
  lines: { label: string; thb: number }[];
}

const round10 = (n: number) => Math.round(n / 10) * 10;

/** Clamps and snaps every field to the allowed range and step. */
export function normalizeCustomConfig(input: CustomPlanConfig): CustomPlanConfig {
  const out = {} as CustomPlanConfig;
  for (const key of Object.keys(CUSTOM_PLAN.min) as CustomField[]) {
    const { min, max, step } = { min: CUSTOM_PLAN.min[key], max: CUSTOM_PLAN.max[key], step: CUSTOM_PLAN.step[key] };
    const snapped = Math.round((Number(input[key]) || min) / step) * step;
    out[key] = Math.min(max, Math.max(min, snapped));
  }
  return out;
}

export function quoteCustomPlan(input: CustomPlanConfig): CustomQuote {
  const c = normalizeCustomConfig(input);
  const { min } = CUSTOM_PLAN;
  const extraMonths = (c.retentionDays - min.retentionDays) / 30;
  const lines = [
    { label: "แพ็กเกจเริ่มต้น (เท่า Premium + ไม่จำกัดขนาดไฟล์)", thb: CUSTOM_PLAN.basePriceThb },
    { label: `แขกเพิ่ม ${(c.maxGuests - min.maxGuests).toLocaleString("th-TH")} คน`, thb: round10((c.maxGuests - min.maxGuests) * RATES.guest) },
    { label: `รูปและวิดีโอเพิ่ม ${(c.maxFiles - min.maxFiles).toLocaleString("th-TH")} ไฟล์`, thb: round10((c.maxFiles - min.maxFiles) * RATES.file) },
    { label: `พื้นที่เพิ่ม ${(c.storageGB - min.storageGB).toLocaleString("th-TH")} GB`, thb: round10((c.storageGB - min.storageGB) * RATES.storageGB) },
    {
      label: `เก็บอัลบั้มเพิ่ม ${(c.retentionDays - min.retentionDays).toLocaleString("th-TH")} วัน`,
      thb: round10(extraMonths * (RATES.monthBase + c.storageGB * RATES.monthPerGB)),
    },
  ].filter((line, i) => i === 0 || line.thb > 0);
  return { totalThb: lines.reduce((sum, l) => sum + l.thb, 0), lines };
}

/** True when `next` is at least as large as `current` in every field (custom upgrades only grow). */
export function coversConfig(next: CustomPlanConfig, current: CustomPlanConfig): boolean {
  return (Object.keys(CUSTOM_PLAN.min) as CustomField[]).every((k) => next[k] >= current[k]);
}
