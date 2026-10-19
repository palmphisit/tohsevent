import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireCheckinAccess } from "@/server/checkin-access";
import { parseJson, route } from "@/server/http";
import { registerSchema } from "@/server/schemas/registration";
import { requireOpenEventBySlug } from "@/server/services/events";
import { register, toHostRegistration } from "@/server/services/registration";

const body = registerSchema.extend({ key: z.string().max(64).optional() });

/** Staff sign a walk-in guest up at the door; they are checked in immediately. */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/events/[slug]/checkin/walk-in">) => {
  const event = await requireOpenEventBySlug((await ctx.params).slug);
  const { key, ...input } = await parseJson(req, body);
  const by = await requireCheckinAccess(req, event, key);
  const reg = await register(event, input, { source: "onsite", checkedInBy: by });
  return Response.json({ registration: toHostRegistration(reg) }, { status: 201 });
});
