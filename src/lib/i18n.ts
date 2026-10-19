// Public pages come in two languages: English at "/…" (the default) and Thai at "/th/…".
// The host dashboard stays Thai. Each event chooses which language its QR code and links use.

export const LOCALES = ["en", "th"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Remembers a guest's explicit language choice (set by the language switch). */
export const LANG_COOKIE = "lang";

/** Path of `path` (starting with "/") in `locale`: "/e/x" → "/th/e/x" for Thai. */
export function localePath(locale: Locale, path: string): string {
  if (locale === "en") return path;
  return path === "/" ? "/th" : `/th${path}`;
}

export function localeFromPath(pathname: string): Locale {
  return pathname === "/th" || pathname.startsWith("/th/") ? "th" : "en";
}

/** The same page in the other language. */
export function switchLocalePath(pathname: string, to: Locale): string {
  const base = localeFromPath(pathname) === "th" ? pathname.slice(3) || "/" : pathname;
  return localePath(to, base);
}

/** Locale tags for Intl date/number formatting. */
export const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", th: "th-TH" };

export const LOCALE_LABEL: Record<Locale, string> = { en: "English", th: "ภาษาไทย" };

/** Picks this locale's strings from a { en, th } message table. */
export function pick<T>(table: Record<Locale, T>, locale: Locale): T {
  return table[locale];
}
