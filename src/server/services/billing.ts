import { ObjectId } from "mongodb";
import type Stripe from "stripe";
import type { Host } from "../auth";
import { audit } from "../audit";
import { collections, mongoClient } from "../db";
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

/**
 * What this payment's upgrade costs given the plan the event has right now; 0 when it is no
 * longer an upgrade (an equal or bigger package was applied first).
 */
function upgradeCostNowThb(event: EventDoc, payment: Pick<PaymentDoc, "toTier" | "custom">): number {
  const current = planOf(event).tier;
  if (payment.toTier === "custom") {
    // Never shrink: a later, bigger Custom purchase may have been applied first.
    if (current === "custom" && !coversConfig(payment.custom!, event.plan!.custom!)) return 0;
    return Math.max(0, quoteCustomPlan(payment.custom!).totalThb - (current === "free" ? 0 : paidSoFarThb(event)));
  }
  // Never downgrade if a later, higher upgrade was applied first.
  if (planRank(payment.toTier) <= planRank(current)) return 0;
  return upgradePriceThb(current as FixedTier, payment.toTier as FixedTier);
}

/**
 * Expires the event's other open checkouts so a host cannot pay twice for overlapping upgrades.
 * A checkout that is already complete (e.g. a PromptPay QR awaiting payment) cannot be expired;
 * if it gets paid later, fulfilment refunds whatever it no longer covers.
 */
async function expireOpenCheckouts(client: Stripe, eventId: ObjectId): Promise<void> {
  const { payments } = await collections();
  const open = await payments.find({ eventId, status: "pending", stripeSessionId: { $type: "string" } }).toArray();
  await Promise.all(
    open.map(async (payment) => {
      try {
        await client.checkout.sessions.expire(payment.stripeSessionId!);
        await payments.updateOne({ _id: payment._id, status: "pending" }, { $set: { status: "expired" } });
      } catch {
        // Already complete or expired: its webhook settles the payment.
      }
    }),
  );
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

  await expireOpenCheckouts(client, event._id);

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
  let session: Stripe.Checkout.Session;
  try {
    session = await client.checkout.sessions.create(
      {
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
        // Discount codes are created as promotion codes in the Stripe Dashboard and entered on the Checkout page.
        allow_promotion_codes: true,
        customer_email: host.email,
        client_reference_id: payment._id.toHexString(),
        metadata: { paymentId: payment._id.toHexString(), eventId: event._id.toHexString(), toTier },
        locale: "th",
        success_url: `${eventUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${eventUrl}?checkout=cancelled`,
      },
      // A network retry must not open a second checkout for the same payment.
      { idempotencyKey: `checkout-${payment._id.toHexString()}` },
    );
  } catch (error) {
    await payments.updateOne({ _id: payment._id }, { $set: { status: "failed" } });
    throw error;
  }
  await payments.updateOne({ _id: payment._id }, { $set: { stripeSessionId: session.id } });

  if (!session.url) throw new HttpError(502, "checkout_unavailable");
  return { url: session.url };
}

const intentId = (value: string | { id: string } | null | undefined): string | null =>
  typeof value === "string" ? value : (value?.id ?? null);

/** Gives back the payment's automatic refund once (safe to retry: Stripe idempotency + stored refund id). */
async function issueAutoRefund(payment: PaymentDoc): Promise<void> {
  const refund = payment.autoRefund;
  if (!refund || refund.stripeRefundId || refund.thb <= 0) return;
  const client = stripe();
  if (!client || !payment.stripePaymentIntentId) throw new Error(`cannot refund payment ${payment._id.toHexString()}`);
  const created = await client.refunds.create(
    {
      payment_intent: payment.stripePaymentIntentId,
      amount: refund.thb * 100,
      metadata: { paymentId: payment._id.toHexString(), reason: refund.reason },
    },
    { idempotencyKey: `auto-refund-${payment._id.toHexString()}` },
  );
  const { payments } = await collections();
  await payments.updateOne(
    { _id: payment._id },
    {
      $set: { "autoRefund.stripeRefundId": created.id, ...(refund.thb >= (payment.paidThb ?? payment.amountThb) ? { status: "refunded" } : {}) },
      $max: { refundedThb: refund.thb },
    },
  );
  await audit({
    eventId: payment.eventId,
    actor: { type: "system", id: "stripe" },
    action: "payment.auto_refund",
    target: payment._id,
    meta: { amountThb: refund.thb, reason: refund.reason, refundId: created.id },
  });
}

