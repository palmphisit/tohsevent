import { randomBytes } from "node:crypto";
import { contrastText, DEFAULT_BRAND_COLOR, type BrandFontId } from "../../lib/brand-fonts";
import { collections } from "../db";
import { HttpError } from "../http";
import { planOf, type BrandingDoc, type EventDoc } from "../models";
import { deleteObjects, headObject, presignPut, publicUrl } from "../storage";

// Custom look of the guest page (Premium): brand color, font, logo, cover image,
// welcome message and sponsor banners. Images go straight to storage via presigned PUT.

export const BRANDING_ASSET_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type BrandingAssetType = (typeof BRANDING_ASSET_TYPES)[number];
export const BRANDING_ASSET_KINDS = ["logo", "cover", "sponsor"] as const;
export type BrandingAssetKind = (typeof BRANDING_ASSET_KINDS)[number];

export const BRANDING_LIMITS = {
  assetMaxBytes: 2 * 1024 * 1024,
  maxSponsors: 12,
  welcomeMessageMax: 300,
} as const;

const EXTENSIONS: Record<BrandingAssetType, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

const brandingPrefix = (event: EventDoc) => `events/${event._id.toHexString()}/branding/`;

export interface PublicSponsor {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl: string | null;
}

/** What the guest page needs to render a branded event. */
export interface PublicBranding {
  primaryColor: string;
  contrastColor: string;
  fontId: BrandFontId;
  logoUrl: string | null;
  coverUrl: string | null;
  welcomeMessage: string | null;
  sponsors: PublicSponsor[];
}

/** Branding is applied only while the event's plan includes it. */
export function toPublicBranding(event: EventDoc): PublicBranding | null {
  const b = event.branding;
  if (!b || !planOf(event).branding) return null;
  return {
    primaryColor: b.primaryColor,
    contrastColor: contrastText(b.primaryColor),
    fontId: b.fontId,
    logoUrl: b.logoKey ? publicUrl(b.logoKey) : null,
    coverUrl: b.coverKey ? publicUrl(b.coverKey) : null,
    welcomeMessage: b.welcomeMessage,
    sponsors: b.sponsors.map((s) => ({ id: s.id, name: s.name, imageUrl: publicUrl(s.imageKey), linkUrl: s.linkUrl })),
  };
}

export interface BrandingAsset {
  key: string;
  url: string;
}

/** Editor state for the dashboard: storage keys (to save back) plus display URLs. */
export interface BrandingEditorState {
  primaryColor: string;
  fontId: BrandFontId;
  logo: BrandingAsset | null;
  cover: BrandingAsset | null;
  welcomeMessage: string;
  sponsors: { id: string; name: string; image: BrandingAsset; linkUrl: string }[];
}

const asset = (key: string | null): BrandingAsset | null => (key ? { key, url: publicUrl(key) } : null);

export function toBrandingEditorState(event: EventDoc): BrandingEditorState {
  const b = event.branding;
  return {
    primaryColor: b?.primaryColor ?? DEFAULT_BRAND_COLOR,
    fontId: b?.fontId ?? "noto-sans-thai",
    logo: asset(b?.logoKey ?? null),
    cover: asset(b?.coverKey ?? null),
    welcomeMessage: b?.welcomeMessage ?? "",
    sponsors: (b?.sponsors ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      image: asset(s.imageKey)!,
      linkUrl: s.linkUrl ?? "",
    })),
  };
}

function requireBrandingPlan(event: EventDoc) {
  if (!planOf(event).branding) {
    throw new HttpError(403, "plan_required", "Custom branding is available on the Premium plan");
  }
}

/** Presigned PUT for a logo / cover / sponsor image. Nothing is linked until the branding is saved. */
export async function createBrandingAssetUpload(
  event: EventDoc,
  input: { kind: BrandingAssetKind; contentType: BrandingAssetType; bytes: number },
): Promise<{ key: string; url: string; upload: { url: string; method: "PUT"; headers: Record<string, string> } }> {
  requireBrandingPlan(event);
  const key = `${brandingPrefix(event)}${input.kind}-${randomBytes(8).toString("hex")}.${EXTENSIONS[input.contentType]}`;
  return {
    key,
    url: publicUrl(key),
    upload: {
      url: await presignPut(key, input.contentType, input.bytes),
      method: "PUT",
      headers: { "Content-Type": input.contentType },
    },
  };
}

export interface SaveBrandingInput {
  primaryColor: string;
  fontId: BrandFontId;
  logoKey: string | null;
  coverKey: string | null;
  welcomeMessage: string | null;
  sponsors: { id?: string; name: string; imageKey: string; linkUrl?: string | null }[];
}

async function requireOwnAsset(event: EventDoc, key: string) {
  if (!key.startsWith(brandingPrefix(event))) throw new HttpError(400, "invalid_asset", "Unknown image");
  if (!(await headObject(key))) throw new HttpError(400, "asset_missing", "An image has not finished uploading");
}

export async function saveBranding(event: EventDoc, input: SaveBrandingInput): Promise<BrandingDoc> {
  requireBrandingPlan(event);
  const keys = [input.logoKey, input.coverKey, ...input.sponsors.map((s) => s.imageKey)].filter(
    (key): key is string => !!key,
  );
  await Promise.all(keys.map((key) => requireOwnAsset(event, key)));

  const branding: BrandingDoc = {
    primaryColor: input.primaryColor.toLowerCase(),
    fontId: input.fontId,
    logoKey: input.logoKey,
    coverKey: input.coverKey,
    welcomeMessage: input.welcomeMessage?.trim() || null,
    sponsors: input.sponsors.map((s) => ({
      id: s.id || randomBytes(6).toString("hex"),
      name: s.name.trim(),
      imageKey: s.imageKey,
      linkUrl: s.linkUrl || null,
    })),
    updatedAt: new Date(),
  };
  const { events } = await collections();
  await events.updateOne({ _id: event._id }, { $set: { branding, updatedAt: branding.updatedAt } });

  // Remove images that are no longer referenced (best effort; storage leftovers are harmless).
  const previous = event.branding
    ? [event.branding.logoKey, event.branding.coverKey, ...event.branding.sponsors.map((s) => s.imageKey)]
    : [];
  const unused = previous.filter((key): key is string => !!key && !keys.includes(key));
  await deleteObjects(unused).catch((error) => console.error("branding: failed to delete old images", error));

  return branding;
}

/** All storage keys owned by the branding (used when an expired album is purged). */
export function brandingKeys(branding: BrandingDoc | undefined): string[] {
  if (!branding) return [];
  return [branding.logoKey, branding.coverKey, ...branding.sponsors.map((s) => s.imageKey)].filter(
    (key): key is string => !!key,
  );
}
