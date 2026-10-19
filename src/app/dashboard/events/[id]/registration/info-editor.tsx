"use client";

import { GripVertical, Loader2, MapPin, Plus, Search, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { saveEventInfo, type EventInfo } from "@/lib/api-client";
import { showError } from "@/lib/error-popup";
import { googleMapsLinks, parseCoordinates } from "@/lib/maps";

// Leaflet touches `window`: load the map only in the browser.
const OsmMap = dynamic(() => import("@/components/osm-map").then((m) => m.OsmMap), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />,
});

const input =
  "w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

/** Event details editor: description, times, venue with a map pin, and the schedule. */
export function InfoEditor({ eventId, initial }: { eventId: string; initial: EventInfo }) {
  const [info, setInfo] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  function set<K extends keyof EventInfo>(key: K, value: EventInfo[K]) {
    setInfo((prev) => ({ ...prev, [key]: value }));
    setState("idle");
  }

  async function search() {
    const pasted = parseCoordinates(query);
    if (pasted) {
      set("location", pasted);
      setResults(null);
      return;
    }
    if (!query.trim()) return;
    setSearching(true);
    try {
      // OpenStreetMap's geocoder (light use from the browser is within its usage policy).
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=th&q=${encodeURIComponent(query)}`,
      );
      setResults((await res.json()) as SearchResult[]);
    } catch {
      showError("ค้นหาสถานที่ไม่สำเร็จ ลองพิมพ์ใหม่ หรือแตะบนแผนที่เพื่อปักหมุด");
    } finally {
      setSearching(false);
    }
  }

  async function save() {
    setState("saving");
    try {
      setInfo((await saveEventInfo(eventId, info)).info);
      setState("saved");
    } catch {
      setState("idle");
      showError("บันทึกไม่สำเร็จ ตรวจสอบเวลาให้อยู่ในรูปแบบ ชม:นาที แล้วลองอีกครั้ง");
    }
  }

  const maps = googleMapsLinks(info);

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
        <h3 className="font-semibold">รายละเอียดงาน</h3>
        <textarea
          value={info.description ?? ""}
          onChange={(e) => set("description", e.target.value || null)}
          maxLength={3000}
          rows={4}
          placeholder="เล่าเกี่ยวกับงาน การแต่งกาย ที่จอดรถ หรือสิ่งที่แขกควรรู้"
          className={input}
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-slate-600">เวลาเริ่ม</span>
            <input type="time" value={info.startTime ?? ""} onChange={(e) => set("startTime", e.target.value || null)} className={`mt-1 ${input}`} />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">เวลาจบ</span>
            <input type="time" value={info.endTime ?? ""} onChange={(e) => set("endTime", e.target.value || null)} className={`mt-1 ${input}`} />
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
        <h3 className="font-semibold">สถานที่</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={info.venueName ?? ""} onChange={(e) => set("venueName", e.target.value || null)} maxLength={120} placeholder="ชื่อสถานที่ เช่น โรงแรม... ห้อง..." className={input} />
          <input value={info.address ?? ""} onChange={(e) => set("address", e.target.value || null)} maxLength={300} placeholder="ที่อยู่" className={input} />
        </div>
        <div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void search())}
                placeholder="ค้นหาสถานที่ หรือวางลิงก์ Google Maps / พิกัด"
                className={`${input} pl-9`}
              />
            </div>
            <button type="button" onClick={search} className="rounded-xl bg-slate-900 px-4 text-sm font-medium text-white">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "ค้นหา"}
            </button>
          </div>
          {results && (
            <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl ring-1 ring-slate-200">
              {results.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">ไม่พบสถานที่ ลองแตะบนแผนที่เพื่อปักหมุดเอง</li>}
              {results.map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button
                    type="button"
                    onClick={() => {
                      set("location", { lat: +(+r.lat).toFixed(6), lng: +(+r.lon).toFixed(6) });
                      if (!info.address) set("address", r.display_name);
                      setResults(null);
                    }}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {r.display_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <OsmMap location={info.location} onPick={(at) => set("location", at)} className="h-72 overflow-hidden rounded-2xl ring-1 ring-slate-200" />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>{info.location ? `หมุด: ${info.location.lat}, ${info.location.lng} · ลากหมุดหรือแตะแผนที่เพื่อย้าย` : "แตะบนแผนที่เพื่อปักหมุดสถานที่"}</span>
          <span className="flex gap-3">
            {maps && (
              <a href={maps.view} target="_blank" rel="noopener" className="font-medium text-primary underline">
                ตรวจสอบใน Google Maps
              </a>
            )}
            {info.location && (
              <button type="button" onClick={() => set("location", null)} className="text-red-600">
                ลบหมุด
              </button>
            )}
          </span>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
        <h3 className="font-semibold">กำหนดการ</h3>
        {info.schedule.length === 0 && <p className="text-sm text-slate-500">ยังไม่มีกำหนดการ เพิ่มช่วงเวลาสำคัญให้แขกรู้ล่วงหน้า</p>}
        <ul className="space-y-2">
          {info.schedule.map((item, i) => (
            <li key={item.id || i} className="flex items-start gap-2 rounded-xl bg-slate-50 p-2.5">
              <GripVertical className="mt-2.5 h-4 w-4 shrink-0 text-slate-300" />
              <input
                type="time"
                value={item.time}
                onChange={(e) => set("schedule", info.schedule.map((s, j) => (j === i ? { ...s, time: e.target.value } : s)))}
                className="w-28 shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <input
                  value={item.title}
                  onChange={(e) => set("schedule", info.schedule.map((s, j) => (j === i ? { ...s, title: e.target.value } : s)))}
                  maxLength={120}
                  placeholder="เช่น ลงทะเบียน / พิธีเปิด / เลี้ยงอาหาร"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <input
                  value={item.detail ?? ""}
                  onChange={(e) => set("schedule", info.schedule.map((s, j) => (j === i ? { ...s, detail: e.target.value || null } : s)))}
                  maxLength={300}
                  placeholder="รายละเอียด (ไม่บังคับ)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                />
              </div>
              <button
                type="button"
                aria-label="ลบ"
                onClick={() => set("schedule", info.schedule.filter((_, j) => j !== i))}
                className="mt-2 text-slate-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        {info.schedule.length < 30 && (
          <button
            type="button"
            onClick={() =>
              set("schedule", [...info.schedule, { id: "", time: info.schedule.at(-1)?.time ?? info.startTime ?? "18:00", title: "", detail: null }])
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm"
          >
            <Plus className="h-4 w-4" /> เพิ่มช่วงเวลา
          </button>
        )}
      </section>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={state === "saving"} className="rounded-xl bg-primary px-6 py-2.5 font-medium text-white hover:bg-primary-hover disabled:opacity-50">
          {state === "saving" ? "กำลังบันทึก…" : "บันทึกรายละเอียดงาน"}
        </button>
        {state === "saved" && <span className="text-sm text-emerald-700">บันทึกแล้ว</span>}
      </div>
    </div>
  );
}
