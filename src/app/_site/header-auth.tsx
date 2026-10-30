"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";

/**
 * Header buttons of the public site. The page is static, so it renders the signed-out
 * buttons first and switches to "Dashboard" once the browser reports a session.
 */
export function HeaderAuth({
  signInHref,
  startHref,
  labels,
}: {
  signInHref: string;
  startHref: string;
  labels: { signIn: string; startFree: string; dashboard: string; newEvent: string };
}) {
  const { data } = authClient.useSession();
  const signedIn = !!data?.session;
  return (
    <>
      <Link
        href={signedIn ? "/dashboard" : signInHref}
        className="hidden rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 sm:block"
      >
        {signedIn ? labels.dashboard : labels.signIn}
      </Link>
      <Link
        href={signedIn ? "/dashboard/events/new" : startHref}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
      >
        {signedIn ? labels.newEvent : labels.startFree}
      </Link>
    </>
  );
}
