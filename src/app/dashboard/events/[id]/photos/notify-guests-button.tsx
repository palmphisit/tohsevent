"use client";

import { useState } from "react";
import { notifyGuests } from "@/lib/api-client";
import { showError } from "@/lib/error-popup";

export function NotifyGuestsButton({ eventId, pending }: { eventId: string; pending: number }) {
  const [remaining, setRemaining] = useState(pending);
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [sent, setSent] = useState<number | null>(null);

  async function send() {
    if (!window.confirm(`ส่งอีเมลแจ้งแขก ${remaining} คนว่ารูปพร้อมแล้ว?`)) return;
    setState("sending");
    try {
      const result = await notifyGuests(eventId);
      setSent(result.sent);
      setRemaining(0);
      setState("idle");
    } catch {
      setState("idle");
      showError("ส่งอีเมลแจ้งแขกไม่สำเร็จ ลองอีกครั้ง");
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-white ring-1 ring-slate-200 px-4 py-3 text-sm">
      <span className="flex-1">
        {remaining > 0
          ? `มีแขก ${remaining} คนขอรับอีเมลเมื่อรูปจากช่างภาพพร้อม`
          : sent !== null
            ? `ส่งอีเมลแจ้งแขกแล้ว ${sent} คน`
            : "ยังไม่มีแขกที่รอรับอีเมลแจ้งเตือน"}
      </span>
      {remaining > 0 && (
        <button
          type="button"
          onClick={send}
          disabled={state === "sending"}
          className="rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {state === "sending" ? "กำลังส่ง…" : "แจ้งแขกทางอีเมล"}
        </button>
      )}
    </div>
  );
}
