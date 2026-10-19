"use client";

import { ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { BRAND_FONT_CLASS } from "@/app/brand-fonts";
import { LegalFooter } from "@/components/legal-footer";
import { Uploader, type UploadTarget } from "@/components/uploader";
import {
  ApiError,
  completeUpload,
  joinEvent,
  reserveUpload,
  subscribeNotify,
  unsubscribeNotify,
  type GuestSession,
  type PublicEvent,
  type PublicPhoto,
} from "@/lib/api-client";
import { EventHeader, HeroHeader } from "./event-header";
import { Gallery } from "./gallery";
import { showError } from "@/lib/error-popup";

type GuestAppProps = { event: PublicEvent; initialSession: GuestSession | null };

/** Applies the event's branding (Premium: color, font) and look (theme) on a wrapper. */
export function GuestApp(props: GuestAppProps) {
  const branding = props.event.branding;
  const style = branding
    ? ({ "--brand": branding.primaryColor, "--brand-contrast": branding.contrastColor } as React.CSSProperties)
    : undefined;
  return (
    <div
      style={style}
      data-theme={props.event.appearance.theme}
      className={`guest-page flex flex-1 flex-col ${branding ? BRAND_FONT_CLASS[branding.fontId] : ""}`}
    >
      <GuestContent {...props} />
      <LegalFooter />
    </div>
  );
}

function GuestContent({ event, initialSession }: GuestAppProps) {
  const [session, setSession] = useState(initialSession);
  const [displayName, setDisplayName] = useState(initialSession?.displayName ?? "");
  const [uploaded, setUploaded] = useState<PublicPhoto[]>([]);
  const [underReview, setUnderReview] = useState(0);

  // PDPA: a guest session is only created after the guest accepts the privacy notice.
  // Uploads ask through `gate` (keeps the file picker inside the tap); other actions
  // (e.g. reporting a photo) await `askConsent`.
  const [consentOpen, setConsentOpen] = useState(false);
  const consentGiven = useRef(false);
  const pendingPick = useRef<(() => void) | null>(null);
  const consentWaiter = useRef<((accepted: boolean) => void) | null>(null);

  // Several uploads may ask at once: they all wait on the same answer.
  const consentAnswer = useRef<Promise<boolean> | null>(null);
  const askConsent = useCallback(() => {
    if (consentGiven.current) return Promise.resolve(true);
    setConsentOpen(true);
    consentAnswer.current ??= new Promise<boolean>((resolve) => (consentWaiter.current = resolve));
    return consentAnswer.current;
  }, []);

  function answerConsent(accepted: boolean) {
    consentGiven.current = accepted;
    setConsentOpen(false);
    if (accepted) pendingPick.current?.(); // still inside the tap on "accept"
    pendingPick.current = null;
    consentWaiter.current?.(accepted);
    consentWaiter.current = null;
    consentAnswer.current = null;
  }

  const uploadGate = useCallback(
    (openPicker: () => void) => {
      if (session || consentGiven.current) return true;
      pendingPick.current = openPicker;
      setConsentOpen(true);
      return false;
    },
    [session],
  );

  // Public events: join on first upload, without a form beyond the consent notice.
  // Parallel uploads share one in-flight join so only a single guest session is created.
  const joining = useRef<Promise<GuestSession> | null>(null);
  const ensureSession = useCallback(async () => {
    if (session) return session;
    if (!(await askConsent())) throw new ApiError(400, "consent_declined", "Consent declined");
    joining.current ??= joinEvent(event.slug, { displayName: displayName || undefined, consent: true })
      .then(({ session: joined }) => {
        setSession(joined);
        return joined;
      })
      .finally(() => {
        joining.current = null;
      });
    return joining.current;
  }, [session, event.slug, displayName, askConsent]);

  const onUploaded = useCallback((photo: PublicPhoto) => {
    if (photo.pendingReview) setUnderReview((n) => n + 1);
    else setUploaded((prev) => [photo, ...prev]);
  }, []);
  const uploadTarget = useMemo<UploadTarget>(
    () => ({
      prepare: ensureSession,
      watermark: event.watermark,
      video: event.video,
      reserve: (image) => reserveUpload(event.slug, image),
      complete: async (photoId) => (await completeUpload(event.slug, photoId)).photo,
    }),
    [ensureSession, event.slug, event.watermark, event.video],
  );

  if (event.accessMode === "password" && !session) {
    return <PasswordGate event={event} onJoined={setSession} />;
  }

  const date = new Date(event.date).toLocaleDateString("th-TH", { dateStyle: "long" });
  const appearance = event.appearance;

  return (
    <>
      {appearance.header === "hero" && <HeroHeader event={event} date={date} appearance={appearance} />}
      <main className={`mx-auto w-full max-w-3xl px-4 pb-16 ${appearance.header === "hero" ? "relative -mt-8" : "pt-6 sm:pt-8"}`}>
      {appearance.header !== "hero" && <EventHeader event={event} date={date} appearance={appearance} />}
      {event.hasInfo && (
        <Link
          href={`/e/${event.slug}/info`}
          className={`flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 text-sm shadow-sm ring-1 ring-line ${
            appearance.header === "hero" ? "mb-3" : "mt-4"
          }`}
        >
          <span className="flex items-center gap-2 font-medium">
            <MapPin className="h-4 w-4 text-brand" /> รายละเอียดงาน กำหนดการ และแผนที่
          </span>
          <ChevronRight className="h-4 w-4 text-muted" />
        </Link>
      )}

      {event.guestUpload ? (
        <section
          className={`space-y-3 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-line sm:p-5 ${appearance.header === "hero" ? "" : "mt-6"}`}
        >
          {!session && (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              placeholder="ชื่อของคุณ (ไม่บังคับ)"
              className="w-full rounded-xl border border-line px-4 py-3 text-base outline-none focus:border-brand bg-transparent placeholder:text-muted"
            />
          )}
          <Uploader
            target={uploadTarget}
            onUploaded={onUploaded}
            persistKey={`guest:${event.slug}`}
            gate={uploadGate}
            label={appearance.uploadLabel ?? undefined}
          />
          {underReview > 0 && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {underReview} รูปถูกซ่อนไว้ให้เจ้าภาพตรวจสอบก่อนแสดง
            </p>
          )}
          <p className="text-xs text-muted">
            รูปที่อัปโหลดจะแสดงให้ผู้ร่วมงานนี้เห็น ข้อมูลตำแหน่งในรูปถูกลบอัตโนมัติ ·{" "}
            <Link href="/privacy" className="underline">
              นโยบายความเป็นส่วนตัว
            </Link>
          </p>
        </section>
      ) : (
        <p
          className={`rounded-2xl bg-card px-4 py-3 text-sm text-ink/70 shadow-sm ring-1 ring-line ${appearance.header === "hero" ? "" : "mt-6"}`}
        >
          ปิดรับการอัปโหลดรูปสำหรับงานนี้แล้ว
        </p>
      )}

      {event.notifyAvailable && (
        <NotifyMe
          slug={event.slug}
          email={session?.notifyEmail ?? null}
          ensureSession={ensureSession}
          onChange={(notifyEmail) => setSession((s) => (s ? { ...s, notifyEmail } : s))}
        />
      )}

      <Gallery
        slug={event.slug}
        recentUploads={uploaded}
        ensureSession={ensureSession}
        layout={appearance.gallery}
        defaultTab={appearance.defaultTab}
        shareInfo={{
          title: event.title,
          text: `รูปจากงาน ${event.title}`,
          url: typeof window === "undefined" ? `/e/${event.slug}` : `${window.location.origin}/e/${event.slug}`,
        }}
      />
      {event.branding && event.branding.sponsors.length > 0 && <Sponsors sponsors={event.branding.sponsors} />}
      {consentOpen && <ConsentSheet onAnswer={answerConsent} />}
      </main>
    </>
  );
}

