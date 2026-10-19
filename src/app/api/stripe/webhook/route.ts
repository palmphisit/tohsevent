import { route } from "@/server/http";
import { handleStripeWebhook } from "@/server/services/billing";

/** Stripe webhook endpoint (checkout.session.*, charge.refunded, charge.dispute.* events). The raw body is needed for signature checks. */
export const POST = route(async (req: Request) => {
  await handleStripeWebhook(await req.text(), req.headers.get("stripe-signature"));
  return Response.json({ received: true });
});
