"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Uploader, type UploadTarget } from "@/components/uploader";
import {
  ApiError,
  completeUpload,
  joinEvent,
  reserveUpload,
  type GuestSession,
  type PublicEvent,
  type PublicPhoto,
} from "@/lib/api-client";
import { Gallery } from "./gallery";

export function GuestApp({ event, initialSession }: { event: PublicEvent; initialSession: GuestSession | null }) {
  const [session, setSession] = useState(initialSession);
  const [displayName, setDisplayName] = useState(initialSession?.displayName ?? "");
  const [uploaded, setUploaded] = useState<PublicPhoto[]>([]);

  // Public events: join silently on first upload so guests can start without any form.
  // Parallel uploads share one in-flight join so only a single guest session is created.
  const joining = useRef<Promise<GuestSession> | null>(null);
  const ensureSession = useCallback(async () => {
    if (session) return session;
    joining.current ??= joinEvent(event.slug, { displayName: displayName || undefined })
      .then(({ session: joined }) => {
        setSession(joined);
        return joined;
      })
      .finally(() => {
        joining.current = null;
      });
    return joining.current;
  }, [session, event.slug, displayName]);

  const onUploaded = useCallback((photo: PublicPhoto) => setUploaded((prev) => [photo, ...prev]), []);
  const uploadTarget = useMemo<UploadTarget>(
    () => ({
      prepare: ensureSession,
      reserve: (image) => reserveUpload(event.slug, image),
      complete: async (photoId) => (await completeUpload(event.slug, photoId)).photo,
    }),
    [ensureSession, event.slug],
  );

  if (event.accessMode === "password" && !session) {
    return <PasswordGate event={event} onJoined={setSession} />;
  }

  const date = new Date(event.date).toLocaleDateString("th-TH", { dateStyle: "long" });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
      <header>
        <p className="text-sm text-zinc-500">{date}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{event.title}</h1>
      </header>

      {event.guestUpload ? (
        <section className="mt-6 space-y-3">
          {!session && (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              placeholder="ชื่อของคุณ (ไม่บังคับ)"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-zinc-900"
            />
          )}
          <Uploader target={uploadTarget} onUploaded={onUploaded} />
        </section>
      ) : (
        <p className="mt-6 rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-600">ปิดรับการอัปโหลดรูปสำหรับงานนี้แล้ว</p>
      )}

      <Gallery slug={event.slug} recentUploads={uploaded} ensureSession={ensureSession} />
    </main>
  );
}

function PasswordGate({ event, onJoined }: { event: PublicEvent; onJoined: (s: GuestSession) => void }) {
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { session } = await joinEvent(event.slug, { password, displayName: displayName || undefined });
      onJoined(session);
    } catch (err) {
      setError(err instanceof ApiError && err.code === "invalid_password" ? "รหัสผ่านไม่ถูกต้อง" : "เกิดข้อผิดพลาด ลองอีกครั้ง");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
      <p className="mt-2 text-sm text-zinc-500">งานนี้ต้องใช้รหัสผ่านเพื่อเข้าชมและอัปโหลดรูป</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          type="password"
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="รหัสผ่านงาน"
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-zinc-900"
        />
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={40}
          placeholder="ชื่อของคุณ (ไม่บังคับ)"
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-zinc-900"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={pending}
          className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {pending ? "กำลังเข้าร่วม…" : "เข้าร่วมงาน"}
        </button>
      </form>
    </main>
  );
}
