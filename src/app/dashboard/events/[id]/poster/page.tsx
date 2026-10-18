import Link from "next/link";
import { Suspense } from "react";
import { qrSvg } from "@/server/qr";
import { toHostEvent } from "@/server/services/host-events";
import { loadEventPageForMember } from "../load-event";
import { PrintButton } from "./print-button";

// Printable table-top poster. Hosts print it or "Save as PDF" from the browser print dialog.
export default function PosterPage({ params }: PageProps<"/dashboard/events/[id]/poster">) {
  return (
    <Suspense fallback={null}>
      <Poster params={params} />
    </Suspense>
  );
}

async function Poster({ params }: Pick<PageProps<"/dashboard/events/[id]/poster">, "params">) {
  const { id } = await params;
  const event = toHostEvent((await loadEventPageForMember(id)).event);
  const svg = await qrSvg(event.guestUrl);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 print:max-w-none print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/dashboard/events/${event.id}`} className="text-sm text-slate-500 hover:text-slate-900">
          ← กลับ
        </Link>
        <PrintButton />
      </div>

      <article className="flex aspect-[1/1.414] flex-col items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200 px-10 py-12 text-center print:rounded-none print:border-0">
        <p className="text-sm tracking-[0.2em] text-slate-500 uppercase">Share your photos</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance">{event.title}</h1>
        <div className="mt-8 w-full max-w-[320px]" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-8 text-xl font-medium">สแกนเพื่อแชร์และเซฟรูปในงาน</p>
        <p className="mt-2 text-sm text-slate-500">ไม่ต้องโหลดแอป · ไม่ต้องสมัครสมาชิก</p>
        <p className="mt-6 text-xs break-all text-slate-400">{event.guestUrl}</p>
      </article>
    </main>
  );
}
