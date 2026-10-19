import { randomInt } from "node:crypto";
import { MongoServerError, ObjectId, type Filter } from "mongodb";
import { collections } from "../db";
import { eventKey } from "../event-keys";
import { HttpError } from "../http";
import { planOf, type EventDoc, type RegistrationDoc, type RegistrationSettingsDoc } from "../models";
import type { Locale } from "../../lib/i18n";
import { guestEventUrl } from "./host-events";

// Sign-up before the event (online), sign-up at the door (on-site, self-service or by staff),
// and check-in with the time each guest arrived. Every registration has a ticket code that
// is printed as a QR code; scanning it at the door records `checkedInAt`.

export type RegistrationSettings = Omit<RegistrationSettingsDoc, "updatedAt">;

export const REGISTRATION_LIMITS = { questionMax: 200, answerMax: 500, nameMax: 80, partySizeMax: 10 } as const;

export const DEFAULT_REGISTRATION: RegistrationSettings = {
  enabled: false,
  capacity: null,
  closesAt: null,
  askPhone: true,
  askOrganization: false,
  askPartySize: false,
  question: null,
};

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const DAY_MS = 24 * 60 * 60 * 1000;

export function registrationSettingsOf(event: Pick<EventDoc, "registration">): RegistrationSettings {
  if (!event.registration) return DEFAULT_REGISTRATION;
  const { updatedAt: _ignored, ...settings } = event.registration;
  void _ignored;
  return { ...DEFAULT_REGISTRATION, ...settings };
}

export async function saveRegistrationSettings(event: EventDoc, input: RegistrationSettings): Promise<RegistrationSettings> {
  const doc: RegistrationSettingsDoc = {
    ...input,
    capacity: input.capacity ? Math.min(input.capacity, planOf(event).maxGuests) : null,
    question: input.question?.trim() || null,
    updatedAt: new Date(),
  };
  const { events } = await collections();
  await events.updateOne({ _id: event._id }, { $set: { registration: doc, updatedAt: doc.updatedAt } });
  return registrationSettingsOf({ registration: doc });
}

/** Most people (headcount, party sizes included) the event takes: the host's cap, never above the plan. */
export function capacityOf(event: EventDoc): number {
  const plan = planOf(event).maxGuests;
  return Math.min(registrationSettingsOf(event).capacity ?? plan, plan);
}

/** Online sign-up closes at the host's deadline, or when the event day ends (Bangkok). */
export function onlineClosesAt(event: EventDoc): Date {
  return registrationSettingsOf(event).closesAt ?? new Date(event.date.getTime() + DAY_MS - 7 * 60 * 60 * 1000);
}

export type RegistrationState = "open" | "off" | "closed" | "full";

export async function registrationState(event: EventDoc, now = new Date()): Promise<RegistrationState> {
  if (!registrationSettingsOf(event).enabled || event.status !== "live") return "off";
  if (now > onlineClosesAt(event)) return "closed";
  return (await headcount(event)) >= capacityOf(event) ? "full" : "open";
}

async function headcount(event: EventDoc): Promise<number> {
  const { registrations } = await collections();
  const [row] = await registrations
    .aggregate<{ n: number }>([
      { $match: { eventId: event._id, status: "registered" } },
      { $group: { _id: null, n: { $sum: "$partySize" } } },
    ])
    .toArray();
  return row?.n ?? 0;
}

/**
 * The unique indexes enforce one registration per email and unique ticket codes, so they
 * must exist before the first sign-up. Created by the app itself (idempotent, once per
 * instance) so a deploy does not depend on running the setup script against the database.
 */
let indexesReady: Promise<unknown> | null = null;
function ensureIndexes(): Promise<unknown> {
  indexesReady ??= collections()
    .then(({ registrations }) =>
      Promise.all([
        registrations.createIndex({ eventId: 1, code: 1 }, { unique: true }),
        registrations.createIndex(
          { eventId: 1, email: 1 },
          { unique: true, partialFilterExpression: { status: "registered", email: { $type: "string" } } },
        ),
        registrations.createIndex({ eventId: 1, createdAt: -1 }),
        registrations.createIndex({ eventId: 1, checkedInAt: -1 }),
      ]),
    )
    .catch((error) => {
      indexesReady = null;
      throw error;
    });
  return indexesReady;
}

function newCode(): string {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

export interface RegisterInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
  partySize?: number;
  answer?: string | null;
  locale?: Locale;
}

/**
 * Signs a guest up. `onsite` sign-ups (at the door) skip the online deadline and are checked
 * in right away; online ones need an email for the ticket.
 */
