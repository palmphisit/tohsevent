"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker } from "leaflet";
import { useEffect, useRef } from "react";

type LatLng = { lat: number; lng: number };

/** Thailand-wide view when no pin is set yet. */
const DEFAULT_CENTER: LatLng = { lat: 13.7563, lng: 100.5018 };

/**
 * OpenStreetMap map with one pin. Leaflet is loaded in the browser only. With `onPick`,
 * tapping the map or dragging the pin moves it (dashboard editor); without, it just shows it.
 */
export function OsmMap({
  location,
  onPick,
  className = "",
  zoom = 16,
}: {
  location: LatLng | null;
  onPick?: (location: LatLng) => void;
  className?: string;
  zoom?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const pickRef = useRef(onPick);
  useEffect(() => {
    pickRef.current = onPick;
  });
  const editable = !!onPick;

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const start = location ?? DEFAULT_CENTER;
      const map = L.map(containerRef.current, {
        center: [start.lat, start.lng],
        zoom: location ? zoom : 6,
        scrollWheelZoom: editable,
        attributionControl: true,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const icon = L.divIcon({
        className: "",
        html: '<span class="osm-pin"><span></span></span>',
        iconSize: [34, 44],
        iconAnchor: [17, 42],
      });
      const place = (at: LatLng) => {
        if (!markerRef.current) {
          markerRef.current = L.marker([at.lat, at.lng], { icon, draggable: editable }).addTo(map);
          markerRef.current.on("dragend", () => {
            const p = markerRef.current!.getLatLng();
            pickRef.current?.({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
          });
        } else markerRef.current.setLatLng([at.lat, at.lng]);
      };
      if (location) place(location);
      if (editable) {
        map.on("click", (e) => {
          const at = { lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) };
          place(at);
          pickRef.current?.(at);
        });
      }
      mapRef.current = map;
      (map as LeafletMap & { _place?: (at: LatLng) => void })._place = place;
      // Maps created inside a hidden panel measure 0×0: re-measure when the box changes size.
      resizeObserver = new ResizeObserver(() => map.invalidateSize());
      resizeObserver.observe(containerRef.current);
    });
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is created once; later location changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable]);

  // Follow location changes made outside the map (search result, pasted coordinates).
  useEffect(() => {
    const map = mapRef.current as (LeafletMap & { _place?: (at: LatLng) => void }) | null;
    if (!map || !location) return;
    map._place?.(location);
    const current = map.getCenter();
    if (Math.abs(current.lat - location.lat) > 1e-4 || Math.abs(current.lng - location.lng) > 1e-4) {
      map.setView([location.lat, location.lng], Math.max(map.getZoom(), zoom));
    }
  }, [location, zoom]);

  return <div ref={containerRef} className={`isolate z-0 ${className}`} />;
}
