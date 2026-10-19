import { z } from "zod";
import { LOCALES } from "../../lib/i18n";
import { EVENT_INFO_LIMITS as I } from "../services/event-info";
import { REGISTRATION_LIMITS as R } from "../services/registration";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");
const text = (max: number) => z.string().max(max).nullable();

export const eventInfoSchema = z.object({
  description: text(I.descriptionMax),
  startTime: time.nullable(),
  endTime: time.nullable(),
  venueName: text(I.venueMax),
  address: text(I.addressMax),
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable(),
  schedule: z
    .array(
      z.object({
        id: z.string().max(40),
        time,
        title: z.string().max(I.scheduleTitleMax),
        detail: text(I.scheduleDetailMax),
      }),
    )
    .max(I.scheduleMax),
});

export const registrationSettingsSchema = z.object({
  enabled: z.boolean(),
  capacity: z.number().int().positive().max(1_000_000).nullable(),
  closesAt: z.coerce.date().nullable(),
  askPhone: z.boolean(),
  askOrganization: z.boolean(),
  askPartySize: z.boolean(),
  question: text(R.questionMax),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(R.nameMax),
  email: z.email().max(200).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  organization: z.string().trim().max(120).nullable().optional(),
  partySize: z.number().int().min(1).max(R.partySizeMax).optional(),
  answer: z.string().trim().max(R.answerMax).nullable().optional(),
  /** The guest accepted the privacy notice. */
  consent: z.literal(true),
  /** Language of the page the guest signed up on (ticket email). */
  locale: z.enum(LOCALES).optional(),
});
