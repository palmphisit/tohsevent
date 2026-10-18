import type { ObjectId } from "mongodb";
import { database } from "./db";

// Append-only record of actions on personal data (PDPA accountability): who deleted,
// hid or reported a photo, changed an event, paid, or what the daily job purged.
// Kept for 400 days (TTL index in db.ts). Never blocks the action it records.

export type AuditActor = { type: "host" | "guest" | "system"; id?: ObjectId | string | null };

export interface AuditDoc {
  at: Date;
  eventId: ObjectId | null;
  actor: { type: AuditActor["type"]; id: string | null };
  action: string;
  target: string | null;
  meta: Record<string, unknown> | null;
}

export const AUDIT_RETENTION_DAYS = 400;

export async function audit(entry: {
  eventId?: ObjectId | null;
  actor: AuditActor;
  action: string;
  target?: ObjectId | string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const doc: AuditDoc = {
    at: new Date(),
    eventId: entry.eventId ?? null,
    actor: { type: entry.actor.type, id: entry.actor.id ? String(entry.actor.id) : null },
    action: entry.action,
    target: entry.target ? String(entry.target) : null,
    meta: entry.meta ?? null,
  };
  try {
    await database().collection<AuditDoc>("auditLogs").insertOne(doc);
  } catch (error) {
    console.error("audit log write failed", entry.action, error);
  }
}
