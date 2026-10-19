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
  /** When the host was emailed that the album expires soon. */
  expiryReminderSentAt?: Date | null;
  /** People invited to work on the event besides the owner (photographers). */
  members?: EventMember[];
  /** Guest page look (every plan); missing = defaults (see services/appearance.ts). */
  appearance?: AppearanceDoc;
  /** Big-screen slideshow look; missing = defaults (see services/slideshow.ts). */
  slideshow?: SlideshowDoc;
  createdAt: Date;
  updatedAt: Date;
}

export type MemberRole = "photographer";

/** Album transfer to the user's Google Drive, run in short steps the dashboard drives. */
export interface DriveExportDoc {
  _id: ObjectId;
  eventId: ObjectId;
  /** Whose Google Drive (and token) the files go to. */
  userId: ObjectId;
  sources: PhotoSource[];
  folder: { id: string; url: string };
  subfolders: Partial<Record<PhotoSource, string>>;
  status: "running" | "needs_auth" | "done" | "canceled";
  total: number;
  done: number;
  failed: number;
  bytes: number;
  /** Photos are sent in _id order; everything up to this id is finished. */
  cursor: ObjectId | null;
  /** A large file part-way through a resumable upload. */
  current: { photoId: ObjectId; uploadUrl: string; offset: number; size: number } | null;
  lastError: string | null;
  /** One step at a time per export (a second tab cannot double-send files). */
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
}

export interface EventMember {
  userId: ObjectId;
  role: MemberRole;
  addedAt: Date;
}

export interface InviteDoc {
  _id: ObjectId;
  eventId: ObjectId;
  role: MemberRole;
  /** sha256 of the link token; the token itself is only shown once to the owner. */
  tokenHash: string;
  createdBy: ObjectId;
  createdAt: Date;
  expiresAt: Date;
  acceptedBy: ObjectId | null;
  acceptedAt: Date | null;
}

export interface SponsorDoc {
  id: string;
  name: string;
  imageKey: string;
  linkUrl: string | null;
}

export const GUEST_THEMES = ["light", "soft", "dark"] as const;
export const GUEST_HEADERS = ["banner", "hero", "minimal"] as const;
export const GUEST_GALLERIES = ["grid", "masonry"] as const;

export interface AppearanceDoc {
  /** light = white page, soft = tinted with the event color, dark = night mode. */
  theme: (typeof GUEST_THEMES)[number];
  /** banner = cover strip above the title, hero = big cover with the title on it, minimal = text only. */
  header: (typeof GUEST_HEADERS)[number];
  /** grid = square tiles, masonry = photos in their own shape. */
  gallery: (typeof GUEST_GALLERIES)[number];
  defaultTab: "guest" | "official";
  /** Upload button text; null = default. */
  uploadLabel: string | null;
  showDate: boolean;
  updatedAt: Date;
}

export const SLIDESHOW_LAYOUTS = ["spotlight", "wall"] as const;
export const SLIDESHOW_THEMES = ["dark", "light", "brand"] as const;
export const SLIDESHOW_SOURCES = ["all", "guest", "official"] as const;

export interface SlideshowDoc {
  layout: (typeof SLIDESHOW_LAYOUTS)[number];
  theme: (typeof SLIDESHOW_THEMES)[number];
  sources: (typeof SLIDESHOW_SOURCES)[number];
  /** Shown instead of the event title when set. */
  headline: string | null;
  message: string | null;
  qrCaption: string | null;
  showQr: boolean;
  showDate: boolean;
  showUploader: boolean;
  panelSide: "left" | "right";
  /** Size of the QR code on screen (missing on older saves = medium). */
  qrSize?: "small" | "medium" | "large";
  /** Seconds each photo stays on screen (spotlight) / speed of the wall. */
  intervalSec: number;
  updatedAt: Date;
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
  /** Privacy-policy version the guest accepted before joining (PDPA consent record). */
  consent?: { version: string; at: Date };
  /** Opt-in email for "official photos are ready" (removed on unsubscribe or album purge). */
  notify?: { email: string; consentAt: Date; notifiedAt: Date | null };
  createdAt: Date;
}

export type PhotoSource = "guest" | "official";
export type PhotoStatus = "pending" | "ready" | "hidden" | "deleted";
export type RequiredVariant = "display" | "thumb";
export type PhotoVariant = RequiredVariant | "watermarked" | "video";

export interface PhotoDoc {
  _id: ObjectId;
  eventId: ObjectId;
  source: PhotoSource;
  uploader: { type: "guest" | "user"; id: ObjectId; displayName: string | null };
  /**
   * `watermarked` exists for photos uploaded while the event was on a watermarked plan;
   * the clean `display` key then has a random suffix so it cannot be guessed from it.
   */
  keys: Record<RequiredVariant, string> & { watermarked?: string; original?: string; video?: string };
  contentType: UploadContentType;
  bytes: Record<RequiredVariant, number> & { watermarked?: number; video?: number };
  /** "video": display/thumb are poster frames and `keys.video` holds the clip. Missing = photo. */
  kind?: "photo" | "video";
  video?: {
    contentType: VideoContentType;
    durationSec: number;
    /** The browser could not draw a frame, so display/thumb are a placeholder. */
    posterFallback?: boolean;
    /** The uploader's browser could not read the length; measured on the server at completion. */
    durationPending?: boolean;
    /** Server-side frame grab (ffmpeg): done, in progress, or not possible for this clip. */
    poster?: "server" | "pending" | "failed";
    posterClaimedAt?: Date;
  };
  width: number;
  height: number;
  takenAt: Date | null;
  status: PhotoStatus;
  /** Number of open guest reports (missing on photos uploaded before reports existed). */
  openReports?: number;
  /** SafeSearch result; `flagged` photos start hidden until the host reviews them. */
  autoModeration?: {
    flagged: boolean;
    labels: { adult: string; violence: string; racy: string };
    at: Date;
    reviewedAt?: Date;
  };
  createdAt: Date;
  completedAt: Date | null;
  deletedAt?: Date;
  /** Full-resolution file in the private originals bucket (photographer uploads). */
  original?: {
    key: string;
    contentType: string;
    bytes: number;
    filename: string;
    partSize: number;
    uploadId: string | null;
    status: "uploading" | "ready";
    completedAt: Date | null;
  };
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

export const VIDEO_CONTENT_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export type VideoContentType = (typeof VIDEO_CONTENT_TYPES)[number];

export const UPLOAD_LIMITS = {
  maxFilesPerRequest: 10,
  maxBytes: {
    display: 8 * 1024 * 1024,
    thumb: 1024 * 1024,
    watermarked: 8 * 1024 * 1024,
    video: 400 * 1024 * 1024, // hard cap; the plan's limit is usually lower
  } satisfies Record<PhotoVariant, number>,
  presignExpiresSeconds: 10 * 60,
} as const;
