import { ObjectId } from "mongodb";
import type Stripe from "stripe";
import type { Host } from "../auth";
import { audit } from "../audit";
import { collections } from "../db";
import { env } from "../env";
import { HttpError } from "../http";
import { planOf, type EventDoc, type PaymentDoc } from "../models";
import { coversConfig, normalizeCustomConfig, quoteCustomPlan, type CustomPlanConfig } from "../../lib/custom-plan";
import { customPlan, expiryFor, PLANS, planRank, upgradePriceThb, type FixedTier } from "../plans";
import { stripe } from "../stripe";

// Pay-per-event upgrades through Stripe Checkout (card / PromptPay, THB).
// The webhook is the source of truth; the success page also reconciles in case it is late.

export function paymentsEnabled(): boolean {
  return stripe() !== null;
}

export type UpgradeRequest = { tier: FixedTier } | { tier: "custom"; custom: CustomPlanConfig };

/** What the event's current package cost (for paying only the difference). */
function paidSoFarThb(event: EventDoc): number {
  const plan = planOf(event);
  if (plan.tier === "custom") return quoteCustomPlan(event.plan!.custom!).totalThb;
  return PLANS[plan.tier as FixedTier].priceThb;
}

export async function createUpgradeCheckout(host: Host, event: EventDoc, request: UpgradeRequest): Promise<{ url: string }> {
  const client = stripe();
  if (!client) throw new HttpError(503, "payments_disabled", "Payments are not available yet");

  const fromTier = planOf(event).tier;
  const toTier = request.tier;
  const custom = request.tier === "custom" ? normalizeCustomConfig(request.custom) : undefined;
  if (custom && fromTier === "custom") {
    // A bigger Custom package: every limit must stay the same or grow.
    if (!coversConfig(custom, event.plan!.custom!)) {
      throw new HttpError(400, "not_an_upgrade", "A new Custom package cannot be smaller than the current one");
    }
  } else if (planRank(toTier) <= planRank(fromTier)) {
    throw new HttpError(400, "not_an_upgrade", "Choose a higher plan than the current one");
  }
  if (event.purgedAt) throw new HttpError(409, "event_purged", "This album has already been deleted");

  const amountThb = custom
    ? quoteCustomPlan(custom).totalThb - (fromTier === "free" ? 0 : paidSoFarThb(event))
    : upgradePriceThb(fromTier as FixedTier, toTier as FixedTier);
  if (amountThb <= 0) throw new HttpError(400, "not_an_upgrade", "Nothing to pay for this change");
  const { payments } = await collections();
  const payment: PaymentDoc = {
    _id: new ObjectId(),
    eventId: event._id,
    ownerId: host.id,
    fromTier,
    toTier,
    ...(custom ? { custom } : {}),
    amountThb,
    provider: "stripe",
    stripeSessionId: null,
    status: "pending",
    createdAt: new Date(),
    paidAt: null,
  };
  await payments.insertOne(payment);

  const origin = env().APP_ORIGIN;
  const eventUrl = `${origin}/dashboard/events/${event._id.toHexString()}/plan`;
  const session = await client.checkout.sessions.create({
    mode: "payment",
    // Payment methods (card, PromptPay) come from the Stripe Dashboard settings.
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "thb",
          unit_amount: amountThb * 100,
          product_data: {
            name: custom
              ? `Tohs Event Custom · แขก ${custom.maxGuests.toLocaleString("th-TH")} · ${custom.maxFiles.toLocaleString("th-TH")} ไฟล์ · ${custom.storageGB} GB · ${custom.retentionDays} วัน`
              : `Tohs Event ${PLANS[toTier as FixedTier].name}`,
            description: fromTier === "free" ? event.title : `${event.title} (อัปเกรดจาก ${planOf(event).name})`,
          },
        },
      },
    ],
    customer_email: host.email,
    client_reference_id: payment._id.toHexString(),
    metadata: { paymentId: payment._id.toHexString(), eventId: event._id.toHexString(), toTier },
    locale: "th",
    success_url: `${eventUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${eventUrl}?checkout=cancelled`,
  });
  await payments.updateOne({ _id: payment._id }, { $set: { stripeSessionId: session.id } });

  if (!session.url) throw new HttpError(502, "checkout_unavailable");
  return { url: session.url };
}

