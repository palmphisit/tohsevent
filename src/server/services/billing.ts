import { ObjectId } from "mongodb";
import type Stripe from "stripe";
import type { Host } from "../auth";
import { collections } from "../db";
import { env } from "../env";
import { HttpError } from "../http";
import { planOf, type EventDoc, type PaymentDoc } from "../models";
import { expiryFor, PLANS, planRank, upgradePriceThb, type PlanTier } from "../plans";
import { stripe } from "../stripe";

// Pay-per-event upgrades through Stripe Checkout (card / PromptPay, THB).
// The webhook is the source of truth; the success page also reconciles in case it is late.

export function paymentsEnabled(): boolean {
  return stripe() !== null;
}

export async function createUpgradeCheckout(host: Host, event: EventDoc, toTier: PlanTier): Promise<{ url: string }> {
  const client = stripe();
  if (!client) throw new HttpError(503, "payments_disabled", "Payments are not available yet");

  const fromTier = planOf(event).tier;
  if (planRank(toTier) <= planRank(fromTier)) {
    throw new HttpError(400, "not_an_upgrade", "Choose a higher plan than the current one");
  }
  if (event.purgedAt) throw new HttpError(409, "event_purged", "This album has already been deleted");

  const amountThb = upgradePriceThb(fromTier, toTier);
  const { payments } = await collections();
  const payment: PaymentDoc = {
    _id: new ObjectId(),
    eventId: event._id,
    ownerId: host.id,
    fromTier,
    toTier,
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
            name: `Tohs Event ${PLANS[toTier].name}`,
            description: fromTier === "free" ? event.title : `${event.title} (อัปเกรดจาก ${PLANS[fromTier].name})`,
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
  // Never downgrade if a later, higher upgrade was applied first.
  if (planRank(payment.toTier) <= planRank(planOf(event).tier)) return "applied";

  const plan = PLANS[payment.toTier];
  await events.updateOne(
    { _id: event._id },
    {
      $set: {
        plan: { tier: plan.tier, upgradedAt: now },
        "settings.maxPhotosPerGuest": plan.maxPhotosPerGuest,
        expiresAt: expiryFor(event.date, plan.tier, now),
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
