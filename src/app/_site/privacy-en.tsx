import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { PLANS, PURGE_GRACE_DAYS } from "@/server/plans";

// English privacy notice (Thai version: privacy-th.tsx). Must be reviewed by a lawyer before launch.
export function PrivacyEn() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← {LEGAL.serviceName}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Privacy policy</h1>
      <p className="mt-1 text-sm text-slate-500">
        Effective {LEGAL.effectiveDateEn} (version {LEGAL.version})
      </p>

      <div className="mt-8 space-y-8 leading-7 text-slate-700 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc">
        <section>
          <h2>1. Data controller</h2>
          <p>
            {LEGAL.controllerNameEn} (&quot;we&quot;) provides {LEGAL.serviceName}, a photo-sharing platform for events. This
            policy explains how we collect, use and disclose personal data under Thailand&apos;s Personal Data Protection Act
            B.E. 2562 (2019) (PDPA). Contact us at{" "}
            <a className="underline" href={`mailto:${LEGAL.contactEmail}`}>
              {LEGAL.contactEmail}
            </a>
            .
          </p>
        </section>

        <section>
          <h2>2. Data we collect</h2>
          <ul>
            <li>
              <b>Guests:</b> photos you upload, your display name (if given), a hash of your IP address to prevent abuse, an event
              cookie that remembers you joined, and your email (only if you ask to be notified)
            </li>
            <li>
              <b>Registered attendees:</b> name, email and the details the organizer asks for (such as phone number,
              organization, party size and answers to extra questions), the ticket code and the time you checked in
            </li>
            <li>
              <b>Hosts / organizers:</b> name, email, password (stored as a one-way hash), event details and payment history (cards
              are processed by Stripe; we never see or store card numbers)
            </li>
            <li>
              <b>Technical data:</b> logs needed to keep the service secure, such as when a photo was deleted or hidden
            </li>
          </ul>
          <p className="mt-2">Your browser resizes photos and removes EXIF data (such as GPS location) before every upload.</p>
        </section>

        <section>
          <h2>3. Purposes and legal bases</h2>
          <ul>
            <li>Showing photos to attendees of the same event so they can view and save them — consent of the uploader</li>
            <li>Providing host accounts, event management and payments — performance of a contract</li>
            <li>Automatically screening unsuitable photos, preventing spam and abuse — legitimate interests</li>
            <li>Emailing you when photos are ready — consent (withdraw any time)</li>
            <li>
              Registration and check-in for organizers (the organizer is the controller of this data; we process it on their
              behalf) — consent of the attendee
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Who sees your data</h2>
          <p>
            Photos uploaded to an event are visible to everyone who can open the event page (password-protected events: only
            people with the password) and to the event&apos;s host. We use the following processors, which may store data outside
            Thailand (for example in Singapore) under appropriate safeguards: Google Cloud (servers and Cloud Vision), MongoDB
            Atlas (database), Cloudflare R2 (photo storage), Stripe (payments) and an email delivery provider.
          </p>
        </section>

        <section>
          <h2>5. How long we keep data</h2>
          <p>
            Albums stay open according to the event&apos;s plan ({PLANS.free.retentionDays}–{PLANS.premium.retentionDays} days after the
            event). When an album expires, guests can no longer open it, and its files are permanently deleted within{" "}
            {PURGE_GRACE_DAYS} days. Registrations and check-in times are deleted together with the event&apos;s photos. Host
            account data is kept until you ask us to delete the account; payment records are kept as tax law requires.
          </p>
        </section>

        <section>
          <h2>6. Your rights</h2>
          <p>
            You may access, get a copy of, correct, delete, restrict or object to the use of your data, ask for it to be
            transferred, and withdraw consent at any time:
          </p>
          <ul>
            <li>Delete photos you uploaded yourself right away from the event page (&quot;Delete my photo&quot; in the photo viewer)</li>
            <li>
              Ask for photos of you to be removed: tap &quot;Report / request removal&quot; and choose &quot;I&apos;m in this photo&quot;; the
              host is notified immediately
            </li>
            <li>
              Contact us at{" "}
              <a className="underline" href={`mailto:${LEGAL.contactEmail}`}>
                {LEGAL.contactEmail}
              </a>
              ; we reply within 30 days
            </li>
          </ul>
          <p className="mt-2">If you believe we do not comply with the law, you may complain to Thailand&apos;s Personal Data Protection Committee (PDPC).</p>
        </section>

        <section>
          <h2>7. Cookies</h2>
          <p>
            We only use cookies needed for the service to work: the event cookie (remembers that a guest joined) and the host
            sign-in cookie, plus a language preference. No advertising or cross-site tracking cookies.
          </p>
        </section>

        <section>
          <h2>8. Changes to this policy</h2>
          <p>We will post significant changes on this page and ask for consent again where the law requires.</p>
        </section>
      </div>
    </main>
  );
}
