import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ORIGIN: z.url(),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB: z.string().min(1),
  R2_ENDPOINT: z.url(),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
  SESSION_SECRET: z.string().min(32),
  AUTH_SECRET: z.string().min(32),
  /** Shared secret Cloud Scheduler sends to /api/internal/*. Internal jobs are disabled when unset. */
  CRON_SECRET: z.string().min(32).optional(),
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