/** Opt-in: "email me when the photographer's photos are ready". */
function NotifyMe({
  slug,
  email,
  ensureSession,
  onChange,
}: {
  slug: string;
  email: string | null;
  ensureSession: () => Promise<GuestSession>;
  onChange: (email: string | null) => void;
}) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    try {
      await ensureSession();
      const { notifyEmail } = await subscribeNotify(slug, value);
      onChange(notifyEmail);
      setState("idle");
    } catch {
      setState("idle");
      showError("บันทึกอีเมลไม่สำเร็จ ลองอีกครั้ง");
    }
  }

  async function unsubscribe() {
    setState("saving");
    try {
      await unsubscribeNotify(slug);
      onChange(null);
      setState("idle");
    } catch {
      setState("idle");
      showError("บันทึกอีเมลไม่สำเร็จ ลองอีกครั้ง");
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-line p-4 bg-transparent placeholder:text-muted">
      {email ? (
        <p className="text-sm text-ink/85">
          เราจะแจ้งไปที่ <b>{email}</b> เมื่อรูปจากช่างภาพพร้อม ·{" "}
          <button type="button" onClick={unsubscribe} disabled={state === "saving"} className="underline">
            ยกเลิก
          </button>
        </p>
      ) : (
        <form onSubmit={subscribe}>
          <p className="text-sm font-medium">อยากได้รูปจากช่างภาพ? ให้เราแจ้งทางอีเมล</p>
          <div className="mt-2 flex gap-2">
            <input
              type="email"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="อีเมลของคุณ"
              autoComplete="email"
              className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-base outline-none focus:border-brand bg-transparent placeholder:text-muted"
            />
            <button
              disabled={state === "saving"}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast disabled:opacity-50"
            >
              แจ้งฉัน
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            ใช้ส่งแจ้งเตือนของงานนี้เท่านั้น ยกเลิกได้ทุกเมื่อ และลบเมื่ออัลบั้มหมดอายุ
          </p>
        </form>
      )}
    </section>
  );
}

