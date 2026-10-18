import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, route } from "@/server/http";
import { qrPng, qrSvg } from "@/server/qr";
import { guestEventUrl, requireEventMember } from "@/server/services/host-events";

const querySchema = z.object({
  format: z.enum(["png", "svg"]).default("png"),
  size: z.coerce.number().int().min(128).max(4096).default(1024),
});

/** Downloadable QR code that opens the guest page of the event. */
export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/qr">) => {
  const { event } = await requireEventMember(req, (await ctx.params).id);

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) throw new HttpError(400, "invalid_query", z.prettifyError(parsed.error));
  const { format, size } = parsed.data;

  const url = guestEventUrl(event.slug);
  const filename = `tohsevent-${event.slug}-qr.${format}`;
  const headers = { "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, max-age=300" };

  if (format === "svg") {
    return new Response(await qrSvg(url), { headers: { ...headers, "Content-Type": "image/svg+xml" } });
  }
  return new Response(new Uint8Array(await qrPng(url, size)), { headers: { ...headers, "Content-Type": "image/png" } });
});
