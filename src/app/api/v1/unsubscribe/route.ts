import type { NextRequest } from "next/server";
import { unsubscribeWithToken } from "@/server/services/notifications";

const MESSAGES = {
  en: { ok: "You've been unsubscribed from email notifications.", bad: "This link is invalid or has expired." },
  th: { ok: "ยกเลิกการแจ้งเตือนทางอีเมลเรียบร้อยแล้ว", bad: "ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว" },
};

/** One-click unsubscribe from the link in guest emails. */
export async function GET(req: NextRequest) {
  const ok = await unsubscribeWithToken(req.nextUrl.searchParams.get("token") ?? "");
  const lang = req.nextUrl.searchParams.get("lang") === "en" ? "en" : "th";
  const message = MESSAGES[lang][ok ? "ok" : "bad"];
  return new Response(
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tohs Event</title></head>
<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#18181b"><p>${message}</p></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
