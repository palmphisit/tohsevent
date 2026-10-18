import Link from "next/link";
import { Suspense } from "react";
import { requireHostPage } from "@/server/auth";
import { findInvite } from "@/server/services/members";
import { AcceptInviteButton } from "./accept-invite-button";

export const metadata = { title: "คำเชิญช่างภาพ · Tohs Event" };

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-zinc-100" />}>
        <Invite params={params} />
      </Suspense>
    </main>
  );
}

async function Invite({ params }: Pick<PageProps<"/invite/[token]">, "params">) {
  const { token } = await params;
  const user = await requireHostPage(`/invite/${token}`);
  const found = await findInvite(token);

  if (!found) {
    return (
      <div className="text-center">
        <h1 className="text-xl font-semibold">ลิงก์เชิญใช้ไม่ได้</h1>
        <p className="mt-2 text-sm text-zinc-500">ลิงก์อาจหมดอายุหรือถูกใช้ไปแล้ว ขอลิงก์ใหม่จากเจ้าภาพ</p>
        <Link href="/dashboard" className="mt-6 inline-block text-sm underline">
          ไปที่งานของฉัน
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 p-6">
      <p className="text-sm text-zinc-500">คุณได้รับเชิญเป็นช่างภาพของงาน</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{found.event.title}</h1>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-zinc-600">
        <li>อัปโหลดรูป Official และไฟล์ต้นฉบับเข้างานนี้</li>
        <li>ดาวน์โหลดรูปของงาน</li>
        <li>ไม่สามารถแก้ไขตั้งค่างานหรือแพ็กเกจ</li>
      </ul>
      <p className="mt-4 text-sm">
        เข้าร่วมในชื่อ <b>{user.name}</b> ({user.email})
      </p>
      <AcceptInviteButton token={token} />
    </div>
  );
}
