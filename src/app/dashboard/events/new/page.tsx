import Link from "next/link";
import { Suspense } from "react";
import { EventForm } from "../../_components/event-form";

export default function NewEventPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
        ← งานของฉัน
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold tracking-tight">สร้างงานใหม่</h1>
      {/* Suspense: the form defaults the date to "today", which must be computed per visit. */}
      <Suspense>
        <EventForm />
      </Suspense>
    </main>
  );
}
