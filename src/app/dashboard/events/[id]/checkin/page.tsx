import { Suspense } from "react";
import { CheckinScreen } from "@/components/checkin/checkin-screen";
import { registrationSettingsOf } from "@/server/services/registration";
import { loadEventPageForMember } from "../load-event";

/** Check-in for the signed-in owner or photographers (session auth, no key needed). */
export default function DashboardCheckinPage({ params }: PageProps<"/dashboard/events/[id]/checkin">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse" />}>
      <Loader params={params} />
    </Suspense>
  );
}

async function Loader({ params }: Pick<PageProps<"/dashboard/events/[id]/checkin">, "params">) {
  const { event } = await loadEventPageForMember((await params).id);
  const s = registrationSettingsOf(event);
  return (
    <CheckinScreen
      slug={event.slug}
      staffKey={null}
      title={event.title}
      ask={{ phone: s.askPhone, organization: s.askOrganization, partySize: s.askPartySize }}
    />
  );
}
