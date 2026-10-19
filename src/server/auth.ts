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
    ...(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
      ? {
          socialProviders: {
            google: {
              clientId: e.GOOGLE_CLIENT_ID,
              clientSecret: e.GOOGLE_CLIENT_SECRET,
              // Offline access + consent so Google returns a refresh token: Drive transfers run
              // for a long time and need to renew the access token.
              accessType: "offline",
              prompt: "select_account consent",
            },
          },
        }
      : {}),
    account: {
      // Google refresh tokens grant Drive access: never store them in plain text.
      encryptOAuthTokens: true,
      accountLinking: {
        // A Google sign-in joins an existing account with the same (Google-verified) email only
        // when that account's email is verified too; password accounts link Google explicitly
        // from the dashboard instead (Better Auth default, guards against pre-registration takeover).
        trustedProviders: ["google"],
        // Linking is explicit and signed-in: the Drive account may be a different Gmail.
        allowDifferentEmails: true,
      },
    },
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

/** For route handlers that also accept other credentials: the signed-in host, if any. */
export function optionalHost(req: Request): Promise<Host | null> {
  return hostFromHeaders(req.headers);
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
