import Link from "next/link";
import { Suspense } from "react";
import { planOf } from "@/server/models";
import { PLANS, PLAN_TIERS, planRank, PURGE_GRACE_DAYS, upgradePriceThb, type Plan } from "@/server/plans";
import { paymentsEnabled, reconcileCheckout } from "@/server/services/billing";
import { loadHostEventPage } from "../load-event";
import { UpgradeButton } from "./upgrade-button";

export default function EventPlanPage({ params, searchParams }: PageProps<"/dashboard/events/[id]/plan">) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-zinc-100" />}>
        <PlanDetails params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const thb = (n: number) => n.toLocaleString("th-TH");
const longDate = (d: Date) => d.toLocaleDateString("th-TH", { dateStyle: "long", timeZone: "Asia/Bangkok" });

async function PlanDetails({ params, searchParams }: PageProps<"/dashboard/events/[id]/plan">) {
  const { id } = await params;
  const query = await searchParams;
  const checkout = typeof query.checkout === "string" ? query.checkout : null;
  const sessionId = typeof query.session_id === "string" ? query.session_id : null;

  let event = await loadHostEventPage(id);
  let paymentStatus = null;
  if (checkout === "success" && sessionId) {
    paymentStatus = await reconcileCheckout(event, sessionId);
    event = await loadHostEventPage(id);
  }
  const plan = planOf(event);
  const photosUsed = event.usage?.photos ?? event.counters.photos;
  const canPay = paymentsEnabled();

  return (
    <>
      <Link href={`/dashboard/events/${id}`} className="text-sm text-zinc-500 hover:text-zinc-900">
        ← {event.title}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">แพ็กเกจของงาน</h1>

      {checkout === "success" && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {paymentStatus === "paid"
            ? `ชำระเงินเรียบร้อย งานนี้ใช้แพ็กเกจ ${plan.name} แล้ว`
            : "กำลังยืนยันการชำระเงิน (PromptPay อาจใช้เวลาสักครู่) รีเฟรชหน้านี้อีกครั้งในอีกไม่กี่นาที"}
        </p>
      )}
      {checkout === "cancelled" && (
        <p className="mt-4 rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-700">ยกเลิกการชำระเงินแล้ว ยังไม่มีการเรียกเก็บเงิน</p>
      )}
      {event.status === "expired" && !event.purgedAt && (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          อัลบั้มนี้หมดอายุแล้ว แขกเข้าดูไม่ได้ รูปจะถูกลบถาวรภายใน {PURGE_GRACE_DAYS} วันหลังหมดอายุ
          อัปเกรดแพ็กเกจเพื่อเปิดอัลบั้มอีกครั้ง
        </p>
      )}

      <section className="mt-6 rounded-2xl border border-zinc-200 p-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold">แพ็กเกจปัจจุบัน: {plan.name}</h2>
          {event.expiresAt && (
            <p className="text-sm text-zinc-500">
              {event.status === "expired" ? "หมดอายุเมื่อ" : "เปิดให้แขกถึง"} {longDate(event.expiresAt)}
            </p>
          )}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Usage label="แขก" used={event.counters.guests} max={plan.maxGuests} />
          <Usage label="รูปทั้งงาน" used={photosUsed} max={plan.maxPhotos} />
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {PLAN_TIERS.map((tier) => {
          const option = PLANS[tier];
          const current = tier === plan.tier;
          const higher = planRank(tier) > planRank(plan.tier);
          return (
            <PlanCard key={tier} plan={option} current={current}>
              {higher && (
                <UpgradeButton
                  eventId={id}
                  tier={tier as "standard" | "premium"}
                  priceThb={upgradePriceThb(plan.tier, tier)}
                  isDifference={plan.tier !== "free"}
                  disabled={!canPay || !!event.purgedAt}
                />
              )}
            </PlanCard>
          );
        })}
      </div>
      {!canPay && <p className="mt-4 text-sm text-zinc-500">ระบบชำระเงินยังไม่เปิดใช้งานใน environment นี้</p>}
      <p className="mt-4 text-xs text-zinc-500">
        ชำระครั้งเดียวต่องาน ผ่านบัตรเครดิต/เดบิต หรือ PromptPay อายุอัลบั้มนับจากวันจัดงาน (หรือจากวันอัปเกรด ถ้างานผ่านไปแล้ว)
      </p>
    </>
  );
}

function Usage({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-zinc-500">
          {thb(used)} / {thb(max)}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : "bg-zinc-900"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PlanCard({ plan, current, children }: { plan: Plan; current: boolean; children?: React.ReactNode }) {
  return (
    <div className={`flex flex-col rounded-2xl border p-5 ${current ? "border-zinc-900" : "border-zinc-200"}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{plan.name}</h3>
        {current && <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs text-white">ใช้อยู่</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold">
        {plan.priceThb === 0 ? "ฟรี" : `${thb(plan.priceThb)} ฿`}
        {plan.priceThb > 0 && <span className="text-sm font-normal text-zinc-500"> / งาน</span>}
      </p>
      <ul className="mt-4 flex-1 space-y-1.5 text-sm text-zinc-700">
        <li>แขกสูงสุด {thb(plan.maxGuests)} คน</li>
        <li>รูปรวมทั้งงาน {thb(plan.maxPhotos)} รูป</li>
        <li>แขกอัปโหลดได้คนละ {thb(plan.maxPhotosPerGuest)} รูป</li>
        <li>เก็บอัลบั้ม {plan.retentionDays} วันหลังวันงาน</li>
        {plan.branding && <li>Custom Branding + แบนเนอร์ผู้สนับสนุน (เร็ว ๆ นี้)</li>}
      </ul>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
