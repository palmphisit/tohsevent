import { randomBytes } from "node:crypto";
import { collections } from "../db";
import type { EventDoc, EventInfoDoc } from "../models";

// What the event page shows besides photos: description, times, venue, map pin, schedule.

export type EventInfo = Omit<EventInfoDoc, "updatedAt">;

export const EVENT_INFO_LIMITS = {
  descriptionMax: 3000,
  venueMax: 120,
  addressMax: 300,
  scheduleMax: 30,
  scheduleTitleMax: 120,
  scheduleDetailMax: 300,
} as const;

export const EMPTY_EVENT_INFO: EventInfo = {
  description: null,
  startTime: null,
  endTime: null,
  venueName: null,
  address: null,
  location: null,
  schedule: [],
};

export function eventInfoOf(event: Pick<EventDoc, "info">): EventInfo {
  if (!event.info) return EMPTY_EVENT_INFO;
  const { updatedAt: _ignored, ...info } = event.info;
  void _ignored;
  return { ...EMPTY_EVENT_INFO, ...info };
}

export function hasEventInfo(info: EventInfo): boolean {
  return !!(info.description || info.venueName || info.address || info.location || info.schedule.length || info.startTime);
}

export async function saveEventInfo(event: EventDoc, input: EventInfo): Promise<EventInfo> {
  const clean = (v: string | null) => v?.trim() || null;
  const doc: EventInfoDoc = {
    description: clean(input.description),
    startTime: input.startTime || null,
    endTime: input.endTime || null,
    venueName: clean(input.venueName),
    address: clean(input.address),
    location: input.location,
    schedule: [...input.schedule]
      .filter((item) => item.title.trim())
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((item) => ({
        id: item.id || randomBytes(6).toString("hex"),
        time: item.time,
        title: item.title.trim(),
        detail: clean(item.detail),
      })),
    updatedAt: new Date(),
  };
  const { events } = await collections();
  await events.updateOne({ _id: event._id }, { $set: { info: doc, updatedAt: doc.updatedAt } });
  return eventInfoOf({ info: doc });
}
