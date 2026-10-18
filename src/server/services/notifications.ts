import { jwtVerify, SignJWT } from "jose";
import { ObjectId } from "mongodb";
import { collections, database } from "../db";
import { emailEnabled, emailLayout, escapeHtml, sendEmails, type EmailMessage } from "../email";
import { env } from "../env";
import { HttpError } from "../http";
import type { EventDoc, GuestSessionDoc } from "../models";
import { guestEventUrl } from "./host-events";

// Opt-in email notifications: guests ask to be told when the official photos are ready
// (host sends with one click); hosts get a reminder before their album expires.

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
  return `${env().APP_ORIGIN}/api/v1/unsubscribe?token=${encodeURIComponent(token)}`;
}

export async function subscribeGuest(session: GuestSessionDoc, email: string): Promise<void> {
  if (!emailEnabled()) throw new HttpError(503, "email_disabled", "Email notifications are not available");
  const { guestSessions } = await collections();
  await guestSessions.updateOne(
    { _id: session._id },
    { $set: { notify: { email: email.trim().toLowerCase(), consentAt: new Date(), notifiedAt: null } } },
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

/** Emails every subscribed guest who has not been notified yet. */
export async function notifyGuestsPhotosReady(event: EventDoc): Promise<number> {
  if (!emailEnabled()) throw new HttpError(503, "email_disabled", "Email notifications are not available");
  const { guestSessions } = await collections();
  const sessions = await guestSessions
    .find({ eventId: event._id, "notify.email": { $exists: true }, "notify.notifiedAt": null })
    .limit(5_000)
    .toArray();
  if (sessions.length === 0) return 0;

  const link = guestEventUrl(event.slug);
  const title = escapeHtml(event.title);
  const messages: EmailMessage[] = await Promise.all(
    sessions.map(async (session) => {
      const unsubscribe = await unsubscribeUrl(session);
      return {
        to: session.notify!.email,
        subject: `รูปจากงาน ${event.title} พร้อมแล้ว`,
        html: emailLayout(
          `<p style="margin-top:0">รูปจากช่างภาพของงาน <b>${title}</b> พร้อมให้ดูและเซฟแล้ว</p>
<p><a href="${link}" style="display:inline-block;background:#18181b;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none">ดูรูปในงาน</a></p>`,
          `คุณได้รับอีเมลนี้เพราะขอรับแจ้งเตือนจากหน้างาน · <a href="${unsubscribe}" style="color:#71717a">ยกเลิกการแจ้งเตือน</a>`,
        ),
        text: `รูปจากช่างภาพของงาน ${event.title} พร้อมแล้ว: ${link}\n\nยกเลิกการแจ้งเตือน: ${unsubscribe}`,
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
<p><a href="${planUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none">จัดการงาน</a></p>`,
      ),
      text: `อัลบั้มของงาน ${event.title} จะปิดวันที่ ${date} จัดการงาน: ${planUrl}`,
    });
  }
  const sent = await sendEmails(messages);
  await events.updateMany({ _id: { $in: due.map((e) => e._id) } }, { $set: { expiryReminderSentAt: now } });
  return sent;
}
