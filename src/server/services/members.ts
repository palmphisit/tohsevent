import { createHash, randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { collections, database } from "../db";
import { env } from "../env";
import { HttpError } from "../http";
import type { EventDoc, InviteDoc, MemberRole } from "../models";

// Photographers join an event through a link the owner shares (no email needed).
// Only a hash of the link token is stored; the link itself is shown once on creation.

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const hashToken = (token: string) => createHash("sha256").update(token).digest("base64url");

export interface MemberView {
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  addedAt: string;
}

export interface InviteView {
  id: string;
  role: MemberRole;
  createdAt: string;
  expiresAt: string;
}

async function usersById(ids: ObjectId[]) {
  const users = await database()
    .collection<{ _id: ObjectId; name: string; email: string }>("user")
    .find({ _id: { $in: ids } })
    .toArray();
  return new Map(users.map((u) => [u._id.toHexString(), u]));
}

export async function listMembers(event: EventDoc): Promise<{ members: MemberView[]; invites: InviteView[] }> {
  const members = event.members ?? [];
  const users = await usersById(members.map((m) => m.userId));
  const { invites } = await collections();
  const pending = await invites
    .find({ eventId: event._id, acceptedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .toArray();
  return {
    members: members.map((m) => {
      const user = users.get(m.userId.toHexString());
      return {
        userId: m.userId.toHexString(),
        name: user?.name ?? "(ไม่พบผู้ใช้)",
        email: user?.email ?? "",
        role: m.role,
        addedAt: m.addedAt.toISOString(),
      };
    }),
    invites: pending.map((i) => ({
      id: i._id.toHexString(),
      role: i.role,
      createdAt: i.createdAt.toISOString(),
      expiresAt: i.expiresAt.toISOString(),
    })),
  };
}

/** Creates a single-use invite link valid for 7 days. */
export async function createInvite(event: EventDoc, createdBy: ObjectId): Promise<{ url: string; expiresAt: string }> {
  const token = randomBytes(24).toString("base64url");
  const now = new Date();
  const invite: InviteDoc = {
    _id: new ObjectId(),
    eventId: event._id,
    role: "photographer",
    tokenHash: hashToken(token),
    createdBy,
    createdAt: now,
    expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
    acceptedBy: null,
    acceptedAt: null,
  };
  const { invites } = await collections();
  await invites.insertOne(invite);
  return { url: `${env().APP_ORIGIN}/invite/${token}`, expiresAt: invite.expiresAt.toISOString() };
}

export async function revokeInvite(event: EventDoc, inviteId: ObjectId): Promise<void> {
  const { invites } = await collections();
  await invites.deleteOne({ _id: inviteId, eventId: event._id, acceptedAt: null });
}

export async function removeMember(event: EventDoc, userId: ObjectId): Promise<void> {
  const { events } = await collections();
  await events.updateOne({ _id: event._id }, { $pull: { members: { userId } }, $set: { updatedAt: new Date() } });
}

/** Looks up a still-valid invite and its event (for the /invite page). */
export async function findInvite(token: string): Promise<{ invite: InviteDoc; event: EventDoc } | null> {
  const { invites, events } = await collections();
  const invite = await invites.findOne({ tokenHash: hashToken(token) });
  if (!invite || invite.acceptedAt || invite.expiresAt <= new Date()) return null;
  const event = await events.findOne({ _id: invite.eventId });
  return event ? { invite, event } : null;
}

/** The signed-in user accepts: they become a member (the owner just gets redirected). */
export async function acceptInvite(token: string, userId: ObjectId): Promise<EventDoc> {
  const found = await findInvite(token);
  if (!found) throw new HttpError(404, "invite_invalid", "This invite link is invalid or has expired");
  const { invite, event } = found;
  const { invites, events } = await collections();

  const isOwner = event.ownerId?.equals(userId);
  const isMember = event.members?.some((m) => m.userId.equals(userId));
  if (!isOwner && !isMember) {
    await events.updateOne(
      { _id: event._id, "members.userId": { $ne: userId } },
      { $push: { members: { userId, role: invite.role, addedAt: new Date() } }, $set: { updatedAt: new Date() } },
    );
  }
  await invites.updateOne({ _id: invite._id, acceptedAt: null }, { $set: { acceptedBy: userId, acceptedAt: new Date() } });
  return event;
}
