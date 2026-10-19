import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { guestCookieName, verifyGuestToken } from "@/server/guest-session";
import { findOpenEventBySlug, toPublicEvent } from "@/server/services/events";
import { findGuestSession, toPublicSession } from "@/server/services/guests";
import { LANG_COOKIE, localePath, type Locale } from "@/lib/i18n";
import { eventLocale } from "@/server/services/host-events";
import { GuestApp } from "./_components/guest-app";

// The guest album, rendered at /e/<slug> (English) and /th/e/<slug> (Thai).

export function AlbumPage({ params, locale }: { params: Promise<{ slug: string }>; locale: Locale }) {
  return (
    <Suspense fallback={<EventSkeleton />}>
      <EventLoader params={params} locale={locale} />
    </Suspense>
  );
}

async function EventLoader({ params, locale }: { params: Promise<{ slug: string }>; locale: Locale }) {
  const { slug } = await params;
  await connection(); // event visibility depends on the current time and DB state
  const event = await findOpenEventBySlug(slug);
  if (!event) notFound();

  const jar = await cookies();
  // Thai events: plain /e/<slug> links (older QR codes) open in Thai unless the guest chose English.
  if (locale === "en" && eventLocale(event) === "th" && jar.get(LANG_COOKIE)?.value !== "en") {
    redirect(localePath("th", `/e/${event.slug}`));
  }

  const eventId = event._id.toHexString();
  const claims = await verifyGuestToken(jar.get(guestCookieName(eventId))?.value, eventId);
  const session = claims && (await findGuestSession(event, claims.sessionId));

  return (
    <GuestApp
      event={toPublicEvent(event)}
      initialSession={session ? toPublicSession(session) : null}
    />
  );
}

function EventSkeleton() {
  return (
    <main className="mx-auto w-full max-w-3xl animate-pulse px-4 py-8">
      <div className="h-8 w-2/3 rounded bg-slate-200" />
      <div className="mt-3 h-4 w-1/3 rounded bg-slate-200" />
      <div className="mt-8 h-14 rounded-xl bg-slate-200" />
    </main>
  );
}
