import { CalendarDays } from "lucide-react";
import type { Appearance, PublicEvent } from "@/lib/api-client";

type HeaderEvent = Pick<PublicEvent, "title" | "branding">;

/** Decorative fill used when the host has no cover image: the event color with soft shapes. */
function BrandFill() {
  return (
    <div className="absolute inset-0 bg-brand">
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/25" />
      <div className="absolute -right-10 -bottom-16 h-48 w-48 rounded-full bg-white/15" />
      <div className="absolute top-6 right-32 h-14 w-14 rounded-full bg-white/10" />
      <div className="absolute -top-10 left-1/3 h-28 w-28 rounded-full bg-white/10" />
    </div>
  );
}

function DateLine({ date, className = "" }: { date: string; className?: string }) {
  return (
    <p className={`flex items-center gap-1.5 text-sm ${className}`}>
      <CalendarDays className="h-4 w-4" />
      {date}
    </p>
  );
}

/**
 * Full-width cover with the title on it (header style "hero"). Rendered outside the
 * page's content column so it spans the whole screen.
 */
export function HeroHeader({ event, date, appearance }: { event: HeaderEvent; date: string; appearance: Appearance }) {
  const branding = event.branding;
  return (
    <header className="relative isolate h-[300px] w-full overflow-hidden sm:h-[380px]">
      {branding?.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN
        <img src={branding.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <BrandFill />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl px-4 pb-14 text-white">
        {branding?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN
          <img src={branding.logoUrl} alt="" className="mb-3 h-14 w-auto max-w-[200px] object-contain drop-shadow" />
        )}
        {appearance.showDate && <DateLine date={date} className="text-white/80" />}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance drop-shadow-sm sm:text-4xl">{event.title}</h1>
        {branding?.welcomeMessage && (
          <p className="mt-2 max-w-xl whitespace-pre-line text-white/85">{branding.welcomeMessage}</p>
        )}
      </div>
    </header>
  );
}

/** Header styles "banner" and "minimal", inside the content column. */
export function EventHeader({ event, date, appearance }: { event: HeaderEvent; date: string; appearance: Appearance }) {
  const branding = event.branding;

  if (appearance.header === "minimal") {
    return (
      <header className="flex flex-col items-center pt-4 text-center">
        {branding?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN
          <img src={branding.logoUrl} alt="" className="mb-4 h-16 w-auto max-w-[220px] object-contain" />
        ) : (
          <span className="mb-4 h-1.5 w-12 rounded-full bg-brand" />
        )}
        {appearance.showDate && <DateLine date={date} className="text-muted" />}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{event.title}</h1>
        {branding?.welcomeMessage && (
          <p className="mt-3 max-w-lg whitespace-pre-line text-ink/75">{branding.welcomeMessage}</p>
        )}
      </header>
    );
  }

  return (
    <header>
      <div className="relative">
        <div className="relative aspect-[3/1] w-full overflow-hidden rounded-3xl shadow-sm sm:aspect-[7/2]">
          {branding?.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN
            <img src={branding.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <BrandFill />
          )}
        </div>
        {branding?.logoUrl && (
          <div className="absolute -bottom-8 left-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-card p-2 shadow-md ring-4 ring-[var(--g-page,#fff)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN */}
            <img src={branding.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        )}
      </div>
      <div className={branding?.logoUrl ? "mt-11" : "mt-5"}>
        {appearance.showDate && <DateLine date={date} className="text-muted" />}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{event.title}</h1>
        {branding?.welcomeMessage && <p className="mt-2 whitespace-pre-line text-ink/75">{branding.welcomeMessage}</p>}
      </div>
    </header>
  );
}
