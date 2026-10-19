import type { ObjectId } from "mongodb";
import { collections } from "../db";
import { HttpError } from "../http";
import type { EventDoc } from "../models";
import type { UploadRequestFile } from "./photos";

// Instagram share: a guest uploads a photo at the moment they share it, with their @handle.
// The photo pops up once on the venue screen and stays out of the album; the host sees it in
// the share history. (Only a type import from photos.ts: it calls checkShoutout while reserving.)

/** Instagram usernames: letters, digits, "." and "_", up to 30 characters. */
export const INSTAGRAM_HANDLE = /^(?!.*\.\.)(?!\.)[A-Za-z0-9._]{1,30}(?<!\.)$/;
/** One send per guest per this many seconds, so a queue of popups stays fair. */
export const SHOUTOUT_COOLDOWN_SEC = 30;

export function normalizeHandle(input: string): string {
  return input
    .trim()
    .replace(/^@+/, "")
    .replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, "")
    .replace(/[/?].*$/, "");
}

/** Validates an Instagram-share upload before it is reserved; returns the clean handle. */
export async function checkShoutout(
  event: EventDoc,
  guestId: ObjectId,
  files: UploadRequestFile[],
  handle: string,
  now = new Date(),
): Promise<string> {
  if (!event.slideshow?.igShare) throw new HttpError(403, "ig_share_off", "Instagram share is not open for this event");
  if (files.length !== 1 || files[0].video) throw new HttpError(400, "ig_share_one_photo", "Share one photo at a time");
  const instagram = normalizeHandle(handle);
  if (!INSTAGRAM_HANDLE.test(instagram)) throw new HttpError(400, "invalid_instagram", "Enter a valid Instagram username");
  const { photos } = await collections();
  const recent = await photos.findOne({
    eventId: event._id,
    "uploader.id": guestId,
    purpose: "instagram",
    "shoutout.at": { $gt: new Date(now.getTime() - SHOUTOUT_COOLDOWN_SEC * 1000) },
  });
  if (recent) throw new HttpError(429, "ig_share_cooldown", "Please wait a moment before sharing again");
  return instagram;
}
