import type { ObjectId } from "mongodb";
import type { BrandFontId } from "../lib/brand-fonts";
import type { CustomPlanConfig } from "../lib/custom-plan";
import type { Locale } from "../lib/i18n";
import { CUSTOM_PLAN } from "../lib/custom-plan";
import { customPlan, PLANS, type Plan, type PlanTier } from "./plans";

const CUSTOM_DEFAULT: CustomPlanConfig = CUSTOM_PLAN.min;

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
  plan?: { tier: PlanTier; upgradedAt: Date | null; custom?: CustomPlanConfig };
  /** `counters.photos` = photos guests can see; `usage.photos` = all stored photos (counts toward the plan). */
  counters: { photos: number; guests: number };
  /** `bytes`: everything stored for the album (missing on older events until backfilled). */
  usage?: { photos: number; bytes?: number };
  /** Set once the files of an expired album have been deleted. */
  purgedAt?: Date | null;
  /** Custom look of the guest page (Premium). Storage keys point to events/<id>/branding/*. */
  branding?: BrandingDoc;
  /** When the host was emailed that the album expires soon. */
  expiryReminderSentAt?: Date | null;
  /** People invited to work on the event besides the owner (photographers). */
  members?: EventMember[];
  /** Language of the event's QR code and guest links (missing = Thai, the original default). */
  language?: Locale;
  /** Details shown on the event page: description, times, venue, map location, schedule. */
  info?: EventInfoDoc;
  /** Sign-up before the event and check-in at the door; missing = registration off. */
  registration?: RegistrationSettingsDoc;
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

export interface ScheduleItem {
  id: string;
  /** "HH:mm", local time of the event (Asia/Bangkok). */
  time: string;
  title: string;
  detail: string | null;
}

export interface EventInfoDoc {
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  venueName: string | null;
  address: string | null;
  location: { lat: number; lng: number } | null;
  schedule: ScheduleItem[];
  updatedAt: Date;
}

export interface RegistrationSettingsDoc {
  enabled: boolean;
  /** Most sign-ups accepted (never above the plan's guest limit); null = the plan's limit. */
  capacity: number | null;
  /** Online sign-up closes at this moment; null = when the event day ends. */
  closesAt: Date | null;
  askPhone: boolean;
  askOrganization: boolean;
  askPartySize: boolean;
  /** One extra free-text question; null = none. */
  question: string | null;
  updatedAt: Date;
}

export interface RegistrationDoc {
  _id: ObjectId;
  eventId: ObjectId;
  /** Ticket code in the QR (also the ticket page's secret). */
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  partySize: number;
  answer: string | null;
  /** online = signed up beforehand, onsite = walked in (self-service at the door or by staff). */
  source: "online" | "onsite";
  status: "registered" | "cancelled";
  checkedInAt: Date | null;
  /** "self" (on-site sign-up), "staff-link", or the user id of the host/photographer who scanned. */
  checkedInBy: string | null;
  consentAt: Date;
  createdAt: Date;
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
  const tier = event.plan?.tier ?? "free";
  if (tier === "custom") return customPlan(event.plan?.custom ?? CUSTOM_DEFAULT);
  return PLANS[tier];
}

export interface PaymentDoc {
  _id: ObjectId;
  eventId: ObjectId;
  ownerId: ObjectId;
  fromTier: PlanTier;
  toTier: PlanTier;
  /** What a Custom package was bought with (toTier "custom"). */
  custom?: CustomPlanConfig;
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
    video: 5 * 1024 ** 3, // hard cap (single-request upload limit); each plan's limit is lower or equal
  } satisfies Record<PhotoVariant, number>,
  presignExpiresSeconds: 10 * 60,
} as const;
