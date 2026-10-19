import type { NextRequest } from "next/server";
import { parseObjectId, route } from "@/server/http";
import { runDriveExportStep } from "@/server/services/drive-export";
import { requireEventMember } from "@/server/services/host-events";

/** Send the next batch of files (~40 s of work); the dashboard calls this until done. */
export const POST = route(
  async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/drive-export/[exportId]/step">) => {
    const { id, exportId } = await ctx.params;
    const { host, event } = await requireEventMember(req, id);
    const job = await runDriveExportStep(event, host.id, parseObjectId(exportId, "export_not_found"));
    return Response.json({ export: job });
  },
);
