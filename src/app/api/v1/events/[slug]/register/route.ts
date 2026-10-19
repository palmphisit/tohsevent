import type { NextRequest } from "next/server";
import { verifyEventKey } from "@/server/event-keys";
import { parseJson, route } from "@/server/http";
import { registerSchema } from "@/server/schemas/registration";
import { requireOpenEventBySlug } from "@/server/services/events";
import { register, ticketUrl } from "@/server/services/registration";

/**
 * Guest sign-up from the event page. With the on-site poster's key (`onsite`), the guest is
 * signed up and checked in at once (walk-in); otherwise it is an online registration.
 */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/register">) => {
  const event = await requireOpenEventBySlug((await ctx.params).slug);
  const onsite = verifyEventKey(event, "onsite", req.nextUrl.searchParams.get("onsite"));
  const input = await parseJson(req, registerSchema);
  const reg = await register(event, input, { source: onsite ? "onsite" : "online", checkedInBy: "self" });
  return Response.json(
    { code: reg.code, ticketUrl: ticketUrl(event, reg.code), checkedInAt: reg.checkedInAt?.toISOString() ?? null },
    { status: 201 },
  );
});
