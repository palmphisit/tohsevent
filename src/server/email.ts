import { env } from "./env";

// Transactional email through Resend's HTTP API (no SDK). Disabled unless
// RESEND_API_KEY is set; callers check emailEnabled() and hide the features otherwise.

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  /** Referenced from the HTML as `cid:<contentId>` (inline image). */
  contentId?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

const BATCH_LIMIT = 100;

export function emailEnabled(): boolean {
  return !!env().RESEND_API_KEY;
}

async function post(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${env().RESEND_API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env().RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`resend: HTTP ${res.status} ${await res.text()}`);
}

function payload({ attachments, ...message }: EmailMessage) {
  return {
    from: env().EMAIL_FROM,
    ...message,
    ...(attachments?.length
      ? {
          attachments: attachments.map((a) => ({
            filename: a.filename,
            content: a.content.toString("base64"),
            ...(a.contentId ? { content_id: a.contentId } : {}),
          })),
        }
      : {}),
  };
}

/** One message; supports attachments (the batch endpoint does not). */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  if (!emailEnabled()) return false;
  await post("/emails", payload(message));
  return true;
}

/** Sends messages in batches of 100. Returns how many were accepted. */
export async function sendEmails(messages: EmailMessage[]): Promise<number> {
  if (!emailEnabled() || messages.length === 0) return 0;
  let sent = 0;
  for (let i = 0; i < messages.length; i += BATCH_LIMIT) {
    const batch = messages.slice(i, i + BATCH_LIMIT);
    await post("/emails/batch", batch.map(payload));
    sent += batch.length;
  }
  return sent;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** A call-to-action link styled as a button (works in Gmail/Outlook). */
export function emailButton(href: string, label: string, color = "#2563eb"): string {
  return `<a href="${href}" style="display:inline-block;background:${color};color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">${escapeHtml(label)}</a>`;
}

/** Minimal branded layout shared by all emails. */
export function emailLayout(bodyHtml: string, footerHtml = "", lang: "en" | "th" = "th"): string {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f1f5f9;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#18181b">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-weight:700;margin:0 0 20px;color:#2563eb">Tohs Event</p>
<div style="background:#fff;border-radius:16px;padding:24px;line-height:1.6">${bodyHtml}</div>
<p style="font-size:12px;color:#71717a;margin-top:16px">${footerHtml}</p>
</div></body></html>`;
}
