"use client";

import { useEffect, useState } from "react";
import {
  createEventInvite,
  listEventMembers,
  removeEventMember,
  revokeEventInvite,
  type InviteView,
  type MemberView,
} from "@/lib/api-client";
import { CopyButton } from "../../_components/copy-button";

/** Owner-only: invite photographers by link and manage who can upload to the event. */
export function MembersPanel({ eventId }: { eventId: string }) {
  const [members, setMembers] = useState<MemberView[]>([]);
  const [invites, setInvites] = useState<InviteView[]>([]);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listEventMembers(eventId)
      .then((data) => {
        if (cancelled) return;
        setMembers(data.members);
        setInvites(data.invites);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function invite() {
    setBusy(true);
    try {
      const created = await createEventInvite(eventId);
      setNewLink(created.url);
      const data = await listEventMembers(eventId);
      setInvites(data.invites);
    } finally {
      setBusy(false);
    }
  }

  async function remove(member: MemberView) {
    if (!window.confirm(`นำ ${member.name} ออกจากงาน?`)) return;
    await removeEventMember(eventId, member.userId);
    setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
  }

  async function revoke(inviteId: string) {
    await revokeEventInvite(eventId, inviteId);
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }

  return (
    <section className="rounded-2xl border border-zinc-200 p-4 sm:p-6">
      <h2 className="text-sm font-medium">ช่างภาพ</h2>
      <p className="mt-1 text-xs text-zinc-500">
        ช่างภาพที่เชิญอัปโหลดรูป Official และไฟล์ต้นฉบับได้ แต่แก้ตั้งค่างาน แพ็กเกจ หรือดูแลรูปของแขกไม่ได้
      </p>

      {members.length > 0 && (
        <ul className="mt-4 divide-y divide-zinc-100">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{m.name}</span>
                <span className="block truncate text-xs text-zinc-500">{m.email}</span>
              </span>
              <button type="button" onClick={() => remove(m)} className="shrink-0 text-xs text-red-600">
                นำออก
              </button>
            </li>
          ))}
        </ul>
      )}

      {newLink && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm">
          <p className="text-emerald-900">ส่งลิงก์นี้ให้ช่างภาพ (ใช้ได้ 1 คน ภายใน 7 วัน)</p>
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-white px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs text-zinc-600">{newLink}</span>
            <CopyButton text={newLink} />
          </div>
        </div>
      )}

      {invites.length > 0 && (
        <p className="mt-3 text-xs text-zinc-500">
          ลิงก์ที่ยังไม่ถูกใช้ {invites.length} ลิงก์ ·{" "}
          {invites.map((i, n) => (
            <button key={i.id} type="button" onClick={() => revoke(i.id)} className="underline">
              ยกเลิกลิงก์ {n + 1}
            </button>
          ))}
        </p>
      )}

      <button
        type="button"
        onClick={invite}
        disabled={busy}
        className="mt-4 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {busy ? "กำลังสร้างลิงก์…" : "+ สร้างลิงก์เชิญช่างภาพ"}
      </button>
    </section>
  );
}
