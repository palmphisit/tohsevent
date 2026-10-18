import type { ObjectId } from "mongodb";
import type { BrandFontId } from "../lib/brand-fonts";
import { PLANS, type Plan, type PlanTier } from "./plans";

export type EventAccessMode = "public" | "password";
export type EventStatus = "draft" | "live" | "closed" | "expired";

export interface EventDoc {
  _id: ObjectId;
  slug: string;
  ownerId: ObjectId | null; // null until host auth lands
  title: string;
  date: Date;
  access: { mode: EventAccessMode; passwordHash?: string };
  settings: {
    guestUpload: boolean;
    moderation: "post" | "pre";
    maxPhotosPerGuest: number;
  };
  status: EventStatus;
  expiresAt: Date | null;
  /** Missing on events created before packages existed: treated as Free. */
  plan?: { tier: PlanTier; upgradedAt: Date | null };
  /** `counters.photos` = photos guests can see; `usage.photos` = all stored photos (counts toward the plan). */
  counters: { photos: number; guests: number };
  usage?: { photos: number };
  /** Set once the files of an expired album have been deleted. */
  purgedAt?: Date | null;
  /** Custom look of the guest page (Premium). Storage keys point to events/<id>/branding/*. */
  branding?: BrandingDoc;
  createdAt: Date;
  updatedAt: Date;
}

export interface SponsorDoc {
  id: string;
  name: string;
  imageKey: string;
  linkUrl: string | null;
}

export interface BrandingDoc {
  primaryColor: string;
  fontId: BrandFontId;
  logoKey: string | null;
  coverKey: string | null;
  welcomeMessage: string | null;
  sponsors: SponsorDoc[];
  updatedAt: Date;
}

export function planOf(event: Pick<EventDoc, "plan">): Plan {
  return PLANS[event.plan?.tier ?? "free"];
}

export interface PaymentDoc {
  _id: ObjectId;
  eventId: ObjectId;
  ownerId: ObjectId;
  fromTier: PlanTier;
  toTier: PlanTier;
  amountThb: number;
  provider: "stripe";
  stripeSessionId: string | null;
  status: "pending" | "paid" | "failed" | "expired";
  createdAt: Date;
  paidAt: Date | null;
}

export interface GuestSessionDoc {
  _id: ObjectId;
  eventId: ObjectId;
  displayName: string | null;
  /** Photos reserved through presigned uploads; enforces settings.maxPhotosPerGuest atomically. */
  uploadCount: number;
  ipHash: string | null;
  createdAt: Date;
}

export type PhotoSource = "guest" | "official";
export type PhotoStatus = "pending" | "ready" | "hidden" | "deleted";
export type RequiredVariant = "display" | "thumb";
export type PhotoVariant = RequiredVariant | "watermarked";

export interface PhotoDoc {
  _id: ObjectId;
  eventId: ObjectId;
  source: PhotoSource;
  uploader: { type: "guest" | "user"; id: ObjectId; displayName: string | null };
  /**
   * `watermarked` exists for photos uploaded while the event was on a watermarked plan;
   * the clean `display` key then has a random suffix so it cannot be guessed from it.
   */
  keys: Record<RequiredVariant, string> & { watermarked?: string; original?: string };
  contentType: UploadContentType;
  bytes: Record<RequiredVariant, number> & { watermarked?: number };
  width: number;
  height: number;
  takenAt: Date | null;
  status: PhotoStatus;
  /** Number of open guest reports (missing on photos uploaded before reports existed). */
  openReports?: number;
  createdAt: Date;
  completedAt: Date | null;
  deletedAt?: Date;
}

export const REPORT_REASONS = ["inappropriate", "remove_me", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface ReportDoc {
  _id: ObjectId;
  eventId: ObjectId;
  photoId: ObjectId;
  guestSessionId: ObjectId;
  reason: ReportReason;
  note: string | null;
  status: "open" | "resolved" | "dismissed";
  createdAt: Date;
  resolvedAt: Date | null;
}

export const UPLOAD_CONTENT_TYPES = ["image/jpeg", "image/webp"] as const;
export type UploadContentType = (typeof UPLOAD_CONTENT_TYPES)[number];

export const UPLOAD_LIMITS = {
  maxFilesPerRequest: 10,
  maxBytes: {
    display: 8 * 1024 * 1024,
    thumb: 1024 * 1024,
    watermarked: 8 * 1024 * 1024,
  } satisfies Record<PhotoVariant, number>,
  presignExpiresSeconds: 10 * 60,
} as const;
