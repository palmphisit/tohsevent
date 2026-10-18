import { z } from "zod";
import { SLIDESHOW_LAYOUTS, SLIDESHOW_SOURCES, SLIDESHOW_THEMES } from "../models";
import { SLIDESHOW_LIMITS as L } from "../services/slideshow";

export const saveSlideshowSchema = z.object({
  layout: z.enum(SLIDESHOW_LAYOUTS),
  theme: z.enum(SLIDESHOW_THEMES),
  sources: z.enum(SLIDESHOW_SOURCES),
  headline: z.string().max(L.headlineMax).nullable(),
  message: z.string().max(L.messageMax).nullable(),
  qrCaption: z.string().max(L.qrCaptionMax).nullable(),
  showQr: z.boolean(),
  showDate: z.boolean(),
  showUploader: z.boolean(),
  panelSide: z.enum(["left", "right"]),
  intervalSec: z.number().int().min(L.intervalMin).max(L.intervalMax),
});
