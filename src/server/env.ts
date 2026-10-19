import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ORIGIN: z.url(),
  /**
   * Other origins that serve the same app (comma-separated), e.g. the run.app URL while
   * moving to a custom domain. Sign-in from them is accepted; links and QR codes use APP_ORIGIN.
   */
  EXTRA_ORIGINS: z
    .string()
    .default("")
    .transform((v) => v.split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean))
    .pipe(z.array(z.url())),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB: z.string().min(1),
  R2_ENDPOINT: z.url(),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
  /** Private bucket for full-resolution originals (no public access). Originals are disabled when unset. */
  R2_ORIGINALS_BUCKET: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(32),
  AUTH_SECRET: z.string().min(32),
  /** Shared secret Cloud Scheduler sends to /api/internal/*. Internal jobs are disabled when unset. */
  CRON_SECRET: z.string().min(32).optional(),
  /**
   * Stripe secret or restricted key (sk_test_... / sk_live_... / rk_live_...). A restricted key needs
   * Checkout Sessions and Refunds write. Paid upgrades are disabled when unset.
   */
  STRIPE_SECRET_KEY: z.string().regex(/^(sk|rk)_/).optional(),
  /** Signing secret of the Stripe webhook endpoint (whsec_...). */
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  /** "vision" = hide photos Google Cloud Vision SafeSearch flags until the host reviews them. */
  AUTO_MODERATION: z.enum(["off", "vision"]).default("off"),
  /** Google OAuth web client (Sign in with Google + Drive transfer). Both hidden when unset. */
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  /** Google API host; overridden only by local tests that run a stand-in Drive. */
  GOOGLE_API_BASE: z.url().default("https://www.googleapis.com"),
  /** ffmpeg binary used to cut video poster frames (installed in the Docker image). */
  FFMPEG_PATH: z.string().default("ffmpeg"),
  /** Resend API key (re_...). Email features (tickets, guest notifications, expiry reminders) are off when unset. */
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
  EMAIL_FROM: z.string().default("Tohs Event <noreply@tohsevent.com>"),
  /** Overridable for local testing against a mock. */
  RESEND_API_BASE: z.url().default("https://api.resend.com"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/**
 * Validated server environment. Read lazily (not at module load) so `next build`
 * works without secrets and one Docker image can be promoted across environments.
 */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
    }
    cached = parsed.data;
  }
  return cached;
}
