import type { ObjectId } from "mongodb";

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
  counters: { photos: number; guests: number };
  createdAt: Date;
  updatedAt: Date;
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
export type PhotoVariant = "display" | "thumb";

export interface PhotoDoc {
  _id: ObjectId;
  eventId: ObjectId;
  source: PhotoSource;
  uploader: { type: "guest" | "user"; id: ObjectId; displayName: string | null };
  keys: Record<PhotoVariant, string> & { original?: string };
  contentType: UploadContentType;
  bytes: Record<PhotoVariant, number>;
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
  maxBytes: { display: 8 * 1024 * 1024, thumb: 1024 * 1024 } satisfies Record<PhotoVariant, number>,
  presignExpiresSeconds: 10 * 60,
} as const;