export async function register(
  event: EventDoc,
  input: RegisterInput,
  options: { source: "online" | "onsite"; checkedInBy?: string },
): Promise<RegistrationDoc> {
  const settings = registrationSettingsOf(event);
  if (!settings.enabled || event.status !== "live") throw new HttpError(403, "registration_off", "Registration is not open");
  if (options.source === "online" && new Date() > onlineClosesAt(event)) {
    throw new HttpError(403, "registration_closed", "Online registration has closed");
  }
  const email = input.email?.trim().toLowerCase() || null;
  if (options.source === "online" && !email) throw new HttpError(400, "email_required", "Email is required");
  const phone = input.phone?.trim() || null;
  if (options.source === "online" && settings.askPhone && !phone) throw new HttpError(400, "phone_required", "Phone is required");
  const partySize = settings.askPartySize ? Math.min(Math.max(1, input.partySize ?? 1), REGISTRATION_LIMITS.partySizeMax) : 1;

  if ((await headcount(event)) + partySize > capacityOf(event)) {
    throw new HttpError(409, "registration_full", "This event is fully booked");
  }

  await ensureIndexes();
  const { registrations } = await collections();
  const now = new Date();
  for (let attempt = 0; attempt < 5; attempt++) {
    const doc: RegistrationDoc = {
      _id: new ObjectId(),
      eventId: event._id,
      code: newCode(),
      name: input.name.trim(),
      email,
      phone,
      organization: settings.askOrganization ? input.organization?.trim() || null : null,
      partySize,
      answer: settings.question ? input.answer?.trim() || null : null,
      source: options.source,
      status: "registered",
      checkedInAt: options.source === "onsite" ? now : null,
      checkedInBy: options.source === "onsite" ? (options.checkedInBy ?? "self") : null,
      consentAt: now,
      ...(input.locale ? { locale: input.locale } : {}),
      createdAt: now,
    };
    try {
      await registrations.insertOne(doc);
      return doc;
    } catch (error) {
      if (!(error instanceof MongoServerError && error.code === 11000)) throw error;
      if (String(error.message).includes("email")) {
        throw new HttpError(409, "already_registered", "This email is already registered for the event");
      }
      // Ticket code collision: try another code.
    }
  }
  throw new HttpError(500, "code_generation_failed");
}

export async function findByCode(event: EventDoc, code: string): Promise<RegistrationDoc | null> {
  const { registrations } = await collections();
  return registrations.findOne({ eventId: event._id, code: code.trim().toUpperCase() });
}

export async function findById(event: EventDoc, id: ObjectId): Promise<RegistrationDoc> {
  const { registrations } = await collections();
  const doc = await registrations.findOne({ _id: id, eventId: event._id });
  if (!doc) throw new HttpError(404, "registration_not_found");
  return doc;
}

/** Pulls the ticket code out of a scanned QR (a ticket URL) or typed text. */
export function codeFromScan(text: string): string | null {
  const match = /\/ticket\/([A-Z0-9]{8})\b/i.exec(text) ?? /^\s*([A-Z0-9]{8})\s*$/i.exec(text);
  return match ? match[1].toUpperCase() : null;
}

export interface CheckInResult {
  registration: HostRegistration;
  /** The guest had already been checked in (shown as a warning at the door). */
  already: boolean;
}

/** Records the arrival time. Checking in twice keeps the first time and says so. */
export async function checkIn(
  event: EventDoc,
  target: { code: string } | { id: ObjectId },
  by: string,
): Promise<CheckInResult> {
  const { registrations } = await collections();
  const match: Filter<RegistrationDoc> =
    "code" in target ? { eventId: event._id, code: target.code.toUpperCase() } : { eventId: event._id, _id: target.id };
  const updated = await registrations.findOneAndUpdate(
    { ...match, status: "registered", checkedInAt: null },
    { $set: { checkedInAt: new Date(), checkedInBy: by } },
    { returnDocument: "after" },
  );
  if (updated) return { registration: toHostRegistration(updated), already: false };
  const existing = await registrations.findOne(match);
  if (!existing) throw new HttpError(404, "ticket_not_found", "No registration with this code for this event");
  if (existing.status === "cancelled") throw new HttpError(409, "registration_cancelled", "This registration was cancelled");
  return { registration: toHostRegistration(existing), already: true };
}

export async function undoCheckIn(event: EventDoc, id: ObjectId): Promise<HostRegistration> {
  const { registrations } = await collections();
  const doc = await registrations.findOneAndUpdate(
    { _id: id, eventId: event._id },
    { $set: { checkedInAt: null, checkedInBy: null } },
    { returnDocument: "after" },
  );
  if (!doc) throw new HttpError(404, "registration_not_found");
  return toHostRegistration(doc);
}

