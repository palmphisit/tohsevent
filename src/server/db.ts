import { MongoClient, type Collection, type Db } from "mongodb";
import { env } from "./env";
import type { DriveExportDoc, EventDoc, GuestSessionDoc, InviteDoc, PaymentDoc, PhotoDoc, RegistrationDoc, ReportDoc } from "./models";

// Cloud Run instances are long-lived containers, so one pooled client per instance
// is reused across requests. Stored on globalThis to survive dev hot reloads.
// The driver connects lazily on the first operation, so creating it is synchronous
// (Better Auth's adapter needs a Db instance up front).
const globalForMongo = globalThis as { _mongoClient?: MongoClient };

export function mongoClient(): MongoClient {
  globalForMongo._mongoClient ??= new MongoClient(env().MONGODB_URI, {
    appName: "tohsevent",
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 5_000,
  });
  return globalForMongo._mongoClient;
}

export function database(): Db {
  return mongoClient().db(env().MONGODB_DB);
}

export async function getDb(): Promise<Db> {
  return database();
}

export async function collections(): Promise<{
  events: Collection<EventDoc>;
  guestSessions: Collection<GuestSessionDoc>;
  photos: Collection<PhotoDoc>;
  reports: Collection<ReportDoc>;
  payments: Collection<PaymentDoc>;
  invites: Collection<InviteDoc>;
  driveExports: Collection<DriveExportDoc>;
  registrations: Collection<RegistrationDoc>;
}> {
  const db = await getDb();
  return {
    events: db.collection<EventDoc>("events"),
    guestSessions: db.collection<GuestSessionDoc>("guestSessions"),
    photos: db.collection<PhotoDoc>("photos"),
    reports: db.collection<ReportDoc>("reports"),
    payments: db.collection<PaymentDoc>("payments"),
    invites: db.collection<InviteDoc>("invites"),
    driveExports: db.collection<DriveExportDoc>("driveExports"),
    registrations: db.collection<RegistrationDoc>("registrations"),
  };
}

export async function ensureIndexes(): Promise<void> {
  const db = database();
  const { events, guestSessions, photos, reports, payments, invites, driveExports, registrations } = await collections();
  await Promise.all([
    events.createIndex({ slug: 1 }, { unique: true }),
    events.createIndex({ ownerId: 1, createdAt: -1 }),
    events.createIndex({ "members.userId": 1 }),
    invites.createIndex({ tokenHash: 1 }, { unique: true }),
    invites.createIndex({ eventId: 1, createdAt: -1 }),
    driveExports.createIndex({ eventId: 1, userId: 1, createdAt: -1 }),
    registrations.createIndex({ eventId: 1, code: 1 }, { unique: true }),
    registrations.createIndex(
      { eventId: 1, email: 1 },
      { unique: true, partialFilterExpression: { status: "registered", email: { $type: "string" } } },
    ),
    registrations.createIndex({ eventId: 1, createdAt: -1 }),
    registrations.createIndex({ eventId: 1, checkedInAt: -1 }),
    // Daily job: expire and purge albums.
    events.createIndex({ status: 1, expiresAt: 1 }),
    payments.createIndex({ stripeSessionId: 1 }, { unique: true, partialFilterExpression: { stripeSessionId: { $type: "string" } } }),
    payments.createIndex({ eventId: 1, createdAt: -1 }),
    payments.createIndex({ stripePaymentIntentId: 1 }, { partialFilterExpression: { stripePaymentIntentId: { $type: "string" } } }),
    guestSessions.createIndex({ eventId: 1, createdAt: -1 }),
    guestSessions.createIndex({ eventId: 1, "notify.notifiedAt": 1 }, { partialFilterExpression: { "notify.email": { $exists: true } } }),
    // Gallery listing: newest first per event + source, cursor on _id.
    photos.createIndex({ eventId: 1, source: 1, status: 1, _id: -1 }),
    photos.createIndex({ "uploader.id": 1, eventId: 1 }),
    // Cleanup of uploads that were never completed.
    photos.createIndex({ status: 1, createdAt: 1 }),
    // Host moderation: reported photos per event.
    photos.createIndex({ eventId: 1, openReports: 1, _id: -1 }, { partialFilterExpression: { openReports: { $gt: 0 } } }),
    // One open report per guest per photo.
    reports.createIndex(
      { photoId: 1, guestSessionId: 1 },
      { unique: true, partialFilterExpression: { status: "open" } },
    ),
    reports.createIndex({ eventId: 1, status: 1, createdAt: -1 }),
    db.collection("auditLogs").createIndex({ eventId: 1, at: -1 }),
    db.collection("auditLogs").createIndex({ at: 1 }, { expireAfterSeconds: 400 * 24 * 60 * 60 }),
    // Better Auth collections (the adapter does not create indexes itself).
    db.collection("user").createIndex({ email: 1 }, { unique: true }),
    db.collection("session").createIndex({ token: 1 }, { unique: true }),
    db.collection("session").createIndex({ userId: 1 }),
    db.collection("account").createIndex({ userId: 1 }),
    db.collection("verification").createIndex({ identifier: 1 }),
  ]);
}
