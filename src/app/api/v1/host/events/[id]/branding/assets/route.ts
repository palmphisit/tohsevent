import type { NextRequest } from "next/server";
import { parseJson, route } from "@/server/http";
import { brandingAssetSchema } from "@/server/schemas/branding";
import { createBrandingAssetUpload } from "@/server/services/branding";
import { requireHostEvent } from "@/server/services/host-events";

/** Presigned upload for a logo, cover or sponsor image (Premium only). */
export const POST = route(
  async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/branding/assets">) => {
    const { event } = await requireHostEvent(req, (await ctx.params).id);
    const input = await parseJson(req, brandingAssetSchema);
    return Response.json(await createBrandingAssetUpload(event, input), { status: 201 });
  },
);
