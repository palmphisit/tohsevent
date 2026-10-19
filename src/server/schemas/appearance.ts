import { z } from "zod";
import { GUEST_GALLERIES, GUEST_HEADERS, GUEST_THEMES } from "../models";
import { APPEARANCE_LIMITS } from "../services/appearance";

export const saveAppearanceSchema = z.object({
  theme: z.enum(GUEST_THEMES),
  header: z.enum(GUEST_HEADERS),
  gallery: z.enum(GUEST_GALLERIES),
  defaultTab: z.enum(["guest", "official"]),
  uploadLabel: z.string().max(APPEARANCE_LIMITS.uploadLabelMax).nullable(),
  showDate: z.boolean(),
});
