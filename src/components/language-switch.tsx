"use client";

import { Languages } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { LANG_COOKIE, localeFromPath, switchLocalePath } from "@/lib/i18n";

function rememberLocale(locale: "en" | "th") {
  document.cookie = `${LANG_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * EN | TH toggle for public pages. Remembers the choice in a cookie so an event's default
 * language does not send the guest back.
 */
export function LanguageSwitch({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = localeFromPath(pathname);
  const query = params.toString();

  function go(to: "en" | "th") {
    rememberLocale(to);
    window.location.assign(switchLocalePath(pathname, to) + (query ? `?${query}` : "") + window.location.hash);
  }

  const base =
    tone === "dark" ? "bg-white/15 text-white ring-white/20 backdrop-blur" : "bg-white/80 text-slate-700 ring-slate-200 backdrop-blur";
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-full p-0.5 text-xs font-semibold ring-1 ${base} ${className}`}>
      <Languages className="mx-1 h-3.5 w-3.5 opacity-70" aria-hidden="true" />
      {(["en", "th"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => l !== current && go(l)}
          aria-pressed={l === current}
          className={`rounded-full px-2.5 py-1 transition ${
            l === current ? (tone === "dark" ? "bg-white text-slate-900" : "bg-primary text-white") : "opacity-70 hover:opacity-100"
          }`}
        >
          {l === "en" ? "EN" : "ไทย"}
        </button>
      ))}
    </div>
  );
}
