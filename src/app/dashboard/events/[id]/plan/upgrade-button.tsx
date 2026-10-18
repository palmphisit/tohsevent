"use client";

import { useState } from "react";
import { startUpgradeCheckout } from "@/lib/api-client";

export function UpgradeButton({
  eventId,
  tier,
  priceThb,
  isDifference,
  disabled,
}: {
  eventId: string;
  tier: "standard" | "premium";
  priceThb: number;
  isDifference: boolean;
  disabled: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function upgrade() {
    setPending(true);
    setError(false);
    try {
      window.location.assign(await startUpgradeCheckout(eventId, tier));
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={upgrade}
        disabled={disabled || pending}
        className="w-full rounded-xl bg-primary hover:bg-primary-hover px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
      >
        {pending
          ? "กำลังไปหน้าชำระเงิน…"
          : `อัปเกรด ${priceThb.toLocaleString("th-TH")} ฿${isDifference ? " (จ่ายส่วนต่าง)" : ""}`}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">เริ่มการชำระเงินไม่สำเร็จ ลองอีกครั้ง</p>}
    </>
  );
}
