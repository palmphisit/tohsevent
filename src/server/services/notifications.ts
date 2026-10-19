import { jwtVerify, SignJWT } from "jose";
import { ObjectId } from "mongodb";
import { collections, database } from "../db";
import { googleMapsLinks } from "../../lib/maps";
import { INTL_LOCALE, localePath, type Locale } from "../../lib/i18n";
import { emailButton, emailEnabled, emailLayout, escapeHtml, sendEmail, sendEmails, type EmailMessage } from "../email";
import { env } from "../env";
import { HttpError } from "../http";
import type { EventDoc, GuestSessionDoc, RegistrationDoc } from "../models";
import { qrPng } from "../qr";
import { eventInfoOf } from "./event-info";
import { eventLocale } from "./host-events";

// Email to guests and hosts: the ticket right after registering, opt-in "official photos are
// ready" (host sends with one click) and a reminder to hosts before their album expires.
// Guest emails use the language of the page the guest was on; host emails are Thai like the dashboard.

/** Absolute URL of a guest page in the given language. */
function guestUrl(locale: Locale, path: string): string {
  return `${env().APP_ORIGIN}${localePath(locale, path)}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRY_REMINDER_DAYS = 7;

function secret(): Uint8Array {
  return new TextEncoder().encode(env().SESSION_SECRET);
}

async function unsubscribeUrl(session: GuestSessionDoc): Promise<string> {
  const token = await new SignJWT({ eid: session.eventId.toHexString(), purpose: "unsubscribe" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session._id.toHexString())
    .setExpirationTime("400d")
    .sign(secret());
  return `${env().APP_ORIGIN}/api/v1/unsubscribe?token=${encodeURIComponent(token)}&lang=${session.notify?.locale ?? "th"}`;
}

export async function subscribeGuest(session: GuestSessionDoc, email: string, locale: Locale): Promise<void> {
  if (!emailEnabled()) throw new HttpError(503, "email_disabled", "Email notifications are not available");
  const { guestSessions } = await collections();
  await guestSessions.updateOne(
    { _id: session._id },
    { $set: { notify: { email: email.trim().toLowerCase(), consentAt: new Date(), notifiedAt: null, locale } } },
  );
}

export async function unsubscribeGuest(sessionId: ObjectId): Promise<void> {
  const { guestSessions } = await collections();
  await guestSessions.updateOne({ _id: sessionId }, { $unset: { notify: "" } });
}

/** Handles the signed link at the bottom of every guest email. */
export async function unsubscribeWithToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.purpose !== "unsubscribe" || typeof payload.sub !== "string" || !ObjectId.isValid(payload.sub)) {
      return false;
    }
    await unsubscribeGuest(new ObjectId(payload.sub));
    return true;
  } catch {
    return false;
  }
}

export async function pendingNotificationCount(event: EventDoc): Promise<number> {
  const { guestSessions } = await collections();
  return guestSessions.countDocuments({ eventId: event._id, "notify.email": { $exists: true }, "notify.notifiedAt": null });
}

const PHOTOS_READY = {
  en: {
    subject: (title: string) => `Photos from ${title} are ready`,
    body: (title: string) => `The photographer's photos from ${title} are ready to view and save.`,
    button: "See the photos",
    why: "You're receiving this because you asked to be notified on the event page",
    unsubscribe: "Unsubscribe",
  },
  th: {
    subject: (title: string) => `รูปจากงาน ${title} พร้อมแล้ว`,
    body: (title: string) => `รูปจากช่างภาพของงาน ${title} พร้อมให้ดูและเซฟแล้ว`,
    button: "ดูรูปในงาน",
    why: "คุณได้รับอีเมลนี้เพราะขอรับแจ้งเตือนจากหน้างาน",
    unsubscribe: "ยกเลิกการแจ้งเตือน",
  },
};

