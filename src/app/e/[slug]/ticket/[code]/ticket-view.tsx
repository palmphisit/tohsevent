import { CalendarDays, CalendarPlus, CheckCircle2, Clock, Images, MapPin, Navigation, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BRAND_FONT_CLASS } from "@/app/brand-fonts";
import { googleMapsLinks } from "@/lib/maps";
import { qrSvg } from "@/server/qr";
import { eventInfoOf } from "@/server/services/event-info";
import { findOpenEventBySlug, toPublicEvent } from "@/server/services/events";
import { findByCode, ticketUrl } from "@/server/services/registration";
import { LanguageSwitch } from "@/components/language-switch";
import { INTL_LOCALE, localePath, type Locale } from "@/lib/i18n";

const COPY = {
  en: {
    time: (range: string) => range,
    ticket: "Event ticket",
    people: (n: number) => `${n} ${n === 1 ? "person" : "people"}`,
    checkedIn: (time: string) => `Checked in at ${time}`,
    showQr: "Show this QR at the registration desk · a screenshot works too",
    directions: "Directions",
    calendar: "Add to calendar",
    details: "Event details",
    album: "Event album",
  },
  th: {
    time: (range: string) => `${range} น.`,
    ticket: "บัตรเข้างาน",
    people: (n: number) => `${n} คน`,
    checkedIn: (time: string) => `เช็กอินแล้ว ${time} น.`,
    showQr: "แสดง QR นี้ที่จุดลงทะเบียนหน้างาน · แคปหน้าจอเก็บไว้ได้",
    directions: "นำทางไปงาน",
    calendar: "ลงปฏิทิน",
    details: "รายละเอียดงาน",
    album: "อัลบั้มรูปในงาน",
  },
};


/** The guest's ticket: QR for the door, event essentials and links. The code in the URL is the secret. */
type Params = Promise<{ slug: string; code: string }>;

export function TicketView({ params, locale }: { params: Params; locale: Locale }) {
  return (
    <Suspense fallback={<div className="h-dvh animate-pulse bg-slate-100" />}>
      <Ticket params={params} locale={locale} />
    </Suspense>
  );
}

async function Ticket({ params, locale }: { params: Params; locale: Locale }) {
  const t = COPY[locale];
  const { slug, code } = await params;
  await connection();
  const event = await findOpenEventBySlug(slug);
  if (!event) notFound();
  const reg = await findByCode(event, code);
  if (!reg || reg.status !== "registered") notFound();

  const pub = toPublicEvent(event);
  const info = eventInfoOf(event);
  const maps = googleMapsLinks(info);
  const svg = await qrSvg(ticketUrl(event, reg.code), 1);
  const branding = pub.branding;
  const style = branding
    ? ({ "--brand": branding.primaryColor, "--brand-contrast": branding.contrastColor } as React.CSSProperties)
    : undefined;
  const date = event.date.toLocaleDateString(INTL_LOCALE[locale], { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const time = info.startTime ? t.time(`${info.startTime}${info.endTime ? `–${info.endTime}` : ""}`) : null;

  return (
    <div
      style={style}
      data-theme={pub.appearance.theme}
      className={`guest-page relative flex min-h-dvh items-start justify-center px-4 py-8 sm:items-center ${branding ? BRAND_FONT_CLASS[branding.fontId] : ""}`}
    >
      <Suspense>
        <LanguageSwitch className="absolute top-3 right-3" />
      </Suspense>
      <div className="w-full max-w-sm">
        <article className="overflow-hidden rounded-3xl bg-card shadow-xl ring-1 ring-line">
          <div className="relative bg-brand px-6 pt-6 pb-8 text-brand-contrast">
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/20" />
            <p className="relative text-xs tracking-[0.2em] uppercase opacity-80">{t.ticket}</p>
            <h1 className="relative mt-1 text-2xl font-semibold text-balance">{event.title}</h1>
            <p className="relative mt-2 flex items-center gap-1.5 text-sm opacity-90">
              <CalendarDays className="h-4 w-4" /> {date}
            </p>
            {time && (
              <p className="relative mt-1 flex items-center gap-1.5 text-sm opacity-90">
                <Clock className="h-4 w-4" /> {time}
              </p>
            )}
          </div>
          {/* Perforation */}
          <div className="relative -mt-3 h-6">
            <span className="absolute top-0 -left-3 h-6 w-6 rounded-full bg-[var(--g-page,#fff)]" />
            <span className="absolute top-0 -right-3 h-6 w-6 rounded-full bg-[var(--g-page,#fff)]" />
            <span className="absolute inset-x-5 top-3 border-t-2 border-dashed border-line" />
          </div>
          <div className="px-6 pb-6 text-center">
            <p className="text-lg font-semibold">{reg.name}</p>
            {reg.partySize > 1 && (
              <p className="mt-0.5 flex items-center justify-center gap-1 text-sm text-muted">
                <Users className="h-4 w-4" /> {t.people(reg.partySize)}
              </p>
            )}
            <div className="mx-auto mt-4 w-56 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
              {/* SVG generated server-side by the qrcode library from our own URL */}
              <div dangerouslySetInnerHTML={{ __html: svg }} className="[&_svg]:h-auto [&_svg]:w-full" />
            </div>
            <p className="mt-3 font-mono text-xl font-semibold tracking-[0.3em]">{reg.code}</p>
            {reg.checkedInAt ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />{" "}
                {t.checkedIn(reg.checkedInAt.toLocaleTimeString(INTL_LOCALE[locale], { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }))}
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted">{t.showQr}</p>
            )}
            {(info.venueName || info.address) && (
              <p className="mt-4 flex items-start justify-center gap-1.5 text-sm text-ink/75">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {[info.venueName, info.address].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </article>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-medium">
          {maps && (
            <a href={maps.directions} target="_blank" rel="noopener" className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-brand-contrast">
              <Navigation className="h-4 w-4" /> {t.directions}
            </a>
          )}
          <a href={`/e/${event.slug}/calendar.ics`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-card px-4 py-3 ring-1 ring-line">
            <CalendarPlus className="h-4 w-4" /> {t.calendar}
          </a>
          <Link href={localePath(locale, `/e/${event.slug}/info`)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-card px-4 py-3 ring-1 ring-line">
            {t.details}
          </Link>
          <Link href={localePath(locale, `/e/${event.slug}`)} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-card px-4 py-3 ring-1 ring-line">
            <Images className="h-4 w-4" /> {t.album}
          </Link>
        </div>
      </div>
    </div>
  );
}
