import { optionalHost } from "./auth";
import { verifyEventKey } from "./event-keys";
import { HttpError } from "./http";
import type { EventDoc } from "./models";
import { getEventForMember } from "./services/host-events";

/**
 * Who may check guests in: door staff holding the event's check-in link (key), or a signed-in
 * owner/photographer of the event. Returns what to record as `checkedInBy`.
 */
export async function requireCheckinAccess(req: Request, event: EventDoc, key: string | null | undefined): Promise<string> {
  if (verifyEventKey(event, "checkin", key)) return "staff-link";
  const host = await optionalHost(req);
  if (host) {
    try {
      await getEventForMember(host.id, event._id);
      return host.id.toHexString();
    } catch {
      // not a member of this event: fall through
    }
  }
  throw new HttpError(401, "checkin_key_required", "Open check-in from the link the host shared");
}
