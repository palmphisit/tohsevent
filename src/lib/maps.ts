// Map links shared by the event page and the dashboard editor. The page shows an
// OpenStreetMap map; these open the same place in Google Maps (app on phones).

export interface Place {
  location: { lat: number; lng: number } | null;
  venueName: string | null;
  address: string | null;
}

export function googleMapsLinks(place: Place): { view: string; directions: string } | null {
  const target = place.location
    ? `${place.location.lat},${place.location.lng}`
    : [place.venueName, place.address].filter(Boolean).join(" ");
  if (!target) return null;
  const q = encodeURIComponent(target);
  return {
    view: `https://www.google.com/maps/search/?api=1&query=${q}`,
    directions: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
  };
}

/** Accepts "13.7563, 100.5018" or a Google Maps link containing coordinates. */
export function parseCoordinates(text: string): { lat: number; lng: number } | null {
  const m =
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(text) ??
    /[?&](?:q|query|ll|destination)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/.exec(text) ??
    /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/.exec(text);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