/**
 * Applies a paid checkout to its event. Safe to call many times (webhook retries,
 * success-page reconciliation): only the first call for a payment changes anything.
 * Marking the payment paid and upgrading the event happen in one transaction, so a failure
 * part-way leaves the payment pending and the next retry applies it.
 */
export async function fulfillCheckoutSession(session: Stripe.Checkout.Session): Promise<"applied" | "ignored"> {
  // "no_payment_required": a discount code brought the total to ฿0.
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return "ignored";
  const paymentId = session.metadata?.paymentId;
  if (!paymentId || !ObjectId.isValid(paymentId)) return "ignored";

  const { payments, events } = await collections();
  const existing = await payments.findOne({ _id: new ObjectId(paymentId) });
  if (!existing) return "ignored";
  if (existing.status !== "pending") {
    // Already applied; finish a refund that failed after the plan update committed.
    await issueAutoRefund(existing);
    return "ignored";
  }
  const subtotal = session.amount_subtotal ?? -1;
  const total = session.amount_total ?? -1;
  // The list price must match; a discount code may only lower what was paid.
  if (session.currency !== "thb" || subtotal !== existing.amountThb * 100 || total < 0 || total > subtotal) {
    console.error("stripe checkout amount mismatch", paymentId, session.id, session.currency, session.amount_total);
    await audit({
      eventId: existing.eventId,
      actor: { type: "system", id: "stripe" },
      action: "payment.amount_mismatch",
      target: existing._id,
      meta: { expectedThb: existing.amountThb, currency: session.currency, amountSubtotal: subtotal, amountTotal: total, sessionId: session.id },
    });
    return "ignored";
  }

  const paidThb = total / 100;
  const discountThb = (subtotal - total) / 100;
  const promotionCode = session.discounts?.[0]?.promotion_code;
  const now = new Date();
  const result = await mongoClient().withSession((dbSession) =>
    dbSession.withTransaction(async () => {
      const payment = await payments.findOneAndUpdate(
        { _id: existing._id, status: "pending" },
        {
          $set: {
            status: "paid",
            paidAt: now,
            stripeSessionId: session.id,
            stripePaymentIntentId: intentId(session.payment_intent),
            paidThb,
            ...(discountThb > 0 ? { discount: { thb: discountThb, promotionCodeId: intentId(promotionCode) } } : {}),
          },
        },
        { returnDocument: "after", session: dbSession },
      );
      if (!payment) return null; // applied by a concurrent call

      const event = await events.findOne({ _id: payment.eventId }, { session: dbSession });
      // A deleted album gains nothing from an upgrade: give the money back.
      const costThb = event && !event.purgedAt ? upgradeCostNowThb(event, payment) : 0;
      // Give back the share of what was paid that the upgrade no longer covers (keeps a discount's ratio).
      const refundThb = costThb >= payment.amountThb ? 0 : Math.round((paidThb * (payment.amountThb - costThb)) / payment.amountThb);
      if (refundThb > 0) {
        payment.autoRefund = { thb: refundThb, reason: costThb > 0 ? "price_changed" : "superseded", stripeRefundId: null };
        await payments.updateOne({ _id: payment._id }, { $set: { autoRefund: payment.autoRefund } }, { session: dbSession });
      }
      if (!event || costThb <= 0) return { payment, event, applied: false };

      const plan = payment.toTier === "custom" ? customPlan(payment.custom!) : PLANS[payment.toTier];
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
        { session: dbSession },
      );
      return { payment, event, applied: true };
    }),
  );
  if (!result) return "ignored";

  const { payment, event, applied } = result;
  if (applied && event) {
    await audit({
      eventId: event._id,
      actor: { type: "system", id: "stripe" },
      action: "plan.upgrade",
      target: payment._id,
      meta: { fromTier: planOf(event).tier, toTier: payment.toTier, amountThb: payment.amountThb, paidThb, discountThb },
    });
  }
  await issueAutoRefund(payment);
  return applied ? "applied" : "ignored";
}

