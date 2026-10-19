import { CalendarDays, CalendarPlus, Clock, Images, MapPin, Navigation, Ticket, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BRAND_FONT_CLASS } from "@/app/brand-fonts";
import { LegalFooter } from "@/components/legal-footer";
import { OsmMap } from "@/components/osm-map";
import { googleMapsLinks } from "@/lib/maps";
import { verifyEventKey } from "@/server/event-keys";
import { eventInfoOf } from "@/server/services/event-info";
import { findOpenEventBySlug, toPublicEvent } from "@/server/services/events";
import { capacityOf, onlineClosesAt, registrationSettingsOf, registrationState, registrationStats } from "@/server/services/registration";
import { LanguageSwitch } from "@/components/language-switch";
import { INTL_LOCALE, localePath, type Locale } from "@/lib/i18n";
import { RegisterForm } from "./register-form";

const COPY = {
  en: {
    time: (range: string) => range,
    registerOnsite: "Register at the door",
    register: "Register",
    album: "Event album",
    date: "Date",
    timeLabel: "Time",
    seeSchedule: "See schedule",
    place: "Venue",
    tba: "To be announced",
    addCalendar: "Add to calendar",
    details: "About the event",
    schedule: "Schedule",
    venue: "Venue",
    directions: "Directions in Google Maps",
    viewMap: "View in Google Maps",
    onsiteHint: "Fill in your details and your arrival time is recorded right away",
    ticketHint: (closes: string) => `Get a ticket with a QR code · closes ${closes}`,
    seatsLeft: (n: string) => `${n} seats left`,
    full: "Fully booked. Thanks for your interest.",
    closed: "Online registration has closed. Contact the organizer to register at the door.",
  },
  th: {
    time: (range: string) => `${range} น.`,
    registerOnsite: "ลงทะเบียนหน้างาน",
    register: "ลงทะเบียนร่วมงาน",
    album: "อัลบั้มรูปในงาน",
    date: "วันที่",
    timeLabel: "เวลา",
    seeSchedule: "ดูกำหนดการ",
    place: "สถานที่",
    tba: "แจ้งภายหลัง",
    addCalendar: "เพิ่มลงปฏิทิน",
    details: "รายละเอียดงาน",
    schedule: "กำหนดการ",
    venue: "สถานที่จัดงาน",
    directions: "นำทางด้วย Google Maps",
    viewMap: "ดูใน Google Maps",
    onsiteHint: "กรอกข้อมูลแล้วระบบจะบันทึกเวลาเข้างานให้ทันที",
    ticketHint: (closes: string) => `รับบัตรเข้างานพร้อม QR Code · ปิดรับ ${closes}`,
    seatsLeft: (n: string) => `เหลือ ${n} ที่`,
    full: "ที่นั่งเต็มแล้ว ขอบคุณที่สนใจ",
    closed: "ปิดรับลงทะเบียนออนไลน์แล้ว ติดต่อผู้จัดงานเพื่อลงทะเบียนหน้างาน",
  },
};


/** Event page: what, when, where (map), schedule, and sign-up (online or at the door). */
type RouteProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export function InfoPage({ params, searchParams, locale }: RouteProps & { locale: Locale }) {
  return (
    <Suspense fallback={<div className="h-dvh animate-pulse bg-slate-100" />}>
      <InfoLoader params={params} searchParams={searchParams} locale={locale} />
    </Suspense>
  );
}

