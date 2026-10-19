import Link from "next/link";
import { Suspense } from "react";
import { planOf } from "@/server/models";
import { appearanceOf } from "@/server/services/appearance";
import { toBrandingEditorState } from "@/server/services/branding";
import { toPublicEvent } from "@/server/services/events";
import { loadHostEventPage } from "../load-event";
import { AppearanceEditor } from "./appearance-editor";
import { BrandingEditor } from "./branding-editor";

export default function EventBrandingPage({ params }: PageProps<"/dashboard/events/[id]/branding">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-12">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-100" />}>
        <BrandingLoader params={params} />
      </Suspense>
    </main>
  );
}

async function BrandingLoader({ params }: Pick<PageProps<"/dashboard/events/[id]/branding">, "params">) {
  const { id } = await params;
  const event = await loadHostEventPage(id);
  const premium = planOf(event).branding;

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">ปรับแต่งหน้างาน</h1>
      <AppearanceEditor eventId={id} event={toPublicEvent(event)} initial={appearanceOf(event)} />
      <h2 className="mt-12 text-lg font-semibold tracking-tight">
        แบรนด์ของงาน <span className="ml-1 rounded-full bg-primary px-2 py-0.5 align-middle text-xs font-medium text-white">Premium</span>
      </h2>
      <p className="mt-1 text-sm text-slate-500">สีประจำงาน ฟอนต์ โลโก้ รูปปก ข้อความต้อนรับ และผู้สนับสนุน</p>
      {premium ? (
        <BrandingEditor eventId={id} title={event.title} initial={toBrandingEditorState(event)} />
      ) : (
        <div className="mt-6 rounded-2xl bg-white ring-1 ring-slate-200 p-6">
          <p className="font-medium">Custom Branding ใช้ได้กับแพ็กเกจ Premium</p>
          <p className="mt-1 text-sm text-slate-500">
            ใส่สีประจำงาน ฟอนต์ โลโก้ รูปปก ข้อความต้อนรับ และโลโก้ผู้สนับสนุนบนหน้าที่แขกเห็น
          </p>
          <Link
            href={`/dashboard/events/${id}/plan`}
            className="mt-4 inline-block rounded-xl bg-primary hover:bg-primary-hover px-4 py-2.5 text-sm font-medium text-white"
          >
            ดูแพ็กเกจ Premium
          </Link>
        </div>
      )}
    </>
  );
}
