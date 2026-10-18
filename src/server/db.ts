import { MongoClient, type Collection, type Db } from "mongodb";
import { env } from "./env";
import type { EventDoc, GuestSessionDoc, PhotoDoc } from "./models";

// Cloud Run instances are long-lived containers, so one pooled client per instance
// is reused across requests. Stored on globalThis to survive dev hot reloads.
const globalForMongo = globalThis as { _mongoClient?: Promise<MongoClient> };

export function getMongoClient(): Promise<MongoClient> {
  if (!globalForMongo._mongoClient) {
    const client = new MongoClient(env().MONGODB_URI, {
      appName: "tohsevent",
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5_000,
    });
    globalForMongo._mongoClient = client.connect().catch((error) => {
      globalForMongo._mongoClient = undefined;
      throw error;
    });
  }
  return globalForMongo._mongoClient;
}

export async function getDb(): Promise<Db> {
  return (await getMongoClient()).db(env().MONGODB_DB);
}

export async function collections(): Promise<{
  events: Collection<EventDoc>;
  guestSessions: Collection<GuestSessionDoc>;
  photos: Collection<PhotoDoc>;
}> {
  const db = await getDb();
  return {
    events: db.collection<EventDoc>("events"),
    guestSessions: db.collection<GuestSessionDoc>("guestSessions"),
    photos: db.collection<PhotoDoc>("photos"),
  };
}

export async function ensureIndexes(): Promise<void> {
  const { events, guestSessions, photos } = await collections();
  await Promise.all([
    events.createIndex({ slug: 1 }, { unique: true }),
    events.createIndex({ ownerId: 1, createdAt: -1 }),
    guestSessions.createIndex({ eventId: 1, createdAt: -1 }),
    // Gallery listing: newest first per event + source, cursor on _id.
    photos.createIndex({ eventId: 1, source: 1, status: 1, _id: -1 }),
    photos.createIndex({ "uploader.id": 1, eventId: 1 }),
    // Cleanup of uploads that were never completed.
    photos.createIndex({ status: 1, createdAt: 1 }),
  ]);
}
