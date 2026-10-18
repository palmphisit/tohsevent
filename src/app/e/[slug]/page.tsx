import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { guestCookieName, verifyGuestToken } from "@/server/guest-session";
import { findOpenEventBySlug, toPublicEvent } from "@/server/services/events";
import { findGuestSession, toPublicSession } from "@/server/services/guests";
import { GuestApp } from "./_components/guest-app";

// Guest albums are private: keep them out of search engines.
export const metadata = { title: { absolute: "อัลบั้มรูปในงาน · Tohs Event" }, robots: { index: false, follow: false } };

export default function EventPage({ params }: PageProps<"/e/[slug]">) {
  return (
    <Suspense fallback={<EventSkeleton />}>
      <EventLoader params={params} />
    </Suspense>
  );
}

async function EventLoader({ params }: Pick<PageProps<"/e/[slug]">, "params">) {
  const { slug } = await params;
  await connection(); // event visibility depends on the current time and DB state
  const event = await findOpenEventBySlug(slug);
  if (!event) notFound();

  const eventId = event._id.toHexString();
  const claims = await verifyGuestToken((await cookies()).get(guestCookieName(eventId))?.value, eventId);
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
