import type { NextRequest } from "next/server";
import { parseJson, route } from "@/server/http";
import { uploadRequestSchema } from "@/server/schemas/uploads";
import { requireEventMember } from "@/server/services/host-events";
import { createOfficialUploads } from "@/server/services/photos";

/** Step 1 of the official (host) upload flow; same presigned flow as guests. */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/uploads">) => {
  const { host, event } = await requireEventMember(req, (await ctx.params).id);
  const { files } = await parseJson(req, uploadRequestSchema);
  const uploads = await createOfficialUploads(event, host, files);
  return Response.json({ uploads }, { status: 201 });
});
