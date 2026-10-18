import { Kanit, Mitr, Noto_Sans_Thai, Noto_Serif_Thai, Prompt, Sarabun } from "next/font/google";
import type { BrandFontId } from "@/lib/brand-fonts";

// Self-hosted at build time. preload: false so a font file is only fetched by the
// browser on pages that actually use it. (next/font needs literal options per call.)
const notoSansThai = Noto_Sans_Thai({ subsets: ["thai", "latin"], display: "swap", preload: false });
const prompt = Prompt({ subsets: ["thai", "latin"], weight: ["400", "600"], display: "swap", preload: false });
const kanit = Kanit({ subsets: ["thai", "latin"], weight: ["400", "600"], display: "swap", preload: false });
const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "600"], display: "swap", preload: false });
const mitr = Mitr({ subsets: ["thai", "latin"], weight: ["400", "600"], display: "swap", preload: false });
const notoSerifThai = Noto_Serif_Thai({ subsets: ["thai", "latin"], display: "swap", preload: false });

export const BRAND_FONT_CLASS: Record<BrandFontId, string> = {
  "noto-sans-thai": notoSansThai.className,
  prompt: prompt.className,
  kanit: kanit.className,
  sarabun: sarabun.className,
  mitr: mitr.className,
  "noto-serif-thai": notoSerifThai.className,
};
