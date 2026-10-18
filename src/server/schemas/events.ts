import { z } from "zod";
import { SLUG_PATTERN } from "../services/host-events";

const title = z.string().trim().min(1).max(120);
const date = z.iso.date();
const accessMode = z.enum(["public", "password"]);
const password = z.string().min(4).max(64);

export const createEventSchema = z.object({
  title,
  date,
  slug: z.string().trim().toLowerCase().regex(SLUG_PATTERN, "Use 3-40 lowercase letters, numbers or dashes").optional(),
  accessMode: accessMode.default("public"),
  password: password.optional(),
});

export const updateEventSchema = z
  .object({
    title,
    date,
    accessMode,
    password,
    guestUpload: z.boolean(),
    status: z.enum(["live", "closed"]),
  })
  .partial();
