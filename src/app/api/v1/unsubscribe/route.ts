import type { NextRequest } from "next/server";
import { unsubscribeWithToken } from "@/server/services/notifications";

/** One-click unsubscribe from the link in guest emails. */
export async function GET(req: NextRequest) {
  const ok = await unsubscribeWithToken(req.nextUrl.searchParams.get("token") ?? "");
  const message = ok ? "ยกเลิกการแจ้งเตือนทางอีเมลเรียบร้อยแล้ว" : "ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว";
  return new Response(
    `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tohs Event</title></head>
<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#18181b"><p>${message}</p></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
