import type { NextRequest } from "next/server";
import { z } from "zod";
import { audit } from "@/server/audit";
import { driveConnected, googleEnabled } from "@/server/google";
import { parseJson, route } from "@/server/http";
import { latestDriveExport, startDriveExport } from "@/server/services/drive-export";
import { requireEventMember } from "@/server/services/host-events";

/** Google Drive status for this user plus their latest transfer of this album. */
export const GET = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/drive-export">) => {
  const { host, event } = await requireEventMember(req, (await ctx.params).id);
  return Response.json({
    google: { enabled: googleEnabled(), connected: await driveConnected(host.id) },
    export: await latestDriveExport(event, host.id),
  });
});

const startSchema = z.object({
  sources: z.array(z.enum(["guest", "official"])).min(1).max(2),
});

/** Start a transfer to the user's Google Drive (or resume their unfinished one). */
export const POST = route(async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/drive-export">) => {
  const { host, event } = await requireEventMember(req, (await ctx.params).id);
  const { sources } = await parseJson(req, startSchema);
  const job = await startDriveExport(event, host.id, [...new Set(sources)]);
  await audit({ eventId: event._id, actor: { type: "host", id: host.id }, action: "drive_export.start" });
  return Response.json({ export: job });
});
