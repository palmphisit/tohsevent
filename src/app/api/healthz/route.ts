import { connection } from "next/server";
import { getDb } from "@/server/db";

// Liveness/readiness probe for Cloud Run: verifies the MongoDB connection.
export async function GET() {
  await connection();
  try {
    await (await getDb()).command({ ping: 1 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("healthz: mongo ping failed", error);
    return Response.json({ ok: false }, { status: 503 });
  }
}
