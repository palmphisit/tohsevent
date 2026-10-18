// Pay-per-event packages. All prices and limits live here so they can be tuned in one place.

export const PLAN_TIERS = ["free", "standard", "premium"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

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
}

export const PLANS: Record<PlanTier, Plan> = {
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
  },
};

/** Files of expired albums are deleted this long after expiry (time to upgrade and reopen). */
export const PURGE_GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export function planRank(tier: PlanTier): number {
  return PLAN_TIERS.indexOf(tier);
}

/** Price to move from `from` to a higher tier `to` (pay the difference). */
export function upgradePriceThb(from: PlanTier, to: PlanTier): number {
  return PLANS[to].priceThb - PLANS[from].priceThb;
}

/**
 * End of the retention window: `retentionDays` full days after the event day,
 * counted from today instead if the event is already in the past.
 */
export function expiryFor(eventDate: Date, tier: PlanTier, now = new Date()): Date {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const base = Math.max(eventDate.getTime(), today);
  return new Date(base + (PLANS[tier].retentionDays + 1) * DAY_MS);
}
