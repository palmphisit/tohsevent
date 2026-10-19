"use client";

import { usePathname } from "next/navigation";
import { localeFromPath, type Locale } from "./i18n";

/**
 * Language of the current page, from its path ("/th/…" = Thai). The host dashboard and
 * invite pages are Thai-only for now, so shared components (uploader, lightbox) stay Thai there.
 */
export function useLocale(): Locale {
  const pathname = usePathname() ?? "/";
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/invite")) return "th";
  return localeFromPath(pathname);
}
