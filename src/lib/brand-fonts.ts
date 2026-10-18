// Font choices for event branding. Ids are stored in the database; the actual
// next/font loaders live in src/app/brand-fonts.ts.
export const BRAND_FONT_IDS = ["noto-sans-thai", "prompt", "kanit", "sarabun", "mitr", "noto-serif-thai"] as const;
export type BrandFontId = (typeof BRAND_FONT_IDS)[number];

export const BRAND_FONT_LABELS: Record<BrandFontId, string> = {
  "noto-sans-thai": "Noto Sans Thai (ค่าเริ่มต้น)",
  prompt: "Prompt",
  kanit: "Kanit",
  sarabun: "Sarabun",
  mitr: "Mitr",
  "noto-serif-thai": "Noto Serif Thai (มีเชิง)",
};

export const DEFAULT_BRAND_COLOR = "#18181b";

/** Black or white text, whichever reads better on `hex` (WCAG relative luminance). */
export function contrastText(hex: string): "#ffffff" | "#18181b" {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? "#18181b" : "#ffffff";
}
