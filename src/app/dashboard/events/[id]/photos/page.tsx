import Link from "next/link";
import { Suspense } from "react";
import { planOf } from "@/server/models";
import { countOpenReports } from "@/server/services/moderation";
import { loadHostEventPage } from "../load-event";
import { PhotoModeration } from "./photo-moderation";

export default function EventPhotosPage({ params }: PageProps<"/dashboard/events/[id]/photos">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-zinc-100" />}>
        <PhotosLoader params={params} />
      </Suspense>
    </main>
  );
}

async function PhotosLoader({ params }: Pick<PageProps<"/dashboard/events/[id]/photos">, "params">) {
  const { id } = await params;
  const event = await loadHostEventPage(id);
  const openReports = await countOpenReports(event);

  return (
    <>
      <Link href={`/dashboard/events/${id}`} className="text-sm text-zinc-500 hover:text-zinc-900">
        ← {event.title}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">จัดการรูปภาพ</h1>
      <PhotoModeration eventId={id} openReports={openReports} watermark={planOf(event).watermark} />
    </>
  );
}
