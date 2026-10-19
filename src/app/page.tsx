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
import { BrandLogo, BrandMark } from "@/components/brand";
import { LEGAL } from "@/lib/legal";
import { SITE } from "@/lib/site";
import { CUSTOM_PLAN } from "@/lib/custom-plan";
import { PLANS, PLAN_TIERS } from "@/server/plans";

export const metadata = { alternates: { canonical: "/" } };

const START_HREF = "/login?next=/dashboard/events/new";

const STEPS = [
  { icon: QrCode, title: "สร้างงานและพิมพ์ QR", text: "สร้างงานใน 1 นาที ได้ QR Code และโปสเตอร์พร้อมพิมพ์วางบนโต๊ะทันที" },
  { icon: ScanLine, title: "แขกสแกนแล้วแชร์", text: "แขกเปิดกล้องมือถือสแกน ถ่ายหรือเลือกรูปแล้วอัปโหลดได้เลย ไม่ต้องโหลดแอป" },
  { icon: Images, title: "ได้ทุกรูปในที่เดียว", text: "รูปจากแขกและช่างภาพรวมในอัลบั้มเดียว ดู เซฟ และดาวน์โหลดทั้งอัลบั้มได้" },
];

const FEATURES = [
  { icon: Smartphone, title: "ไม่ต้องโหลดแอป ไม่ต้องสมัคร", text: "เปิดผ่านเบราว์เซอร์บนมือถือทุกรุ่น แขกทุกวัยใช้ได้ทันที" },
  { icon: ImagePlay, title: "รูปและวิดีโอ", text: "แขกแชร์ได้ทั้งรูปและคลิปสั้น ระบบย่อรูปให้อัตโนมัติ อัปเร็วแม้เน็ตไม่แรง" },
  { icon: Camera, title: "อัลบั้ม Official + แขก", text: "แยกแท็บรูปจากช่างภาพมืออาชีพกับรูปบรรยากาศจากแขกให้ดูง่าย" },
  { icon: Users, title: "ทีมช่างภาพ", text: "เชิญช่างภาพเข้างานด้วยลิงก์ อัปไฟล์ต้นฉบับความละเอียดเต็มได้" },
  { icon: Palette, title: "ใส่แบรนด์ของงาน", text: "สี ฟอนต์ โลโก้ รูปปก และโลโก้ผู้สนับสนุน ให้หน้างานเป็นของคุณ" },
  { icon: ShieldCheck, title: "ดูแลรูปได้เต็มที่", text: "ซ่อนหรือลบรูปได้ทันที AI ช่วยกรองรูปไม่เหมาะสม แขกขอให้ลบรูปตัวเองได้" },
  { icon: Download, title: "ดาวน์โหลดทั้งอัลบั้ม", text: "เก็บทุกรูปเป็นไฟล์ ZIP ความละเอียดเต็ม ไม่มีลายน้ำในแพ็กเกจเสียเงิน" },
  { icon: Sparkles, title: "ปลอดภัยตาม PDPA", text: "ลบตำแหน่ง GPS ออกจากรูป ขอความยินยอมก่อนอัปโหลด และตั้งเวลาลบอัลบั้มอัตโนมัติ" },
];

const USE_CASES = [
  { icon: Heart, title: "งานแต่งงาน", text: "ได้รูปมุมที่ช่างภาพไม่เห็น จากเพื่อนและญาติทุกโต๊ะ" },
  { icon: Building2, title: "สัมมนา / องค์กร", text: "รวบรวมภาพกิจกรรม ใส่โลโก้บริษัทและผู้สนับสนุน" },
  { icon: PartyPopper, title: "ปาร์ตี้ / วันเกิด", text: "ทุกคนแชร์ภาพได้ทันที ไม่ต้องตามขอทีละคน" },
  { icon: Music, title: "คอนเสิร์ต / อีเวนต์", text: "ฉายภาพบรรยากาศและเก็บความทรงจำจากผู้ร่วมงาน" },
];

