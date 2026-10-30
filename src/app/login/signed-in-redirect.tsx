import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { safeNext } from "./safe-next";

/**
 * The sign-in page for someone who is already signed in: go straight to where they were
 * heading (or the dashboard) instead of asking them to sign in again.
 */
export async function SignedInRedirect({
  searchParams,
  children,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
  children: React.ReactNode;
}) {
  // Request data first: it makes the page dynamic before auth() reads env/secrets (none exist at build time).
  const [{ next }, requestHeaders] = await Promise.all([searchParams, headers()]);
  const session = await auth().api.getSession({ headers: requestHeaders });
  if (session) redirect(safeNext(typeof next === "string" ? next : null));
  return children;
}
