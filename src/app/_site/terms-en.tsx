import Link from "next/link";
import { LEGAL } from "@/lib/legal";

// English terms of service (Thai version: terms-th.tsx). Must be reviewed by a lawyer before launch.
export function TermsEn() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← {LEGAL.serviceName}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Terms of use</h1>
      <p className="mt-1 text-sm text-slate-500">Effective {LEGAL.effectiveDateEn}</p>

      <div className="mt-8 space-y-6 leading-7 text-slate-700 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc">
        <section>
          <h2>1. Using the service</h2>
          <p>
            {LEGAL.serviceName} lets hosts create event pages where guests share and save photos. By using the service you accept
            these terms and the{" "}
            <Link href="/privacy" className="underline">
              privacy policy
            </Link>
            .
          </p>
        </section>
        <section>
          <h2>2. Content you upload</h2>
          <ul>
            <li>You must have the rights to the photos you upload and reasonable permission from the people in them.</li>
            <li>
              Do not upload illegal, obscene or violent content, or content that infringes others&apos; rights. We and the host may
              hide or delete photos without notice.
            </li>
            <li>You keep ownership of your photos and allow us to store, resize and show them to attendees only to provide the service.</li>
          </ul>
        </section>
        <section>
          <h2>3. Hosts and payments</h2>
          <ul>
            <li>Hosts are responsible for their event&apos;s access settings and for moderating its photos.</li>
            <li>Plans are a one-time payment per event; prices and features are those shown on the plan page at checkout.</li>
            <li>Albums close and are deleted at the end of the plan&apos;s period; hosts should download photos before expiry.</li>
          </ul>
        </section>
        <section>
          <h2>4. Limitation of liability</h2>
          <p>
            The service is provided as is. We do our best to keep it available and secure but cannot guarantee it will never be
            interrupted.
          </p>
        </section>
        <section>
          <h2>5. Contact</h2>
          <p>
            <a className="underline" href={`mailto:${LEGAL.contactEmail}`}>
              {LEGAL.contactEmail}
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
