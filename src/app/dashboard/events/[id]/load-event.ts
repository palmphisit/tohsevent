import { notFound } from "next/navigation";
import { cache } from "react";
import { requireHostPage } from "@/server/auth";
import { HttpError, parseObjectId } from "@/server/http";
import { getEventForMember, getHostEvent } from "@/server/services/host-events";

/** Loads an event owned by the signed-in host, or renders the 404 page (once per request). */
export const loadHostEventPage = cache(async (id: string) => {
  const host = await requireHostPage();
  try {
    return await getHostEvent(host.id, parseObjectId(id, "event_not_found"));
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
});

/** Loads an event the signed-in user owns or was invited to, with their role; 404 otherwise (once per request). */
export const loadEventPageForMember = cache(async (id: string) => {
  const host = await requireHostPage();
  try {
    return await getEventForMember(host.id, parseObjectId(id, "event_not_found"));
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
});
