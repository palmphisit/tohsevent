import { env } from "./env";

// Transactional email through Resend's HTTP API (no SDK). Disabled unless
// RESEND_API_KEY is set; callers check emailEnabled() and hide the features otherwise.

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const BATCH_LIMIT = 100;

export function emailEnabled(): boolean {
  return !!env().RESEND_API_KEY;
}

/** Sends messages in batches of 100. Returns how many were accepted. */
export async function sendEmails(messages: EmailMessage[]): Promise<number> {
  const { RESEND_API_KEY, EMAIL_FROM } = env();
  if (!RESEND_API_KEY || messages.length === 0) return 0;

  let sent = 0;
  for (let i = 0; i < messages.length; i += BATCH_LIMIT) {
    const batch = messages.slice(i, i + BATCH_LIMIT).map((m) => ({ from: EMAIL_FROM, ...m }));
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`resend: HTTP ${res.status} ${await res.text()}`);
    sent += batch.length;
  }
  return sent;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Minimal branded layout shared by all emails. */
export function emailLayout(bodyHtml: string, footerHtml = ""): string {
  return `<!doctype html><html lang="th"><body style="margin:0;background:#f4f4f5;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#18181b">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-weight:600;margin:0 0 20px">Tohs Event</p>
<div style="background:#fff;border-radius:16px;padding:24px;line-height:1.6">${bodyHtml}</div>
<p style="font-size:12px;color:#71717a;margin-top:16px">${footerHtml}</p>
</div></body></html>`;
}
