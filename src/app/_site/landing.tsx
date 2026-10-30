import {
  ArrowRight,
  Building2,
  Camera,
  Check,
  Download,
  Heart,
  ImagePlay,
  Images,
  Music,
  Palette,
  PartyPopper,
  QrCode,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { BrandLogo, BrandMark } from "@/components/brand";
import { LanguageSwitch } from "@/components/language-switch";
import { HeaderAuth } from "./header-auth";
import { CUSTOM_PLAN } from "@/lib/custom-plan";
import { INTL_LOCALE, localePath, type Locale } from "@/lib/i18n";
import { LEGAL } from "@/lib/legal";
import { SITE, SITE_COPY } from "@/lib/site";
import { PLANS, PLAN_TIERS } from "@/server/plans";

// The public home page, rendered in English at "/" and Thai at "/th".

const ICONS = {
  steps: [QrCode, ScanLine, Images],
  features: [Smartphone, ImagePlay, Camera, Users, Palette, ShieldCheck, Download, Sparkles],
  uses: [Heart, Building2, PartyPopper, Music],
};

type Item = { title: string; text: string };

const COPY = {
  en: {
    nav: [
      ["#how", "How it works"],
      ["#features", "Features"],
      ["#pricing", "Pricing"],
      ["#faq", "FAQ"],
    ],
    signIn: "Sign in",
    dashboard: "My events",
    newEvent: "Create an event",
    startFree: "Create an event free",
    heroBadge: "Event photo sharing with a QR code",
    heroTitle: ["Every photo from guests and photographers,", "in one album"],
    heroText:
      "Guests scan a QR code to shoot, upload and save photos instantly: no app, no sign-up. You get every angle of the event without chasing anyone for pictures.",
    demo: "See the guest page",
    heroPoints: ["Free for small events", "Card & PromptPay", "GPS removed from photos automatically"],
    stepsEyebrow: "3 simple steps",
    stepsTitle: "From a QR scan to a complete album",
    steps: [
      { title: "Create the event, print the QR", text: "Set up an event in a minute and get a QR code plus a print-ready table poster." },
      { title: "Guests scan and share", text: "Guests open their phone camera, scan, then shoot or pick photos and upload. No app needed." },
      { title: "Every photo in one place", text: "Guest and photographer shots land in one album to view, save and download in full." },
    ] as Item[],
    featuresEyebrow: "Features",
    featuresTitle: "Everything your event needs",
    features: [
      { title: "No app, no sign-up", text: "Works in the browser on any phone, so guests of every age can join right away." },
      { title: "Photos and videos", text: "Guests share photos and short clips; images are resized automatically for fast uploads." },
      { title: "Official + guest albums", text: "Separate tabs for your professional photographer and for candid guest shots." },
      { title: "Photographer team", text: "Invite photographers with a link; they can upload full-resolution originals." },
      { title: "Your event's brand", text: "Colors, fonts, logo, cover image and sponsor logos make the page yours." },
      { title: "Full moderation", text: "Hide or delete instantly, AI screens unsuitable photos, guests can ask to be removed." },
      { title: "Download the album", text: "Get every photo as a full-resolution ZIP, watermark-free on paid plans." },
      { title: "Privacy built in", text: "GPS stripped from photos, consent before upload, and albums auto-delete on schedule." },
    ] as Item[],
    usesEyebrow: "For every occasion",
    usesTitle: "From small parties to big events",
    uses: [
      { title: "Weddings", text: "Angles your photographer missed, from friends and family at every table." },
      { title: "Seminars & corporate", text: "Collect activity photos with your company and sponsor logos." },
      { title: "Parties & birthdays", text: "Everyone shares instantly; no more asking one by one." },
      { title: "Concerts & events", text: "Show the atmosphere and keep memories from every attendee." },
    ] as Item[],
    pricingEyebrow: "Pricing",
    pricingTitle: "Pay once per event. No subscription.",
    pricingText: "Start free and upgrade when you need to; your photos stay. Pay by card or PromptPay.",
    popular: "Most popular",
    free: "Free",
    perEvent: " / event",
    guests: (n: string) => `Up to ${n} guests`,
    files: (n: string, video: boolean): string => (video ? `${n} photos & videos in total` : `${n} photos in total`),
    video: (min: number | null): string => (min ? `Videos up to ${min} min each` : "Photos only"),
    retention: (d: number) => `Album kept ${d} days`,
    watermark: (w: boolean): string => (w ? "Tohs Event watermark" : "No watermark"),
    branding: "Your branding & sponsors",
    originals: "Photographer originals",
    startPlan: (name: string, free: boolean): string => (free ? "Start free" : `Choose ${name}`),
    customFrom: "From ",
    customPoints: [
      "Choose guests, photos and videos",
      "Choose storage and how long to keep it",
      "No file size limit (up to 5 GB per file)",
      "Videos up to 3 hours",
      "Everything in Premium",
      "Instant price as you choose",
    ],
    customCta: "Get a quote",
    proSoon: "Photographers and organizers with several events a month: a monthly Pro plan is coming soon.",
    faqEyebrow: "FAQ",
    faqTitle: "Questions? We have answers.",
    faq: [
      { q: "Do guests need an app or an account?", a: "No. Guests scan the QR code with their phone camera and upload in the browser right away, on iPhone and Android." },
      {
        q: "How sharp are guest photos?",
        a: "Photos are resized to 2,560 pixels on the long side so uploads are fast and look great on any screen. Photographers can upload full-resolution originals on Premium.",
      },
      {
        q: "Can guests upload videos?",
        a: "Yes, on Standard and Premium (up to 1 minute per clip on Standard, 3 minutes on Premium). Free supports photos only.",
      },
      {
        q: "Who can see the photos?",
        a: "Anyone with the event's QR code or link. You can set a password, and album pages are never indexed by Google.",
      },
      {
        q: "What about inappropriate photos?",
        a: "Hosts can hide or delete any photo instantly from the dashboard, guests can report or ask to remove photos of themselves, and AI helps screen uploads.",
      },
      {
        q: "How long does the album stay online?",
        a: `Depending on the plan, ${PLANS.free.retentionDays} to ${PLANS.premium.retentionDays} days after the event. We email you before it expires and you can download everything.`,
      },
      { q: "How do I pay?", a: "Once per event, by credit/debit card or PromptPay. Upgrade from Free any time; existing photos stay." },
    ],
    ctaTitle: "Ready to keep every moment of your event?",
    ctaText: "Create your first event free in under a minute. No credit card needed.",
    privacy: "Privacy policy",
    terms: "Terms of use",
    mockDate: "12 December 2026",
    mockTitle: "Ton & Fon's Wedding",
    mockUpload: "Take / choose photos",
    mockScan: "Scan to upload",
  },
  th: {
    nav: [
      ["#how", "วิธีใช้งาน"],
      ["#features", "ฟีเจอร์"],
      ["#pricing", "ราคา"],
      ["#faq", "คำถาม"],
    ],
    signIn: "เข้าสู่ระบบ",
    dashboard: "งานของฉัน",
    newEvent: "สร้างงานใหม่",
    startFree: "สร้างงานฟรี",
    heroBadge: "แชร์รูปงานอีเวนต์ด้วย QR Code",
    heroTitle: ["รวมทุกรูปจากแขกและช่างภาพ", "ไว้ในอัลบั้มเดียว"],
    heroText:
      "แขกสแกน QR แล้วถ่าย อัปโหลด และเซฟรูปได้ทันที ไม่ต้องโหลดแอป ไม่ต้องสมัครสมาชิก เจ้าภาพได้ทุกมุมของงานโดยไม่ต้องตามขอรูปทีละคน",
    demo: "ดูตัวอย่างหน้าแขก",
    heroPoints: ["ใช้ฟรีสำหรับงานเล็ก", "รองรับ PromptPay", "ลบ GPS ออกจากรูปอัตโนมัติ"],
    stepsEyebrow: "ใช้งานง่าย 3 ขั้นตอน",
    stepsTitle: "จากสแกน QR ถึงอัลบั้มที่สมบูรณ์",
    steps: [
      { title: "สร้างงานและพิมพ์ QR", text: "สร้างงานใน 1 นาที ได้ QR Code และโปสเตอร์พร้อมพิมพ์วางบนโต๊ะทันที" },
      { title: "แขกสแกนแล้วแชร์", text: "แขกเปิดกล้องมือถือสแกน ถ่ายหรือเลือกรูปแล้วอัปโหลดได้เลย ไม่ต้องโหลดแอป" },
      { title: "ได้ทุกรูปในที่เดียว", text: "รูปจากแขกและช่างภาพรวมในอัลบั้มเดียว ดู เซฟ และดาวน์โหลดทั้งอัลบั้มได้" },
    ] as Item[],
    featuresEyebrow: "ฟีเจอร์",
    featuresTitle: "ทุกอย่างที่งานของคุณต้องการ",
    features: [
      { title: "ไม่ต้องโหลดแอป ไม่ต้องสมัคร", text: "เปิดผ่านเบราว์เซอร์บนมือถือทุกรุ่น แขกทุกวัยใช้ได้ทันที" },
      { title: "รูปและวิดีโอ", text: "แขกแชร์ได้ทั้งรูปและคลิปสั้น ระบบย่อรูปให้อัตโนมัติ อัปเร็วแม้เน็ตไม่แรง" },
      { title: "อัลบั้ม Official + แขก", text: "แยกแท็บรูปจากช่างภาพมืออาชีพกับรูปบรรยากาศจากแขกให้ดูง่าย" },
      { title: "ทีมช่างภาพ", text: "เชิญช่างภาพเข้างานด้วยลิงก์ อัปไฟล์ต้นฉบับความละเอียดเต็มได้" },
      { title: "ใส่แบรนด์ของงาน", text: "สี ฟอนต์ โลโก้ รูปปก และโลโก้ผู้สนับสนุน ให้หน้างานเป็นของคุณ" },
      { title: "ดูแลรูปได้เต็มที่", text: "ซ่อนหรือลบรูปได้ทันที AI ช่วยกรองรูปไม่เหมาะสม แขกขอให้ลบรูปตัวเองได้" },
      { title: "ดาวน์โหลดทั้งอัลบั้ม", text: "เก็บทุกรูปเป็นไฟล์ ZIP ความละเอียดเต็ม ไม่มีลายน้ำในแพ็กเกจเสียเงิน" },
      { title: "ปลอดภัยตาม PDPA", text: "ลบตำแหน่ง GPS ออกจากรูป ขอความยินยอมก่อนอัปโหลด และตั้งเวลาลบอัลบั้มอัตโนมัติ" },
    ] as Item[],
    usesEyebrow: "เหมาะกับทุกงาน",
    usesTitle: "ใช้ได้ตั้งแต่ปาร์ตี้เล็ก ๆ ถึงอีเวนต์ใหญ่",
    uses: [
      { title: "งานแต่งงาน", text: "ได้รูปมุมที่ช่างภาพไม่เห็น จากเพื่อนและญาติทุกโต๊ะ" },
      { title: "สัมมนา / องค์กร", text: "รวบรวมภาพกิจกรรม ใส่โลโก้บริษัทและผู้สนับสนุน" },
      { title: "ปาร์ตี้ / วันเกิด", text: "ทุกคนแชร์ภาพได้ทันที ไม่ต้องตามขอทีละคน" },
      { title: "คอนเสิร์ต / อีเวนต์", text: "ฉายภาพบรรยากาศและเก็บความทรงจำจากผู้ร่วมงาน" },
    ] as Item[],
    pricingEyebrow: "ราคา",
    pricingTitle: "จ่ายครั้งเดียวต่องาน ไม่มีรายเดือน",
    pricingText: "เริ่มฟรี แล้วอัปเกรดเมื่อต้องการ รูปเดิมยังอยู่ครบ ชำระด้วยบัตรหรือ PromptPay",
    popular: "ยอดนิยม",
    free: "ฟรี",
    perEvent: " / งาน",
    guests: (n: string) => `แขกสูงสุด ${n} คน`,
    files: (n: string, video: boolean): string => (video ? `รูปและวิดีโอรวม ${n} ไฟล์` : `รูปรวม ${n} รูป`),
    video: (min: number | null): string => (min ? `วิดีโอคลิปละไม่เกิน ${min} นาที` : "รูปภาพเท่านั้น"),
    retention: (d: number) => `เก็บอัลบั้ม ${d} วัน`,
    watermark: (w: boolean): string => (w ? "รูปมีลายน้ำ Tohs Event" : "ไม่มีลายน้ำ"),
    branding: "ใส่แบรนด์และผู้สนับสนุน",
    originals: "ไฟล์ต้นฉบับจากช่างภาพ",
    startPlan: (name: string, free: boolean): string => (free ? "เริ่มใช้ฟรี" : `เลือก ${name}`),
    customFrom: "เริ่ม ",
    customPoints: [
      "เลือกจำนวนแขก รูปและวิดีโอ เองได้",
      "เลือกพื้นที่จัดเก็บและระยะเวลาเก็บเอง",
      "ไม่จำกัดขนาดไฟล์ (สูงสุด 5 GB ต่อไฟล์)",
      "วิดีโอยาวสูงสุด 3 ชั่วโมง",
      "ทุกอย่างของ Premium",
      "ราคาประเมินทันทีตามที่เลือก",
    ],
    customCta: "ประเมินราคา",
    proSoon: "ช่างภาพและออร์แกไนเซอร์ที่ทำหลายงานต่อเดือน: แพ็กเกจ Pro รายเดือนกำลังจะเปิดเร็ว ๆ นี้",
    faqEyebrow: "คำถามที่พบบ่อย",
    faqTitle: "มีคำถาม? เรามีคำตอบ",
    faq: [
      { q: "แขกต้องโหลดแอปหรือสมัครสมาชิกไหม?", a: "ไม่ต้อง แขกสแกน QR Code ด้วยกล้องมือถือ แล้วอัปโหลดผ่านเบราว์เซอร์ได้ทันที ใช้ได้ทั้ง iPhone และ Android" },
      {
        q: "รูปที่แขกอัปโหลดคมชัดแค่ไหน?",
        a: "ระบบย่อรูปเหลือด้านยาว 2,560 พิกเซลเพื่อให้อัปเร็วและดูสวยบนทุกจอ ส่วนช่างภาพอัปไฟล์ต้นฉบับความละเอียดเต็มได้ในแพ็กเกจ Premium",
      },
      {
        q: "อัปโหลดวิดีโอได้ไหม?",
        a: "ได้ในแพ็กเกจ Standard และ Premium (Standard คลิปละไม่เกิน 1 นาที, Premium ไม่เกิน 3 นาที) แพ็กเกจ Free รองรับเฉพาะรูปภาพ",
      },
      { q: "ใครดูรูปในงานได้บ้าง?", a: "ผู้ที่มี QR Code หรือลิงก์ของงาน คุณตั้งรหัสผ่านให้งานได้ และหน้าอัลบั้มจะไม่ถูกค้นเจอบน Google" },
      {
        q: "ถ้ามีรูปที่ไม่เหมาะสมจะทำอย่างไร?",
        a: "เจ้าภาพซ่อนหรือลบรูปได้ทันทีจาก dashboard แขกกดรายงานหรือขอให้ลบรูปที่มีตัวเองได้ และมี AI ช่วยกรองรูปไม่เหมาะสม",
      },
      {
        q: "อัลบั้มอยู่ได้นานแค่ไหน?",
        a: `ตามแพ็กเกจ ตั้งแต่ ${PLANS.free.retentionDays} ถึง ${PLANS.premium.retentionDays} วันหลังวันงาน เราจะส่งอีเมลเตือนก่อนหมดอายุ และคุณดาวน์โหลดทั้งอัลบั้มเก็บไว้ได้`,
      },
      { q: "ชำระเงินอย่างไร?", a: "จ่ายครั้งเดียวต่องาน ผ่านบัตรเครดิต/เดบิต หรือ PromptPay อัปเกรดจาก Free ได้ทุกเมื่อ รูปเดิมไม่หาย" },
    ],
    ctaTitle: "พร้อมเก็บทุกช่วงเวลาของงานคุณแล้วหรือยัง?",
    ctaText: "สร้างงานแรกได้ฟรีภายในไม่ถึงนาที ไม่ต้องใช้บัตรเครดิต",
    privacy: "นโยบายความเป็นส่วนตัว",
    terms: "ข้อกำหนดการใช้งาน",
    mockDate: "12 ธันวาคม 2569",
    mockTitle: "งานแต่งงาน ต้น & ฝน",
    mockUpload: "ถ่ายรูป / เลือกรูป",
    mockScan: "สแกนแล้วอัปได้เลย",
  },
};

type Copy = (typeof COPY)["en"];


function videoMinutes(tier: (typeof PLAN_TIERS)[number]): number | null {
  const video = PLANS[tier].video;
  return video ? Math.round(video.maxDurationSec / 60) : null;
}

export function Landing({ locale }: { locale: Locale }) {
  const t: Copy = COPY[locale];
  const thb = (n: number) => n.toLocaleString(INTL_LOCALE[locale]);
  const START_HREF = localePath(locale, "/login") + "?next=/dashboard/events/new";
  const STEPS = t.steps.map((s, i) => ({ ...s, icon: ICONS.steps[i] }));
  const FEATURES = t.features.map((s, i) => ({ ...s, icon: ICONS.features[i] }));
  const USE_CASES = t.uses.map((s, i) => ({ ...s, icon: ICONS.uses[i] }));
  const FAQ = t.faq;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE.name,
      url: SITE.url,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web, iOS, Android",
      description: SITE_COPY[locale].description,
      offers: [
        ...PLAN_TIERS.map((tier) => ({
          "@type": "Offer",
          name: PLANS[tier].name,
          price: PLANS[tier].priceThb,
          priceCurrency: "THB",
        })),
        { "@type": "Offer", name: "Custom", price: CUSTOM_PLAN.basePriceThb, priceCurrency: "THB" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader t={t} locale={locale} startHref={START_HREF} />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary-soft via-white to-white">
          <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-sky-200/50 blur-3xl" />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-14 pb-20 md:grid-cols-[1.1fr_0.9fr] md:pt-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm text-primary-ink shadow-sm ring-1 ring-blue-100">
                <Sparkles className="h-4 w-4 text-accent" /> {t.heroBadge}
              </p>
              <h1 className="mt-5 text-4xl leading-tight font-semibold tracking-tight text-balance text-slate-900 md:text-5xl">
                {t.heroTitle[0]} <span className="text-primary">{t.heroTitle[1]}</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-slate-600">
                {t.heroText}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={START_HREF}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-medium text-white shadow-lg shadow-blue-600/20 hover:bg-primary-hover"
                >
                  {t.startFree} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={localePath(locale, "/e/demo")}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-medium text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300"
                >
                  {t.demo}
                </Link>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                {t.heroPoints.map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-primary" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <PhoneMockup t={t} />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20">
          <SectionTitle eyebrow={t.stepsEyebrow} title={t.stepsTitle} />
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="relative rounded-2xl border border-slate-200 bg-white p-6">
                <span className="absolute top-6 right-6 text-5xl font-semibold text-slate-100">{i + 1}</span>
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-slate-600">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 bg-slate-50 py-20">
          <div className="mx-auto w-full max-w-6xl px-4">
            <SectionTitle eyebrow={t.featuresEyebrow} title={t.featuresTitle} />
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
                  <Icon className="h-6 w-6 text-primary" />
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20">
          <SectionTitle eyebrow={t.usesEyebrow} title={t.usesTitle} />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-slate-200 p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 bg-slate-50 py-20">
          <div className="mx-auto w-full max-w-6xl px-4">
            <SectionTitle eyebrow={t.pricingEyebrow} title={t.pricingTitle} />
            <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
              {t.pricingText}
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {PLAN_TIERS.map((tier) => {
                const plan = PLANS[tier];
                const featured = tier === "standard";
                return (
                  <div
                    key={tier}
                    className={`relative flex flex-col rounded-2xl bg-white p-7 ${
                      featured ? "shadow-xl shadow-blue-600/10 ring-2 ring-primary" : "ring-1 ring-slate-200"
                    }`}
                  >
                    {featured && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
                        {t.popular}
                      </span>
                    )}
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <p className="mt-3 text-4xl font-semibold tracking-tight">
                      {plan.priceThb === 0 ? t.free : `฿${thb(plan.priceThb)}`}
                      {plan.priceThb > 0 && <span className="text-base font-normal text-slate-500">{t.perEvent}</span>}
                    </p>
                    <ul className="mt-6 flex-1 space-y-2.5 text-sm text-slate-700">
                      {[
                        t.guests(thb(plan.maxGuests)),
                        t.files(thb(plan.maxPhotos), !!plan.video),
                        t.video(videoMinutes(tier)),
                        t.retention(plan.retentionDays),
                        t.watermark(plan.watermark),
                        ...(plan.branding ? [t.branding] : []),
                        ...(plan.originals ? [t.originals] : []),
                      ].map((f) => (
                        <li key={f} className="flex gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={START_HREF}
                      className={`mt-7 rounded-xl px-4 py-3 text-center font-medium ${
                        featured ? "bg-primary text-white hover:bg-primary-hover" : "bg-primary-soft text-primary-ink hover:bg-blue-100"
                      }`}
                    >
                      {t.startPlan(plan.name, plan.priceThb === 0)}
                    </Link>
                  </div>
                );
              })}
              <div className="relative flex flex-col rounded-2xl bg-gradient-to-br from-primary-ink via-primary to-accent p-7 text-white shadow-xl shadow-blue-600/20">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <Sparkles className="h-5 w-5" /> Custom
                </h3>
                <p className="mt-3 text-4xl font-semibold tracking-tight">
                  <span className="text-base font-normal text-blue-100">{t.customFrom}</span>฿{thb(CUSTOM_PLAN.basePriceThb)}
                  <span className="text-base font-normal text-blue-100">{t.perEvent}</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-blue-50">
                  {t.customPoints.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href={START_HREF} className="mt-7 rounded-xl bg-white px-4 py-3 text-center font-medium text-primary-ink hover:bg-blue-50">
                  {t.customCta}
                </Link>
              </div>
            </div>
            <p className="mt-8 text-center text-sm text-slate-500">
              {t.proSoon}
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-20 px-4 py-20">
          <SectionTitle eyebrow={t.faqEyebrow} title={t.faqTitle} />
          <div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {q}
                  <span className="text-xl text-primary transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 pb-20">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center rounded-3xl bg-gradient-to-br from-primary to-accent px-6 py-14 text-center text-white">
            <Upload className="h-10 w-10 opacity-90" />
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance">{t.ctaTitle}</h2>
            <p className="mt-3 max-w-xl text-blue-50">{t.ctaText}</p>
            <Link
              href={START_HREF}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-medium text-primary-ink hover:bg-blue-50"
            >
              {t.startFree} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <BrandMark className="h-6 w-6" /> © {LEGAL.version.slice(0, 4)} {SITE.name}
          </span>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href={localePath(locale, "/privacy")} className="hover:text-slate-900">
              {t.privacy}
            </Link>
            <Link href={localePath(locale, "/terms")} className="hover:text-slate-900">
              {t.terms}
            </Link>
            <a href={`mailto:${LEGAL.contactEmail}`} className="hover:text-slate-900">
              {LEGAL.contactEmail}
            </a>
          </nav>
        </div>
      </footer>
    </>
  );
}

function SiteHeader({ t, locale, startHref }: { t: Copy; locale: Locale; startHref: string }) {
  const links = t.nav;
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <BrandLogo href={localePath(locale, "/")} />
        <nav className="hidden items-center gap-7 text-sm text-slate-600 md:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="hover:text-slate-900">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Suspense>
            <LanguageSwitch className="hidden sm:inline-flex" />
          </Suspense>
          <HeaderAuth
            signInHref={`${localePath(locale, "/login")}?next=/dashboard`}
            startHref={startHref}
            labels={{ signIn: t.signIn, startFree: t.startFree, dashboard: t.dashboard, newEvent: t.newEvent }}
          />
        </div>
      </div>
    </header>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl">{title}</h2>
    </div>
  );
}

/** Pure-CSS phone showing the guest page, so the hero needs no image assets. */
function PhoneMockup({ t }: { t: Copy }) {
  const tiles = [
    "from-sky-300 to-blue-500",
    "from-rose-200 to-pink-400",
    "from-amber-200 to-orange-400",
    "from-blue-200 to-indigo-400",
    "from-emerald-200 to-teal-400",
    "from-violet-200 to-purple-400",
    "from-cyan-200 to-sky-500",
    "from-fuchsia-200 to-rose-400",
    "from-lime-200 to-emerald-400",
  ];
  return (
    <div className="relative mx-auto w-full max-w-[300px]" aria-hidden="true">
      <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-blue-200/60 to-sky-100/40 blur-2xl" />
      <div className="relative rounded-[2.5rem] border-[10px] border-slate-900 bg-white p-4 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-slate-200" />
        <div className="h-16 rounded-xl bg-gradient-to-r from-blue-500 to-sky-400" />
        <p className="mt-3 text-[11px] text-slate-400">{t.mockDate}</p>
        <p className="text-sm font-semibold">{t.mockTitle}</p>
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-medium text-white">
          <Camera className="h-3.5 w-3.5" /> {t.mockUpload}
        </div>
        <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-0.5 text-[10px]">
          <span className="flex-1 rounded-md py-1 text-center text-slate-500">Official</span>
          <span className="flex-1 rounded-md bg-white py-1 text-center font-medium shadow-sm">Guest</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {tiles.map((t, i) => (
            <div key={i} className={`aspect-square rounded-md bg-gradient-to-br ${t}`} />
          ))}
        </div>
      </div>
      <div className="absolute -bottom-4 -left-8 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-100">
        <QrCode className="h-5 w-5 text-primary" /> {t.mockScan}
      </div>
    </div>
  );
}