/**
 * Applies a paid checkout to its event. Safe to call many times (webhook retries,
 * success-page reconciliation): only the first call for a payment changes anything.
 */
export async function fulfillCheckoutSession(session: Stripe.Checkout.Session): Promise<"applied" | "ignored"> {
  if (session.payment_status !== "paid") return "ignored";
  const paymentId = session.metadata?.paymentId;
  if (!paymentId || !ObjectId.isValid(paymentId)) return "ignored";

  const { payments, events } = await collections();
  const now = new Date();
  const payment = await payments.findOneAndUpdate(
    { _id: new ObjectId(paymentId), status: "pending" },
    { $set: { status: "paid", paidAt: now, stripeSessionId: session.id } },
    { returnDocument: "after" },
  );
  if (!payment) return "ignored"; // already applied (or unknown)

  const event = await events.findOne({ _id: payment.eventId });
  if (!event) return "ignored";
  const current = planOf(event).tier;
  if (payment.toTier === "custom") {
    // Never shrink: a later, bigger Custom purchase may have been applied first.
    if (current === "custom" && event.plan?.custom && !coversConfig(payment.custom!, event.plan.custom)) return "applied";
  } else if (planRank(payment.toTier) <= planRank(current)) {
    // Never downgrade if a later, higher upgrade was applied first.
    return "applied";
  }

  const plan = payment.toTier === "custom" ? customPlan(payment.custom!) : PLANS[payment.toTier];
  await audit({
    eventId: event._id,
    actor: { type: "system", id: "stripe" },
    action: "plan.upgrade",
    target: payment._id,
    meta: { fromTier: payment.fromTier, toTier: payment.toTier, amountThb: payment.amountThb },
  });
  await events.updateOne(
    { _id: event._id },
    {
      $set: {
        plan: { tier: plan.tier, upgradedAt: now, ...(payment.custom ? { custom: payment.custom } : {}) },
        "settings.maxPhotosPerGuest": plan.maxPhotosPerGuest,
        expiresAt: expiryFor(event.date, plan.retentionDays, now),
        // An album that expired but has not been purged yet reopens after upgrading.
        ...(event.status === "expired" && !event.purgedAt ? { status: "live" } : {}),
        updatedAt: now,
      },
    },
  );
  return "applied";
}

async function markPayment(session: Stripe.Checkout.Session, status: "failed" | "expired") {
  const { payments } = await collections();
  await payments.updateOne({ stripeSessionId: session.id, status: "pending" }, { $set: { status } });
}

/** Verifies and handles a Stripe webhook delivery. */
export async function handleStripeWebhook(rawBody: string, signature: string | null): Promise<void> {
  const client = stripe();
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!client || !secret) throw new HttpError(503, "payments_disabled");
  if (!signature) throw new HttpError(400, "missing_signature");

  let event: Stripe.Event;
  try {
    event = client.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    throw new HttpError(400, "invalid_signature");
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await fulfillCheckoutSession(event.data.object);
      break;
    case "checkout.session.async_payment_failed":
      await markPayment(event.data.object, "failed");
      break;
    case "checkout.session.expired":
      await markPayment(event.data.object, "expired");
      break;
  }
}

/**
 * Success-page reconciliation: look the session up directly in case the webhook is late.
 * Returns the payment status of that checkout for this event.
 */
export async function reconcileCheckout(event: EventDoc, sessionId: string): Promise<PaymentDoc["status"] | null> {
  const client = stripe();
  if (!client || !sessionId.startsWith("cs_")) return null;
  const session = await client.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.eventId !== event._id.toHexString()) return null;
  await fulfillCheckoutSession(session);
  const { payments } = await collections();
  const payment = await payments.findOne({ stripeSessionId: session.id, eventId: event._id });
  return payment?.status ?? null;
}
