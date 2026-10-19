import type { Locale } from "./i18n";

// Public site identity used for SEO metadata, sitemap and structured data.
export const SITE = {
  url: "https://tohsevent.com",
  name: "Tohs Event",
  title: "Tohs Event — Event photo sharing with a QR code, no app needed",
  description:
    "Collect every photo and video from your guests and photographers in one album. Guests scan a QR code and upload instantly: no app, no sign-up. Made for weddings, seminars, parties and corporate events.",
  keywords: [
    "event photo sharing",
    "wedding photo QR code",
    "guest photo upload",
    "event album",
    "แชร์รูปงานแต่ง",
    "QR Code รูปงานแต่ง",
    "อัลบั้มรูปงานอีเวนต์",
    "ช่างภาพอีเวนต์",
  ],
} as const;

/** Title and description of the home page in each language. */
export const SITE_COPY: Record<Locale, { title: string; description: string; ogLocale: string }> = {
  en: { title: SITE.title, description: SITE.description, ogLocale: "en_US" },
  th: {
    title: "Tohs Event — แชร์รูปในงานอีเวนต์ด้วย QR Code ไม่ต้องโหลดแอป",
    description:
      "รวมรูปและวิดีโอจากแขกทุกคนและช่างภาพไว้ในอัลบั้มเดียว แขกสแกน QR Code แล้วอัปโหลดได้ทันที ไม่ต้องโหลดแอป ไม่ต้องสมัครสมาชิก เหมาะกับงานแต่งงาน งานสัมมนา ปาร์ตี้ และอีเวนต์องค์กร",
    ogLocale: "th_TH",
  },
};

/** hreflang alternates for a public page available at `path` (English) and `/th…` (Thai). */
export function languageAlternates(path: string, locale: Locale) {
  const th = path === "/" ? "/th" : `/th${path}`;
  return {
    canonical: locale === "th" ? th : path,
    languages: { en: path, th, "x-default": path },
  };
}