/** Emails every subscribed guest who has not been notified yet. */
export async function notifyGuestsPhotosReady(event: EventDoc): Promise<number> {
  if (!emailEnabled()) throw new HttpError(503, "email_disabled", "Email notifications are not available");
  const { guestSessions } = await collections();
  const sessions = await guestSessions
    .find({ eventId: event._id, "notify.email": { $exists: true }, "notify.notifiedAt": null })
    .limit(5_000)
    .toArray();
  if (sessions.length === 0) return 0;

  const messages: EmailMessage[] = await Promise.all(
    sessions.map(async (session) => {
      const locale = session.notify!.locale ?? eventLocale(event);
      const t = PHOTOS_READY[locale];
      const link = guestUrl(locale, `/e/${event.slug}`);
      const unsubscribe = await unsubscribeUrl(session);
      return {
        to: session.notify!.email,
        subject: t.subject(event.title),
        html: emailLayout(
          `<p style="margin-top:0">${t.body(`<b>${escapeHtml(event.title)}</b>`)}</p>
<p>${emailButton(link, t.button)}</p>`,
          `${t.why} · <a href="${unsubscribe}" style="color:#71717a">${t.unsubscribe}</a>`,
          locale,
        ),
        text: `${t.body(event.title)}\n${link}\n\n${t.unsubscribe}: ${unsubscribe}`,
      };
    }),
  );

  const sent = await sendEmails(messages);
  await guestSessions.updateMany(
    { _id: { $in: sessions.map((s) => s._id) } },
    { $set: { "notify.notifiedAt": new Date() } },
  );
  return sent;
}

/** Daily job: tell hosts their album closes within a week (once per event). */
export async function sendExpiryReminders(now = new Date()): Promise<number> {
  if (!emailEnabled()) return 0;
  const { events } = await collections();
  const due = await events
    .find({
      status: "live",
      ownerId: { $ne: null },
      expiresAt: { $gt: now, $lt: new Date(now.getTime() + EXPIRY_REMINDER_DAYS * DAY_MS) },
      expiryReminderSentAt: null,
    })
    .limit(200)
    .toArray();
  if (due.length === 0) return 0;

  const users = await database()
    .collection<{ _id: ObjectId; email: string; name: string }>("user")
    .find({ _id: { $in: due.map((e) => e.ownerId!) } })
    .toArray();
  const emailOf = new Map(users.map((u) => [u._id.toHexString(), u.email]));

  const messages: EmailMessage[] = [];
  for (const event of due) {
    const to = emailOf.get(event.ownerId!.toHexString());
    if (!to) continue;
    const planUrl = `${env().APP_ORIGIN}/dashboard/events/${event._id.toHexString()}/plan`;
    const date = event.expiresAt!.toLocaleDateString("th-TH", { dateStyle: "long", timeZone: "Asia/Bangkok" });
    messages.push({
      to,
      subject: `อัลบั้ม ${event.title} จะปิดวันที่ ${date}`,
      html: emailLayout(
        `<p style="margin-top:0">อัลบั้มของงาน <b>${escapeHtml(event.title)}</b> จะปิดให้แขกเข้าชมในวันที่ ${date}
และไฟล์รูปจะถูกลบหลังจากนั้น 7 วัน</p>
<p>ดาวน์โหลดรูปเก็บไว้ หรืออัปเกรดแพ็กเกจเพื่อเปิดอัลบั้มนานขึ้น</p>
<p><a href="${planUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none">จัดการงาน</a></p>`,
      ),
      text: `อัลบั้มของงาน ${event.title} จะปิดวันที่ ${date} จัดการงาน: ${planUrl}`,
    });
  }
  const sent = await sendEmails(messages);
  await events.updateMany({ _id: { $in: due.map((e) => e._id) } }, { $set: { expiryReminderSentAt: now } });
  return sent;
}

