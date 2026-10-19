"use client";

import { CircleAlert } from "lucide-react";
import { useLocale } from "@/lib/use-locale";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  dismissError,
  OAUTH_ERRORS,
  OAUTH_FALLBACK,
  showError,
  subscribeErrors,
  type ErrorPopup,
} from "@/lib/error-popup";

/** Renders queued error popups one at a time (mounted once, in the root layout). */
const T = {
  en: { title: "Something went wrong", ok: "OK" },
  th: { title: "เกิดข้อผิดพลาด", ok: "ตกลง" },
};

export function ErrorPopupHost() {
  const t = T[useLocale()];
  const [queue, setQueue] = useState<ErrorPopup[]>([]);
  const okRef = useRef<HTMLButtonElement>(null);
  const current = queue[0];

  useEffect(() => subscribeErrors(setQueue), []);

  useEffect(() => {
    if (!current) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismissError(current.id);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  if (!current) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 p-4 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && dismissError(current.id)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-popup-title"
        aria-describedby="error-popup-message"
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl ring-1 ring-slate-200"
      >
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <CircleAlert className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="error-popup-title" className="font-semibold text-slate-900">
              {current.title ?? t.title}
            </h2>
            <p id="error-popup-message" className="mt-1 text-sm leading-relaxed text-slate-600">
              {current.message}
            </p>
          </div>
        </div>
        <button
          ref={okRef}
          type="button"
          onClick={() => dismissError(current.id)}
          className="mt-5 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          {t.ok}
        </button>
      </div>
    </div>
  );
}

/**
 * Google sign-in / linking failures come back as `?error=<code>` on the page that started
 * them: show the matching popup, then clean the URL so a reload does not show it again.
 */
export function OAuthErrorWatcher() {
  const locale = useLocale();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const code = params.get("error");

  useEffect(() => {
    if (!code) return;
    const known = OAUTH_ERRORS[locale][code] ?? OAUTH_FALLBACK[locale];
    showError(known.message, known.title);
    const rest = new URLSearchParams(params);
    rest.delete("error");
    rest.delete("error_description");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [code, params, pathname, router, locale]);

  return null;
}