async function markPayment(session: Stripe.Checkout.Session, status: "failed" | "expired") {
  const { payments } = await collections();
  await payments.updateOne({ stripeSessionId: session.id, status: "pending" }, { $set: { status } });
}

/** The payment behind a PaymentIntent (older payments only know their Checkout Session). */
async function paymentForIntent(client: Stripe, paymentIntent: string | { id: string } | null): Promise<PaymentDoc | null> {
  const id = intentId(paymentIntent);
  if (!id) return null;
  const { payments } = await collections();
  const payment = await payments.findOne({ stripePaymentIntentId: id });
  if (payment) return payment;
  const [session] = (await client.checkout.sessions.list({ payment_intent: id, limit: 1 })).data;
  if (!session) return null;
  return payments.findOneAndUpdate({ stripeSessionId: session.id }, { $set: { stripePaymentIntentId: id } }, { returnDocument: "after" });
}

/**
 * Refunds made anywhere (our automatic ones or from the Stripe Dashboard) are recorded on the
 * payment and in the audit log. The event keeps its package: taking it back is a manual decision.
 */
async function recordRefund(client: Stripe, charge: Stripe.Charge) {
  const payment = await paymentForIntent(client, charge.payment_intent);
  if (!payment) return;
  const refundedThb = charge.amount_refunded / 100;
  const { payments } = await collections();
  await payments.updateOne(
    { _id: payment._id },
    { $set: { refundedThb, ...(charge.refunded && payment.status === "paid" ? { status: "refunded" } : {}) } },
  );
  await audit({
    eventId: payment.eventId,
    actor: { type: "system", id: "stripe" },
    action: "payment.refunded",
    target: payment._id,
    meta: { refundedThb, full: charge.refunded, chargeId: charge.id },
  });
}

/** Disputes need an answer in the Stripe Dashboard before the deadline, so they are logged as errors too. */
async function recordDispute(client: Stripe, dispute: Stripe.Dispute) {
  const payment = await paymentForIntent(client, dispute.payment_intent);
  console.error("stripe dispute", dispute.id, dispute.status, dispute.reason, payment?._id.toHexString() ?? "unknown payment");
  if (!payment) return;
  const { payments } = await collections();
  const amountThb = dispute.amount / 100;
  await payments.updateOne(
    { _id: payment._id },
    { $set: { dispute: { id: dispute.id, status: dispute.status, reason: dispute.reason, amountThb, updatedAt: new Date() } } },
  );
  await audit({
    eventId: payment.eventId,
    actor: { type: "system", id: "stripe" },
    action: "payment.dispute",
    target: payment._id,
    meta: { disputeId: dispute.id, status: dispute.status, reason: dispute.reason, amountThb },
  });
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
    case "charge.refunded":
      await recordRefund(client, event.data.object);
      break;
    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed":
      await recordDispute(client, event.data.object);
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
  try {
    await fulfillCheckoutSession(session);
  } catch (error) {
    // The webhook retries; the page still shows what is known.
    console.error("checkout reconcile failed", sessionId, error);
  }
  const { payments } = await collections();
  const payment = await payments.findOne({ stripeSessionId: session.id, eventId: event._id });
  return payment?.status ?? null;
}
