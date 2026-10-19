import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseJson, route } from "@/server/http";
import { PLAN_TIERS } from "@/server/plans";
import { createUpgradeCheckout } from "@/server/services/billing";
import { requireHostEvent } from "@/server/services/host-events";

const customSchema = z.object({
  maxGuests: z.number().int().positive(),
  maxFiles: z.number().int().positive(),
  storageGB: z.number().int().positive(),
  retentionDays: z.number().int().positive(),
});

const bodySchema = z.discriminatedUnion("tier", [
  z.object({ tier: z.enum(PLAN_TIERS) }),
  z.object({ tier: z.literal("custom"), custom: customSchema }),
]);

/** Starts a Stripe Checkout to upgrade the event's plan; the client redirects to `url`. */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/checkout">) => {
  const { host, event } = await requireHostEvent(req, (await ctx.params).id);
  const body = await parseJson(req, bodySchema);
  return Response.json(await createUpgradeCheckout(host, event, body), { status: 201 });
});
