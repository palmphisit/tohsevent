import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins/bearer";
import { ObjectId } from "mongodb";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { database, mongoClient } from "./db";
import { env } from "./env";
import { HttpError } from "./http";

// Host (organizer/photographer) accounts. Guests never sign in; see guest-session.ts.
function createAuth() {
  const e = env();
  return betterAuth({
    appName: "Tohs Event",
    baseURL: e.APP_ORIGIN,
    secret: e.AUTH_SECRET,
    trustedOrigins: [e.APP_ORIGIN, ...e.EXTRA_ORIGINS],
    database: mongodbAdapter(database(), { client: mongoClient() }),
    emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    // bearer: the desktop app sends `Authorization: Bearer <session token>` instead of cookies.
    plugins: [nextCookies(), bearer()],
  });
}

type Auth = ReturnType<typeof createAuth>;
let instance: Auth | undefined;

/** Lazily created so `next build` does not need secrets or a database. */
export function auth(): Auth {
  instance ??= createAuth();
  return instance;
}

export interface Host {
  id: ObjectId;
  name: string;
  email: string;
}

async function hostFromHeaders(requestHeaders: Headers): Promise<Host | null> {
  const session = await auth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  return { id: new ObjectId(session.user.id), name: session.user.name, email: session.user.email };
}

/** For route handlers: the signed-in host, or a 401 error. */
export async function requireHost(req: Request): Promise<Host> {
  const host = await hostFromHeaders(req.headers);
  if (!host) throw new HttpError(401, "unauthenticated", "Sign in required");
  return host;
}

/** For server components: the signed-in host, or a redirect to /login (then back to `nextPath`). */
export async function requireHostPage(nextPath?: string): Promise<Host> {
  const host = await hostFromHeaders(await headers());
  if (!host) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  return host;
}
