import type { HostEvent } from "@/server/services/host-events";

const LABELS: Record<HostEvent["status"], { text: string; className: string }> = {
  live: { text: "เปิดอยู่", className: "bg-emerald-100 text-emerald-800" },
  closed: { text: "ปิดแล้ว", className: "bg-slate-200 text-slate-700" },
  draft: { text: "ฉบับร่าง", className: "bg-amber-100 text-amber-800" },
  expired: { text: "หมดอายุ", className: "bg-slate-200 text-slate-500" },
};

export function StatusBadge({ status }: { status: HostEvent["status"] }) {
  const label = LABELS[status];
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${label.className}`}>{label.text}</span>;
}
