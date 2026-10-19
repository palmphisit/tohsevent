import { collections } from "../db";
import type { AppearanceDoc, EventDoc } from "../models";

// How the guest page looks: theme, header style, gallery layout and a few texts.
// Available on every plan; colors, fonts, logo and cover stay Premium (services/branding.ts).

export type Appearance = Omit<AppearanceDoc, "updatedAt">;

export const APPEARANCE_LIMITS = { uploadLabelMax: 40 } as const;

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "light",
  header: "banner",
  gallery: "grid",
  defaultTab: "guest",
  uploadLabel: null,
  showDate: true,
};

export function appearanceOf(event: Pick<EventDoc, "appearance">): Appearance {
  const saved: Partial<AppearanceDoc> = { ...event.appearance };
  delete saved.updatedAt;
  return { ...DEFAULT_APPEARANCE, ...saved };
}

export async function saveAppearance(event: EventDoc, input: Appearance): Promise<Appearance> {
  const doc: AppearanceDoc = { ...input, uploadLabel: input.uploadLabel?.trim() || null, updatedAt: new Date() };
  const { events } = await collections();
  await events.updateOne({ _id: event._id }, { $set: { appearance: doc, updatedAt: doc.updatedAt } });
  return appearanceOf({ appearance: doc });
}
