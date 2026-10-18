import { timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";
import { HttpError, route } from "@/server/http";
import { runDailyCleanup } from "@/server/services/maintenance";

function authorized(req: Request, secret: string): boolean {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Daily housekeeping, called by Cloud Scheduler with `Authorization: Bearer <CRON_SECRET>`. */
export const POST = route(async (req: Request) => {
  const secret = env().CRON_SECRET;
  if (!secret) throw new HttpError(503, "cron_not_configured", "CRON_SECRET is not set");
  if (!authorized(req, secret)) throw new HttpError(401, "unauthorized");

  const result = await runDailyCleanup();
  console.log("daily cleanup", JSON.stringify(result));
  return Response.json(result);
});
