// Pay-per-event packages. All prices and limits live here so they can be tuned in one place.

import { CUSTOM_PLAN, type CustomPlanConfig } from "../lib/custom-plan";

/** Fixed packages. "custom" is built per event from what the host picked (see customPlan). */
export const PLAN_TIERS = ["free", "standard", "premium"] as const;
export type FixedTier = (typeof PLAN_TIERS)[number];
export type PlanTier = FixedTier | "custom";

export interface Plan {
  tier: PlanTier;
  name: string;
  priceThb: number;
  maxGuests: number;
  /** All photos in the event (guest + official), including hidden ones. */
  maxPhotos: number;
  maxPhotosPerGuest: number;
  /** Album stays open this many days after the event date. */
  retentionDays: number;
  watermark: boolean;
  branding: boolean;
  /** Photographers may upload full-resolution originals (private bucket). */
  originals: boolean;
  /** Video uploads (guests and official); null = photos only. */
  video: { maxBytes: number; maxDurationSec: number } | null;
  /** Total stored bytes the album may use; null = limited by file count only. */
  maxStorageBytes: number | null;
}

export const PLANS: Record<FixedTier, Plan> = {
  free: {
    tier: "free",
    name: "Free",
    priceThb: 0,
    maxGuests: 50,
    maxPhotos: 300,
    maxPhotosPerGuest: 30,
    retentionDays: 7,
    watermark: true,
    branding: false,
    originals: false,
    video: null,
    maxStorageBytes: null,
  },
  standard: {
    tier: "standard",
    name: "Standard",
    priceThb: 590,
    maxGuests: 300,
    maxPhotos: 5_000,
    maxPhotosPerGuest: 100,
    retentionDays: 60,
    watermark: false,
    branding: false,
    originals: false,
    video: { maxBytes: 150 * 1024 * 1024, maxDurationSec: 60 },
    maxStorageBytes: null,
  },
  premium: {
    tier: "premium",
    name: "Premium",
    priceThb: 1_490,
    maxGuests: 1_000,
    maxPhotos: 20_000,
    maxPhotosPerGuest: 200,
    retentionDays: 180,
    watermark: false,
    branding: true,
    originals: true,
    video: { maxBytes: 400 * 1024 * 1024, maxDurationSec: 180 },
    maxStorageBytes: null,
  },
};

/** Files of expired albums are deleted this long after expiry (time to upgrade and reopen). */
export const PURGE_GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The Custom package for one event: everything Premium has, sized to what the host bought. */
export function customPlan(config: CustomPlanConfig, priceThb = 0): Plan {
  return {
    tier: "custom",
    name: "Custom",
    priceThb,
    maxGuests: config.maxGuests,
    maxPhotos: config.maxFiles,
    maxPhotosPerGuest: 500,
    retentionDays: config.retentionDays,
    watermark: false,
    branding: true,
    originals: true,
    video: { maxBytes: CUSTOM_PLAN.maxFileBytes, maxDurationSec: CUSTOM_PLAN.maxVideoSeconds },
    maxStorageBytes: config.storageGB * 1024 ** 3,
  };
}

export function planRank(tier: PlanTier): number {
  return tier === "custom" ? PLAN_TIERS.length : PLAN_TIERS.indexOf(tier);
}

/** Price to move from `from` to a higher fixed tier `to` (pay the difference). */
export function upgradePriceThb(from: FixedTier, to: FixedTier): number {
  return PLANS[to].priceThb - PLANS[from].priceThb;
}

/**
 * End of the retention window: `retentionDays` full days after the event day,
 * counted from today instead if the event is already in the past.
 */
export function expiryFor(eventDate: Date, retentionDays: number, now = new Date()): Date {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const base = Math.max(eventDate.getTime(), today);
  return new Date(base + (retentionDays + 1) * DAY_MS);
}
