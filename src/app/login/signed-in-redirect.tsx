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
  const [{ next }, session] = await Promise.all([searchParams, auth().api.getSession({ headers: await headers() })]);
  if (session) redirect(safeNext(typeof next === "string" ? next : null));
  return children;
}
