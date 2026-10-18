import { z } from "zod";
import { UPLOAD_CONTENT_TYPES, UPLOAD_LIMITS, VIDEO_CONTENT_TYPES } from "../models";

const fileSchema = z.object({
  contentType: z.enum(UPLOAD_CONTENT_TYPES),
  bytes: z.object({
    display: z.number().int().positive().max(UPLOAD_LIMITS.maxBytes.display),
    thumb: z.number().int().positive().max(UPLOAD_LIMITS.maxBytes.thumb),
    watermarked: z.number().int().positive().max(UPLOAD_LIMITS.maxBytes.watermarked).optional(),
  }),
  width: z.number().int().positive().max(20_000),
  height: z.number().int().positive().max(20_000),
  takenAt: z.iso.datetime().optional(),
  /** Present for video items: display/thumb are then poster frames. */
  video: z
    .object({
      contentType: z.enum(VIDEO_CONTENT_TYPES),
      bytes: z.number().int().positive().max(UPLOAD_LIMITS.maxBytes.video),
      durationSec: z.number().positive().max(60 * 60),
    })
    .optional(),
});

/** Body of POST .../uploads (guest and host). */
export const uploadRequestSchema = z.object({
  files: z.array(fileSchema).min(1).max(UPLOAD_LIMITS.maxFilesPerRequest),
});
