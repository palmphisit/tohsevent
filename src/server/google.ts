import { ObjectId } from "mongodb";
import { DRIVE_SCOPE } from "../lib/google";
import { auth } from "./auth";
import { database } from "./db";
import { env } from "./env";

export function googleEnabled(): boolean {
  const e = env();
  return !!(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
}

interface AccountRow {
  _id: ObjectId;
  userId: ObjectId | string;
  providerId: string;
  scope?: string | null;
}

function googleAccount(userId: ObjectId) {
  return database()
    .collection<AccountRow>("account")
    .findOne({ userId: { $in: [userId, userId.toHexString()] }, providerId: "google" });
}

const hasDriveScope = (account: AccountRow | null) => !!account?.scope?.split(/[ ,]+/).includes(DRIVE_SCOPE);

/** Whether the user linked a Google account that granted Drive access. */
export async function driveConnected(userId: ObjectId): Promise<boolean> {
  return googleEnabled() && hasDriveScope(await googleAccount(userId));
}

/**
 * A valid Google access token for the user (Better Auth refreshes it when needed), or null
 * when no Google account with Drive access is linked or the grant was revoked.
 */
export async function driveAccessToken(userId: ObjectId): Promise<string | null> {
  if (!googleEnabled()) return null;
  const account = await googleAccount(userId);
  if (!hasDriveScope(account)) return null;
  try {
    const tokens = await auth().api.getAccessToken({
      body: { accountId: account!._id.toHexString(), userId: userId.toHexString() },
    });
    return tokens.accessToken || null;
  } catch {
    return null;
  }
}
