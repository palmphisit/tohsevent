"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { acceptInvite } from "@/lib/api-client";
import { showError } from "@/lib/error-popup";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");
  return (
    <>
      <button
        type="button"
        disabled={state === "pending"}
        onClick={async () => {
          setState("pending");
          try {
            const { eventId } = await acceptInvite(token);
            router.push(`/dashboard/events/${eventId}/photos`);
          } catch {
            setState("idle");
            showError("เข้าร่วมไม่สำเร็จ ลิงก์อาจหมดอายุหรือถูกใช้ไปแล้ว");
          }
        }}
        className="mt-6 w-full rounded-xl bg-primary hover:bg-primary-hover px-4 py-3 font-medium text-white disabled:opacity-50"
      >
        {state === "pending" ? "กำลังเข้าร่วม…" : "เข้าร่วมเป็นช่างภาพ"}
      </button>
    </>
  );
}