const FAQ = [
  {
    q: "แขกต้องโหลดแอปหรือสมัครสมาชิกไหม?",
    a: "ไม่ต้อง แขกสแกน QR Code ด้วยกล้องมือถือ แล้วอัปโหลดผ่านเบราว์เซอร์ได้ทันที ใช้ได้ทั้ง iPhone และ Android",
  },
  {
    q: "รูปที่แขกอัปโหลดคมชัดแค่ไหน?",
    a: "ระบบย่อรูปเหลือด้านยาว 2,560 พิกเซลเพื่อให้อัปเร็วและดูสวยบนทุกจอ ส่วนช่างภาพอัปไฟล์ต้นฉบับความละเอียดเต็มได้ในแพ็กเกจ Premium",
  },
  {
    q: "อัปโหลดวิดีโอได้ไหม?",
    a: "ได้ในแพ็กเกจ Standard และ Premium (Standard คลิปละไม่เกิน 1 นาที, Premium ไม่เกิน 3 นาที) แพ็กเกจ Free รองรับเฉพาะรูปภาพ",
  },
  {
    q: "ใครดูรูปในงานได้บ้าง?",
    a: "ผู้ที่มี QR Code หรือลิงก์ของงาน คุณตั้งรหัสผ่านให้งานได้ และหน้าอัลบั้มจะไม่ถูกค้นเจอบน Google",
  },
  {
    q: "ถ้ามีรูปที่ไม่เหมาะสมจะทำอย่างไร?",
    a: "เจ้าภาพซ่อนหรือลบรูปได้ทันทีจาก dashboard แขกกดรายงานหรือขอให้ลบรูปที่มีตัวเองได้ และมี AI ช่วยกรองรูปไม่เหมาะสม",
  },
  {
    q: "อัลบั้มอยู่ได้นานแค่ไหน?",
    a: `ตามแพ็กเกจ ตั้งแต่ ${PLANS.free.retentionDays} ถึง ${PLANS.premium.retentionDays} วันหลังวันงาน เราจะส่งอีเมลเตือนก่อนหมดอายุ และคุณดาวน์โหลดทั้งอัลบั้มเก็บไว้ได้`,
  },
  {
    q: "ชำระเงินอย่างไร?",
    a: "จ่ายครั้งเดียวต่องาน ผ่านบัตรเครดิต/เดบิต หรือ PromptPay อัปเกรดจาก Free ได้ทุกเมื่อ รูปเดิมไม่หาย",
  },
];

const thb = (n: number) => n.toLocaleString("th-TH");

function videoLabel(tier: (typeof PLAN_TIERS)[number]) {
  const video = PLANS[tier].video;
  return video ? `วิดีโอคลิปละไม่เกิน ${Math.round(video.maxDurationSec / 60)} นาที` : "รูปภาพเท่านั้น";
}