function ConsentSheet({ onAnswer }: { onAnswer: (accepted: boolean) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => onAnswer(false)}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl bg-card p-5 sm:rounded-2xl"
      >
        <h2 className="text-lg font-semibold">ก่อนแชร์รูป</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink/85">
          <li>รูปที่คุณอัปโหลดจะแสดงให้ผู้ร่วมงานนี้และเจ้าภาพเห็น และเก็บไว้ตามระยะเวลาของงาน</li>
          <li>ระบบลบข้อมูลตำแหน่ง (GPS) ออกจากรูปก่อนอัปโหลด</li>
          <li>คุณลบรูปของตัวเองได้ทุกเมื่อ และขอให้ลบรูปที่มีคุณอยู่ได้</li>
          <li>โปรดอัปโหลดเฉพาะรูปที่เหมาะสมและคนในรูปยินดีให้แชร์</li>
        </ul>
        <p className="mt-3 text-xs text-muted">
          อ่านรายละเอียดใน{" "}
          <Link href="/privacy" target="_blank" className="underline">
            นโยบายความเป็นส่วนตัว
          </Link>{" "}
          และ{" "}
          <Link href="/terms" target="_blank" className="underline">
            ข้อกำหนดการใช้งาน
          </Link>
        </p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => onAnswer(false)} className="flex-1 rounded-xl border border-line py-3 bg-transparent placeholder:text-muted">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => onAnswer(true)}
            className="flex-1 rounded-xl bg-brand py-3 font-medium text-brand-contrast"
          >
            ยอมรับและเลือกรูป
          </button>
        </div>
      </div>
    </div>
  );
}

function Sponsors({ sponsors }: { sponsors: NonNullable<PublicEvent["branding"]>["sponsors"] }) {
  return (
    <section className="mt-12 border-t border-line pt-6">
      <h2 className="text-center text-sm text-muted">ขอบคุณผู้สนับสนุน</h2>
      <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-5">
        {sponsors.map((sponsor) => {
          const logo = (
            // eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN
            <img src={sponsor.imageUrl} alt={sponsor.name} title={sponsor.name} className="h-12 w-auto max-w-[160px] object-contain" />
          );
          return (
            <li key={sponsor.id}>
              {sponsor.linkUrl ? (
                <a href={sponsor.linkUrl} target="_blank" rel="sponsored noopener">
                  {logo}
                </a>
              ) : (
                logo
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PasswordGate({ event, onJoined }: { event: PublicEvent; onJoined: (s: GuestSession) => void }) {
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const { session } = await joinEvent(event.slug, { password, displayName: displayName || undefined, consent: true });
      onJoined(session);
    } catch (err) {
      showError(
        err instanceof ApiError && err.code === "invalid_password"
          ? "รหัสผ่านไม่ถูกต้อง"
          : err instanceof ApiError && err.code === "event_full"
            ? "งานนี้มีแขกครบจำนวนแล้ว"
            : "เกิดข้อผิดพลาด ลองอีกครั้ง",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
      <p className="mt-2 text-sm text-muted">งานนี้ต้องใช้รหัสผ่านเพื่อเข้าชมและอัปโหลดรูป</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          type="password"
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="รหัสผ่านงาน"
          className="w-full rounded-xl border border-line px-4 py-3 text-base outline-none focus:border-brand bg-transparent placeholder:text-muted"
        />
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={40}
          placeholder="ชื่อของคุณ (ไม่บังคับ)"
          className="w-full rounded-xl border border-line px-4 py-3 text-base outline-none focus:border-brand bg-transparent placeholder:text-muted"
        />
        <label className="flex items-start gap-2 text-sm text-ink/70">
          <input
            type="checkbox"
            required
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1 accent-primary"
          />
          <span>
            ฉันยอมรับ{" "}
            <Link href="/privacy" target="_blank" className="underline">
              นโยบายความเป็นส่วนตัว
            </Link>{" "}
            และเข้าใจว่ารูปที่อัปโหลดจะแสดงให้ผู้ร่วมงานนี้เห็น
          </span>
        </label>
        <button
          disabled={pending || !accepted}
          className="w-full rounded-xl bg-brand px-4 py-3 font-medium text-brand-contrast disabled:opacity-50"
        >
          {pending ? "กำลังเข้าร่วม…" : "เข้าร่วมงาน"}
        </button>
      </form>
    </main>
  );
}