export async function cancelRegistration(event: EventDoc, id: ObjectId): Promise<HostRegistration> {
  const { registrations } = await collections();
  const doc = await registrations.findOneAndUpdate(
    { _id: id, eventId: event._id },
    { $set: { status: "cancelled" } },
    { returnDocument: "after" },
  );
  if (!doc) throw new HttpError(404, "registration_not_found");
  return toHostRegistration(doc);
}

export interface HostRegistration {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  partySize: number;
  answer: string | null;
  source: RegistrationDoc["source"];
  status: RegistrationDoc["status"];
  checkedInAt: string | null;
  /** When the ticket was last emailed (null: never). */
  emailedAt: string | null;
  createdAt: string;
}

export function toHostRegistration(doc: RegistrationDoc): HostRegistration {
  return {
    id: doc._id.toHexString(),
    code: doc.code,
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    organization: doc.organization,
    partySize: doc.partySize,
    answer: doc.answer,
    source: doc.source,
    status: doc.status,
    checkedInAt: doc.checkedInAt?.toISOString() ?? null,
    emailedAt: doc.emailedAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}

export interface RegistrationStats {
  registrations: number;
  headcount: number;
  checkedIn: number;
  checkedInHeadcount: number;
  onsite: number;
  capacity: number;
}

export async function registrationStats(event: EventDoc): Promise<RegistrationStats> {
  const { registrations } = await collections();
  const [row] = await registrations
    .aggregate<Omit<RegistrationStats, "capacity">>([
      { $match: { eventId: event._id, status: "registered" } },
      {
        $group: {
          _id: null,
          registrations: { $sum: 1 },
          headcount: { $sum: "$partySize" },
          checkedIn: { $sum: { $cond: [{ $ne: ["$checkedInAt", null] }, 1, 0] } },
          checkedInHeadcount: { $sum: { $cond: [{ $ne: ["$checkedInAt", null] }, "$partySize", 0] } },
          onsite: { $sum: { $cond: [{ $eq: ["$source", "onsite"] }, 1, 0] } },
        },
      },
    ])
    .toArray();
  return {
    registrations: row?.registrations ?? 0,
    headcount: row?.headcount ?? 0,
    checkedIn: row?.checkedIn ?? 0,
    checkedInHeadcount: row?.checkedInHeadcount ?? 0,
    onsite: row?.onsite ?? 0,
    capacity: capacityOf(event),
  };
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function listRegistrations(
  event: EventDoc,
  options: { q?: string; filter?: "all" | "in" | "out" | "cancelled"; limit?: number },
): Promise<HostRegistration[]> {
  const { registrations } = await collections();
  const filter: Filter<RegistrationDoc> = { eventId: event._id };
  if (options.filter === "cancelled") filter.status = "cancelled";
  else {
    filter.status = "registered";
    if (options.filter === "in") filter.checkedInAt = { $ne: null };
    if (options.filter === "out") filter.checkedInAt = null;
  }
  const q = options.q?.trim();
  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: re }, { email: re }, { phone: re }, { code: re }, { organization: re }];
  }
  const docs = await registrations
    .find(filter)
    .sort(options.filter === "in" ? { checkedInAt: -1 } : { createdAt: -1 })
    .limit(options.limit ?? 500)
    .toArray();
  return docs.map(toHostRegistration);
}

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  // Leading = + - @ would be run as formulas by spreadsheet apps.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const bangkok = (d: Date | null) =>
  d ? d.toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" }).replace("T", " ") : "";

/** All registrations as CSV (UTF-8 with BOM so Excel shows Thai correctly). */
export async function registrationsCsv(event: EventDoc): Promise<string> {
  const { registrations } = await collections();
  const docs = await registrations.find({ eventId: event._id }).sort({ createdAt: 1 }).toArray();
  const settings = registrationSettingsOf(event);
  const header = [
    "ticket",
    "name",
    "email",
    "phone",
    "organization",
    "party_size",
    ...(settings.question ? [settings.question] : []),
    "source",
    "status",
    "registered_at",
    "checked_in_at",
  ];
  const rows = docs.map((d) => [
    d.code,
    d.name,
    d.email,
    d.phone,
    d.organization,
    d.partySize,
    ...(settings.question ? [d.answer] : []),
    d.source,
    d.status,
    bangkok(d.createdAt),
    bangkok(d.checkedInAt),
  ]);
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Ticket page in the event's language; the QR on it holds this URL (the code is what check-in reads). */
export function ticketUrl(event: Pick<EventDoc, "slug" | "language">, code: string): string {
  return guestEventUrl(event, `/ticket/${code}`);
}

export function registrationLinks(event: EventDoc) {
  return {
    page: guestEventUrl(event, "/info"),
    onsite: guestEventUrl(event, `/info?onsite=${eventKey(event, "onsite")}`),
    staff: guestEventUrl(event, `/checkin?key=${eventKey(event, "checkin")}`),
  };
}
