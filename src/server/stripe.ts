import Stripe from "stripe";
import { env } from "./env";

let client: Stripe | undefined;

/** Stripe client, or null when payments are not configured for this environment. */
export function stripe(): Stripe | null {
  const key = env().STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key, { appInfo: { name: "Tohs Event" } });
  return client;
}