const TICKET = {
  en: {
    subject: (title: string) => `Your ticket: ${title}`,
    hello: (name: string) => `Hi ${name}, you're registered for`,
    people: (n: number) => `${n} ${n === 1 ? "person" : "people"}`,
    time: (range: string) => range,
    showQr: "Show this QR code (or the ticket code) at the registration desk.",
    code: "Ticket code",
    open: "Open my ticket",
    directions: "Directions",
    calendar: "Add to calendar",
    why: (title: string) => `You're receiving this because you registered for ${title} on Tohs Event.`,
  },
  th: {
    subject: (title: string) => `บัตรเข้างาน ${title}`,
    hello: (name: string) => `สวัสดีคุณ ${name} คุณลงทะเบียนเข้าร่วมงาน`,
    people: (n: number) => `${n} คน`,
    time: (range: string) => `${range} น.`,
    showQr: "แสดง QR นี้ (หรือรหัสบัตร) ที่จุดลงทะเบียนหน้างาน",
    code: "รหัสบัตร",
    open: "เปิดบัตรเข้างาน",
    directions: "นำทางไปงาน",
    calendar: "ลงปฏิทิน",
    why: (title: string) => `คุณได้รับอีเมลนี้เพราะลงทะเบียนงาน ${title} ผ่าน Tohs Event`,
  },
};

/**
 * Emails the guest their ticket (QR inline, code, time, place, links) and records when.
 * Returns false when email is off or the registration has no address.
 */
export async function sendTicketEmail(event: EventDoc, reg: RegistrationDoc): Promise<boolean> {
  if (!emailEnabled() || !reg.email || reg.status !== "registered") return false;
  const locale = reg.locale ?? eventLocale(event);
  const t = TICKET[locale];
  const info = eventInfoOf(event);
  const ticket = guestUrl(locale, `/e/${event.slug}/ticket/${reg.code}`);
  const maps = googleMapsLinks(info);
  const calendar = `${env().APP_ORIGIN}/e/${event.slug}/calendar.ics`;
  const date = event.date.toLocaleDateString(INTL_LOCALE[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const time = info.startTime ? t.time(`${info.startTime}${info.endTime ? `–${info.endTime}` : ""}`) : null;
  const when = [date, time].filter(Boolean).join(" · ");
  const place = [info.venueName, info.address].filter(Boolean).join(" · ");
  const qr = await qrPng(ticket, 480);
  const muted = "color:#52525b;font-size:14px;margin:4px 0";

  const html = emailLayout(
    `<p style="margin-top:0">${escapeHtml(t.hello(reg.name))}</p>
<h1 style="font-size:22px;line-height:1.3;margin:4px 0 8px">${escapeHtml(event.title)}</h1>
<p style="${muted}">📅 ${escapeHtml(when)}</p>
${place ? `<p style="${muted}">📍 ${escapeHtml(place)}</p>` : ""}
${reg.partySize > 1 ? `<p style="${muted}">👥 ${escapeHtml(t.people(reg.partySize))}</p>` : ""}
<div style="text-align:center;margin:20px 0 8px">
<img src="cid:ticket-qr" width="220" height="220" alt="QR ${reg.code}" style="display:inline-block;border:1px solid #e4e4e7;border-radius:12px;padding:8px;background:#fff">
<p style="margin:8px 0 0;font-size:12px;color:#71717a">${t.code}</p>
<p style="margin:0;font-family:ui-monospace,Menlo,monospace;font-size:22px;font-weight:700;letter-spacing:6px">${reg.code}</p>
<p style="${muted}">${t.showQr}</p>
</div>
<p style="text-align:center;margin:20px 0 8px">${emailButton(ticket, t.open)}</p>
<p style="text-align:center;font-size:14px;margin:0">
${maps ? `<a href="${maps.directions}" style="color:#2563eb">${t.directions}</a> · ` : ""}<a href="${calendar}" style="color:#2563eb">${t.calendar}</a>
</p>`,
    escapeHtml(t.why(event.title)),
    locale,
  );
  const text = [
    t.hello(reg.name),
    event.title,
    when,
    place,
    `${t.code}: ${reg.code}`,
    t.showQr,
    `${t.open}: ${ticket}`,
    maps ? `${t.directions}: ${maps.directions}` : "",
    `${t.calendar}: ${calendar}`,
  ]
    .filter(Boolean)
    .join("\n");

  await sendEmail({
    to: reg.email,
    subject: t.subject(event.title),
    html,
    text,
    attachments: [{ filename: `ticket-${reg.code}.png`, content: qr, contentId: "ticket-qr" }],
  });
  const { registrations } = await collections();
  await registrations.updateOne({ _id: reg._id }, { $set: { emailedAt: new Date() } });
  return true;
}