export default function Home() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE.name,
      url: SITE.url,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web, iOS, Android",
      description: SITE.description,
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
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary-soft via-white to-white">
          <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-sky-200/50 blur-3xl" />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-14 pb-20 md:grid-cols-[1.1fr_0.9fr] md:pt-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm text-primary-ink shadow-sm ring-1 ring-blue-100">
                <Sparkles className="h-4 w-4 text-accent" /> แชร์รูปงานอีเวนต์ด้วย QR Code
              </p>
              <h1 className="mt-5 text-4xl leading-tight font-semibold tracking-tight text-balance text-slate-900 md:text-5xl">
                รวมทุกรูปจากแขกและช่างภาพ <span className="text-primary">ไว้ในอัลบั้มเดียว</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-slate-600">
                แขกสแกน QR แล้วถ่าย อัปโหลด และเซฟรูปได้ทันที ไม่ต้องโหลดแอป ไม่ต้องสมัครสมาชิก
                เจ้าภาพได้ทุกมุมของงานโดยไม่ต้องตามขอรูปทีละคน
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={START_HREF}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-medium text-white shadow-lg shadow-blue-600/20 hover:bg-primary-hover"
                >
                  สร้างงานฟรี <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/e/demo"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-medium text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300"
                >
                  ดูตัวอย่างหน้าแขก
                </Link>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                {["ใช้ฟรีสำหรับงานเล็ก", "รองรับ PromptPay", "ลบ GPS ออกจากรูปอัตโนมัติ"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-primary" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <PhoneMockup />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20">
          <SectionTitle eyebrow="ใช้งานง่าย 3 ขั้นตอน" title="จากสแกน QR ถึงอัลบั้มที่สมบูรณ์" />
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
            <SectionTitle eyebrow="ฟีเจอร์" title="ทุกอย่างที่งานของคุณต้องการ" />
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
          <SectionTitle eyebrow="เหมาะกับทุกงาน" title="ใช้ได้ตั้งแต่ปาร์ตี้เล็ก ๆ ถึงอีเวนต์ใหญ่" />
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
            <SectionTitle eyebrow="ราคา" title="จ่ายครั้งเดียวต่องาน ไม่มีรายเดือน" />
            <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
              เริ่มฟรี แล้วอัปเกรดเมื่อต้องการ รูปเดิมยังอยู่ครบ ชำระด้วยบัตรหรือ PromptPay
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
                        ยอดนิยม
                      </span>
                    )}
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <p className="mt-3 text-4xl font-semibold tracking-tight">
                      {plan.priceThb === 0 ? "ฟรี" : `฿${thb(plan.priceThb)}`}
                      {plan.priceThb > 0 && <span className="text-base font-normal text-slate-500"> / งาน</span>}
                    </p>
                    <ul className="mt-6 flex-1 space-y-2.5 text-sm text-slate-700">
                      {[
                        `แขกสูงสุด ${thb(plan.maxGuests)} คน`,
                        plan.video ? `รูปและวิดีโอรวม ${thb(plan.maxPhotos)} ไฟล์` : `รูปรวม ${thb(plan.maxPhotos)} รูป`,
                        videoLabel(tier),
                        `เก็บอัลบั้ม ${plan.retentionDays} วัน`,
                        plan.watermark ? "รูปมีลายน้ำ Tohs Event" : "ไม่มีลายน้ำ",
                        ...(plan.branding ? ["ใส่แบรนด์และผู้สนับสนุน"] : []),
                        ...(plan.originals ? ["ไฟล์ต้นฉบับจากช่างภาพ"] : []),
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
                      {plan.priceThb === 0 ? "เริ่มใช้ฟรี" : `เลือก ${plan.name}`}
                    </Link>
                  </div>
                );
              })}
              <div className="relative flex flex-col rounded-2xl bg-gradient-to-br from-primary-ink via-primary to-accent p-7 text-white shadow-xl shadow-blue-600/20">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <Sparkles className="h-5 w-5" /> Custom
                </h3>
                <p className="mt-3 text-4xl font-semibold tracking-tight">
                  <span className="text-base font-normal text-blue-100">เริ่ม </span>฿{thb(CUSTOM_PLAN.basePriceThb)}
                  <span className="text-base font-normal text-blue-100"> / งาน</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-blue-50">
                  {[
                    "เลือกจำนวนแขก รูปและวิดีโอ เองได้",
                    "เลือกพื้นที่จัดเก็บและระยะเวลาเก็บเอง",
                    "ไม่จำกัดขนาดไฟล์ (สูงสุด 5 GB ต่อไฟล์)",
                    "วิดีโอยาวสูงสุด 3 ชั่วโมง",
                    "ทุกอย่างของ Premium",
                    "ราคาประเมินทันทีตามที่เลือก",
                  ].map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href={START_HREF} className="mt-7 rounded-xl bg-white px-4 py-3 text-center font-medium text-primary-ink hover:bg-blue-50">
                  ประเมินราคา
                </Link>
              </div>
            </div>
            <p className="mt-8 text-center text-sm text-slate-500">
              ช่างภาพและออร์แกไนเซอร์ที่ทำหลายงานต่อเดือน: แพ็กเกจ Pro รายเดือนกำลังจะเปิดเร็ว ๆ นี้
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-20 px-4 py-20">
          <SectionTitle eyebrow="คำถามที่พบบ่อย" title="มีคำถาม? เรามีคำตอบ" />
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
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance">พร้อมเก็บทุกช่วงเวลาของงานคุณแล้วหรือยัง?</h2>
            <p className="mt-3 max-w-xl text-blue-50">สร้างงานแรกได้ฟรีภายในไม่ถึงนาที ไม่ต้องใช้บัตรเครดิต</p>
            <Link
              href={START_HREF}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-medium text-primary-ink hover:bg-blue-50"
            >
              สร้างงานฟรี <ArrowRight className="h-4 w-4" />
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
            <Link href="/privacy" className="hover:text-slate-900">
              นโยบายความเป็นส่วนตัว
            </Link>
            <Link href="/terms" className="hover:text-slate-900">
              ข้อกำหนดการใช้งาน
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

function SiteHeader() {
  const links = [
    ["#how", "วิธีใช้งาน"],
    ["#features", "ฟีเจอร์"],
    ["#pricing", "ราคา"],
    ["#faq", "คำถาม"],
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <BrandLogo />
        <nav className="hidden items-center gap-7 text-sm text-slate-600 md:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="hover:text-slate-900">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login?next=/dashboard"
            className="hidden rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 sm:block"
          >
            เข้าสู่ระบบ
          </Link>
          <Link href={START_HREF} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
            สร้างงานฟรี
          </Link>
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
function PhoneMockup() {
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
        <p className="mt-3 text-[11px] text-slate-400">12 ธันวาคม 2569</p>
        <p className="text-sm font-semibold">งานแต่งงาน ต้น & ฝน</p>
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-medium text-white">
          <Camera className="h-3.5 w-3.5" /> ถ่ายรูป / เลือกรูป
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
        <QrCode className="h-5 w-5 text-primary" /> สแกนแล้วอัปได้เลย
      </div>
    </div>
  );
}
