import { z } from "zod";
import { BRAND_FONT_IDS } from "../../lib/brand-fonts";
import { BRANDING_ASSET_KINDS, BRANDING_ASSET_TYPES, BRANDING_LIMITS } from "../services/branding";

const key = z.string().min(1).max(300);

export const brandingAssetSchema = z.object({
  kind: z.enum(BRANDING_ASSET_KINDS),
  contentType: z.enum(BRANDING_ASSET_TYPES),
  bytes: z.number().int().positive().max(BRANDING_LIMITS.assetMaxBytes),
});

export const saveBrandingSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #1d4ed8"),
  fontId: z.enum(BRAND_FONT_IDS),
  logoKey: key.nullable(),
  coverKey: key.nullable(),
  welcomeMessage: z.string().max(BRANDING_LIMITS.welcomeMessageMax).nullable(),
  sponsors: z
    .array(
      z.object({
        id: z.string().max(40).optional(),
        name: z.string().trim().min(1).max(80),
        imageKey: key,
        linkUrl: z.url({ protocol: /^https?$/ }).max(500).nullable().optional(),
      }),
    )
    .max(BRANDING_LIMITS.maxSponsors),
});
