import { notFound } from "next/navigation";
import { requireHostPage } from "@/server/auth";
import { HttpError, parseObjectId } from "@/server/http";
import { getHostEvent } from "@/server/services/host-events";

/** Loads an event owned by the signed-in host, or renders the 404 page. */
export async function loadHostEventPage(id: string) {
  const host = await requireHostPage();
  try {
    return await getHostEvent(host.id, parseObjectId(id, "event_not_found"));
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
}