const longDate = (d: Date, locale: Locale) =>
  d.toLocaleDateString(INTL_LOCALE[locale], { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

async function InfoLoader({ params, searchParams, locale }: RouteProps & { locale: Locale }) {
  const t = COPY[locale];
  const { slug } = await params;
  const { onsite } = await searchParams;
  await connection();
  const event = await findOpenEventBySlug(slug);
  if (!event) notFound();

  const pub = toPublicEvent(event);
  const info = eventInfoOf(event);
  const settings = registrationSettingsOf(event);
  const onsiteKey = typeof onsite === "string" && verifyEventKey(event, "onsite", onsite) ? onsite : null;
  const [state, stats] = await Promise.all([registrationState(event), registrationStats(event)]);
  // At the door the online deadline does not apply; only capacity does.
  const canRegister = settings.enabled && (onsiteKey ? state !== "off" && state !== "full" : state === "open");
  const seatsLeft = settings.capacity ? Math.max(0, capacityOf(event) - stats.headcount) : null;
  const maps = googleMapsLinks(info);
  const branding = pub.branding;
  const style = branding
    ? ({ "--brand": branding.primaryColor, "--brand-contrast": branding.contrastColor } as React.CSSProperties)
    : undefined;
  const time = info.startTime ? t.time(`${info.startTime}${info.endTime ? `–${info.endTime}` : ""}`) : null;

  return (
    <div
      style={style}
      data-theme={pub.appearance.theme}
      className={`guest-page flex min-h-dvh flex-col ${branding ? BRAND_FONT_CLASS[branding.fontId] : ""}`}
    >
      {/* Hero */}
      <header className="relative isolate overflow-hidden">
        {branding?.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN
          <img src={branding.coverUrl} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 -z-10 bg-brand">
            <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/30" />
            <div className="absolute -right-16 -bottom-24 h-72 w-72 rounded-full bg-white/10" />
            <div className="absolute top-10 left-1/3 h-20 w-20 rounded-full bg-white/10" />
          </div>
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
        <Suspense>
          <LanguageSwitch tone="dark" className="absolute top-3 right-3 z-20" />
        </Suspense>
        <div className="mx-auto w-full max-w-3xl px-4 pt-16 pb-20 text-white sm:pt-24">
          {branding?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN
            <img src={branding.logoUrl} alt="" className="mb-4 h-14 w-auto max-w-[200px] object-contain drop-shadow" />
          )}
          <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm backdrop-blur">
            <CalendarDays className="h-4 w-4" /> {longDate(event.date, locale)}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">{event.title}</h1>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-white/85">
            {time && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> {time}
              </span>
            )}
            {info.venueName && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {info.venueName}
              </span>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {canRegister && (
              <a href="#register" className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-900 shadow-lg hover:bg-white/90">
                {onsiteKey ? t.registerOnsite : t.register}
              </a>
            )}
            <Link href={localePath(locale, `/e/${event.slug}`)} className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 font-medium backdrop-blur hover:bg-white/25">
              <Images className="h-4 w-4" /> {t.album}
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto -mt-10 w-full max-w-3xl flex-1 space-y-5 px-4 pb-16">
        {/* Quick facts */}
        <section className="grid gap-3 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-line sm:grid-cols-3 sm:p-5">
          <Fact icon={CalendarDays} label={t.date} value={longDate(event.date, locale)} />
          <Fact icon={Clock} label={t.timeLabel} value={time ?? t.seeSchedule} />
          <Fact icon={MapPin} label={t.place} value={info.venueName ?? info.address ?? t.tba} />
          <a
            href={`/e/${event.slug}/calendar.ics`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface px-4 py-2.5 text-sm font-medium sm:col-span-3"
          >
            <CalendarPlus className="h-4 w-4" /> {t.addCalendar}
          </a>
        </section>

        {info.description && (
          <Card title={t.details}>
            <p className="leading-relaxed whitespace-pre-line text-ink/80">{info.description}</p>
          </Card>
        )}

        {info.schedule.length > 0 && (
          <Card title={t.schedule}>
            <ol className="relative space-y-5 border-l-2 border-line pl-6">
              {info.schedule.map((item) => (
                <li key={item.id} className="relative">
                  <span className="absolute top-1 -left-[31px] h-3.5 w-3.5 rounded-full bg-brand ring-4 ring-[var(--color-card)]" />
                  <p className="text-sm font-semibold text-brand tabular-nums">{t.time(item.time)}</p>
                  <p className="font-medium">{item.title}</p>
                  {item.detail && <p className="text-sm text-ink/70">{item.detail}</p>}
                </li>
              ))}
            </ol>
          </Card>
        )}

        {(info.venueName || info.address || info.location) && (
          <Card title={t.venue}>
            {info.venueName && <p className="font-semibold">{info.venueName}</p>}
            {info.address && <p className="mt-0.5 text-sm whitespace-pre-line text-ink/70">{info.address}</p>}
            {info.location && (
              <OsmMap location={info.location} className="mt-4 h-64 w-full overflow-hidden rounded-2xl ring-1 ring-line sm:h-80" />
            )}
            {maps && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <a
                  href={maps.directions}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-medium text-brand-contrast"
                >
                  <Navigation className="h-4 w-4" /> {t.directions}
                </a>
                <a
                  href={maps.view}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface px-4 py-3 font-medium"
                >
                  <MapPin className="h-4 w-4" /> {t.viewMap}
                </a>
              </div>
            )}
          </Card>
        )}

        {settings.enabled && (
          <section id="register" className="scroll-mt-6 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-line sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Ticket className="h-5 w-5 text-brand" /> {onsiteKey ? t.registerOnsite : t.register}
                </h2>
                <p className="text-sm text-muted">
                  {onsiteKey
                    ? t.onsiteHint
                    : t.ticketHint(onlineClosesAt(event).toLocaleString(INTL_LOCALE[locale], {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Bangkok",
                      }))}
                </p>
              </div>
              {seatsLeft !== null && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs font-medium">
                  <Users className="h-3.5 w-3.5" /> {t.seatsLeft(seatsLeft.toLocaleString(INTL_LOCALE[locale]))}
                </span>
              )}
            </div>
            {canRegister ? (
              <RegisterForm
                slug={event.slug}
                onsiteKey={onsiteKey}
                ask={{
                  phone: settings.askPhone,
                  organization: settings.askOrganization,
                  partySize: settings.askPartySize,
                  question: settings.question,
                }}
              />
            ) : (
              <p className="rounded-2xl bg-surface px-4 py-6 text-center text-ink/75">
                {state === "full" ? t.full : t.closed}
              </p>
            )}
          </section>
        )}
      </main>
      <LegalFooter />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-card p-5 shadow-sm ring-1 ring-line sm:p-6">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface text-brand">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-muted">{label}</span>
        <span className="block text-sm font-medium">{value}</span>
      </span>
    </div>
  );
}
