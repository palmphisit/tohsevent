import type { NextRequest } from "next/server";
import { parseObjectId, route } from "@/server/http";
import { cancelDriveExport } from "@/server/services/drive-export";
import { requireEventMember } from "@/server/services/host-events";

/** Stop a transfer (files already in Drive stay there). */
export const DELETE = route(
  async (req: NextRequest, ctx: RouteContext<"/api/v1/host/events/[id]/drive-export/[exportId]">) => {
    const { id, exportId } = await ctx.params;
    const { host, event } = await requireEventMember(req, id);
    await cancelDriveExport(event, host.id, parseObjectId(exportId, "export_not_found"));
    return new Response(null, { status: 204 });
  },
);
