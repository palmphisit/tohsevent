# Tohs Event — Development Roadmap

> แผนแบ่ง Phase การพัฒนา (ร่างแรก · 18 ต.ค. 2026)
> ระยะเวลาเป็นค่าประมาณคร่าว ๆ สำหรับทีม 1–2 คน ปรับตามทรัพยากรจริง

---

## หลักคิดในการเรียง Phase

1. **ทุกอย่างเริ่มบนเว็บก่อน แล้วค่อยแยกเป็น Native App** — ฟีเจอร์ของ Host, Kiosk และ Slideshow ส่วนใหญ่ทำเป็นหน้าเว็บใน Next.js ได้ก่อน ใช้ทดสอบตลาดได้เร็วกว่าการทำแอป 4 แพลตฟอร์มพร้อมกัน
2. **API-first ตั้งแต่วันแรก** — แอป iOS/Android/Tablet/Desktop ในอนาคตจะเรียก API ชุดเดียวกับเว็บ ดังนั้น Phase 1 ต้องออกแบบ REST API แบบ versioned (`/api/v1/...`) และแยก business logic ออกจาก UI
3. **ให้เก็บเงินได้เร็ว** — Monetization (Pay-per-Event) มาก่อน Native App เพราะ Host Console บนเว็บใช้ทำงานได้ครบอยู่แล้ว
4. **ให้ช่างภาพเข้ามาก่อน AI** — Face Recognition จะมีค่ามากที่สุดเมื่อมีรูป Official จำนวนมาก ซึ่งมาจากช่างภาพ

## ภาพรวม

| Phase | ชื่อ | เป้าหมาย | ประมาณ |
|---|---|---|---|
| 1 | **Guest PWA MVP** | แขกสแกน QR → อัปโหลด → ดู/เซฟรูปได้ · Host สร้างงานบนเว็บได้ · ใช้จัดงานจริง (pilot) ได้ | 6–8 สัปดาห์ |
| 2 | **Commercial Launch** | เก็บเงิน Pay-per-Event, Freemium, Custom Branding, Auto-Expiration, PDPA | 4–6 สัปดาห์ |
| 3 | **Photographer Suite** | Desktop App (Bulk Upload, Folder Watcher, Watermark) + Pro Subscription | 6–8 สัปดาห์ |
| 4 | **AI Face Search** | ค้นหารูปตัวเองด้วยเซลฟี่ 1 รูป | 4–6 สัปดาห์ |
| 5 | **Native Host & Kiosk Apps** | แอปเจ้าภาพ iOS/Android + Tablet Photobooth/Projector Mode + Push | 8–10 สัปดาห์ |
| 6 | **Scale & Enterprise** | White-label domain, Sponsor analytics, Print-on-demand, ทีมช่างภาพหลายคน | ต่อเนื่อง |

---

## Phase 1 — Guest PWA MVP

### Tech Stack

| ส่วน | เลือกใช้ | หมายเหตุ |
|---|---|---|
| Framework | Next.js (App Router) + React + TypeScript | `output: "standalone"` สำหรับ Docker |
| UI | Tailwind CSS + shadcn/ui | mobile-first |
| Database | MongoDB Atlas (region `asia-southeast1`) | ดูหัวข้อ "MongoDB ดีไหม" ด้านล่าง |
| ODM / Validation | Mongoose หรือ native driver + Zod | ใช้ Zod schema ร่วมกันทั้ง client/server |
| Storage | Cloudflare R2 (S3-compatible) | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` |
| CDN รูป | R2 ผูก Custom Domain ผ่าน Cloudflare | Egress ฟรี — จุดแข็งหลักของ R2 |
| Server | Google Cloud Run (`asia-southeast1`) | Dockerfile + GitHub Actions → Artifact Registry |
| Host Auth | Firebase Auth (Google / Apple / Email; LINE ผ่าน OIDC ใน Identity Platform) | มี SDK ครบทุกแพลตฟอร์ม พร้อมสำหรับ Native App ใน Phase 5 |
| Guest Session | Signed JWT ใน httpOnly cookie (ผูกกับ eventId) | ไม่ต้องสมัครสมาชิก |
| PWA | Serwist (ตัวต่อจาก next-pwa) | manifest + service worker |
| QR Code | `qrcode` (สร้าง PNG/SVG/PDF โปสเตอร์) | |
| Monitoring | Sentry + Cloud Logging | |

### ขอบเขตฟีเจอร์ (In Scope)

**Guest PWA (`/e/{slug}`)**
- สแกน QR → เปิดหน้างานทันที → (ถ้ามี) กรอกรหัสผ่าน → ใส่ชื่อเล่น (optional) → เริ่มใช้
- ถ่ายรูป / เลือกหลายรูปจากแกลเลอรี (`<input type="file" accept="image/*" multiple capture>`)
- **ย่อรูปและลบ EXIF ฝั่งเบราว์เซอร์ก่อนอัปโหลด** — ลด bandwidth ของแขก และลบพิกัด GPS ออก (privacy)
- คิวอัปโหลดพร้อม progress + retry อัตโนมัติ (เก็บคิวใน IndexedDB กันปิดแท็บ)
- แกลเลอรีแบบ Infinite scroll แยกแท็บ **Official** / **Guest Photos**
- Lightbox ดูรูปเต็ม + ปุ่ม **Save to Phone** (ใช้ `navigator.share({ files })` บน iOS เพื่อให้ขึ้นเมนู "Save Image" ลง Photos ได้ตรง ๆ; fallback เป็น download)
- ปุ่ม **Report / ขอลบรูป**
- Live update แบบ polling ทุก 10–15 วินาที (ยังไม่ต้องใช้ WebSocket)

**Host Web Console (`/dashboard`) — เวอร์ชันขั้นต่ำ**
- Login, สร้าง/แก้ไขอีเวนต์ (ชื่อ, วันที่, ปก)
- ตั้งสิทธิ์: Public / Password-protected
- สร้าง QR + ดาวน์โหลดโปสเตอร์ A4/A5 สำหรับวางบนโต๊ะ
- เปิด/ปิดการอัปโหลดของแขก
- Moderation: ซ่อน/ลบรูป, ดูรายการ Report
- อัปโหลดรูป Official ผ่านเบราว์เซอร์ (หลายไฟล์) — เวอร์ชันพื้นฐานก่อนมี Desktop App

**Live Slideshow (`/e/{slug}/live`)** — โบนัสที่ทำง่ายแต่ "ว้าว"
- หน้าเว็บเต็มจอสำหรับเปิดบนโน้ตบุ๊กต่อโปรเจกเตอร์ ดึงรูปใหม่มาวนแสดง
- เป็นต้นแบบของ Projector Mode ใน Tablet App (Phase 5)

### นอกขอบเขต (Out of Scope)
การชำระเงิน, Face Recognition, Custom Branding, Push Notification, Native App, ZIP download ทั้งอัลบั้ม

### Flow การอัปโหลด (สำคัญที่สุดของ Phase นี้)

ห้ามให้ไฟล์รูปวิ่งผ่าน Cloud Run — ให้เบราว์เซอร์อัปโหลดตรงเข้า R2 ด้วย Presigned URL

```
Browser                         Cloud Run (Next.js API)              R2 / MongoDB
  │ 1. POST /api/v1/events/:id/uploads  │                                 │
  │    { count, sizes, mime }  ───────► │ ตรวจ session, quota, rate limit │
  │                                     │ สร้าง photo doc (status=pending)│──► Mongo
  │ ◄─────── presigned PUT URLs ─────── │                                 │
  │ 2. PUT รูป (display + thumb) ─────────────────────────────────────────► R2
  │ 3. POST /api/v1/photos/:id/complete │                                 │
  │ ──────────────────────────────────► │ HEAD object ตรวจขนาด/ชนิด        │──► R2
  │                                     │ status=ready                    │──► Mongo
```

เหตุผล:
- Cloud Run จำกัดขนาด request body และคิดเงินตามเวลา CPU — ส่งไฟล์ผ่าน server ทั้งแพงและช้า
- ต้องตั้งค่า **CORS ของ R2 bucket** ให้รับ `PUT` จากโดเมนของเรา
- รูปที่ค้าง `pending` เกิน 24 ชม. ให้ job ล้างทิ้ง (ทั้ง Mongo และ R2)

### การจัดเก็บรูป

| Version | ขนาด | ใช้ทำอะไร |
|---|---|---|
| `thumb` | ~480px WebP/JPEG | grid แกลเลอรี |
| `display` | ~2048–2560px JPEG | lightbox + Save to Phone |
| `original` | ไฟล์จริง (เฉพาะรูป Official) | ขาย High-res ใน Phase 2 |

- Phase 1 สร้าง thumb/display ฝั่ง client (ฟรี ไม่ต้องมี image server)
- Key รูปเป็น UUID สุ่ม เช่น `events/{eventId}/{photoId}/display.jpg` — เดาไม่ได้
- งาน Password-protected: API ที่คืนรายการรูปต้องผ่านการตรวจรหัสก่อน; URL รูปเดาไม่ได้ถือว่าเพียงพอสำหรับ MVP แล้วค่อยยกระดับเป็น Cloudflare Worker ตรวจ signed token ใน Phase 2
- หมายเหตุ: Presigned GET ของ R2 ใช้ได้แค่บน endpoint `r2.cloudflarestorage.com` จึงไม่ได้ CDN cache — ไม่เหมาะกับการเสิร์ฟแกลเลอรี

### Data Model (ร่าง)

```ts
users        { _id, firebaseUid, email, name, plan, createdAt }

events       { _id, slug, ownerId, title, date, coverKey,
               access: { mode: "public" | "password", passwordHash? },
               settings: { guestUpload: boolean, moderation: "post" | "pre",
                           maxPhotosPerGuest },
               branding: {},             // เติมใน Phase 2
               status: "draft" | "live" | "closed" | "expired",
               expiresAt, counters: { photos, guests }, createdAt }

guestSessions { _id, eventId, displayName?, ipHash, uaHash, createdAt }

photos       { _id, eventId, source: "guest" | "official",
               uploader: { type: "guest" | "user", id },
               keys: { thumb, display, original? },
               width, height, bytes, takenAt?,
               status: "pending" | "ready" | "hidden" | "deleted",
               createdAt }

reports      { _id, photoId, eventId, reason, note?, sessionId?, status, createdAt }
```

Index หลัก: `photos { eventId: 1, source: 1, status: 1, createdAt: -1 }`, `events { slug: 1 } unique`

### Cloud Run Config แนะนำ
- Region `asia-southeast1` ให้อยู่ที่เดียวกับ Atlas cluster (latency ต่ำ)
- `min-instances=0` ช่วงปกติ; ช่วงวันจัดงานจริงตั้ง `min-instances=1` กัน cold start ตอนแขกสแกน QR พร้อมกัน
- `concurrency=80`, ตั้ง `maxPoolSize` ของ Mongo driver ราว 10–20 ต่อ instance
- Secret (Mongo URI, R2 keys, JWT secret) เก็บใน Secret Manager
- Environment: `staging` และ `production` แยก Cloud Run service, Atlas DB และ R2 bucket

### ข้อควรระวังเฉพาะ PWA
- **iOS ไม่รองรับ Background Sync** — ถ้าแขกปิดหน้าจอระหว่างอัปโหลด การอัปโหลดจะหยุด ต้องมีคิวใน IndexedDB แล้ว resume เมื่อเปิดหน้าใหม่ และแสดงข้อความ "อย่าเพิ่งปิดหน้านี้"
- รูป HEIC จาก iPhone: Safari มักแปลงเป็น JPEG ให้เมื่อเลือกผ่าน `<input>` แต่ต้องรองรับกรณีที่ได้ HEIC มาด้วย (fallback อัปโหลดตรงแล้วค่อยแปลงฝั่ง server ภายหลัง)
- ไม่บังคับ "Add to Home Screen" — ต้องใช้งานได้ครบในเบราว์เซอร์ธรรมดา

### Definition of Done
- [ ] จัดงานจริงได้ 1 งาน (pilot) แขก ~100 คน รูป ~1,000 รูป โดยไม่มีปัญหาใหญ่
- [ ] จากสแกน QR ถึงอัปโหลดรูปแรกสำเร็จ ภายใน 30 วินาที บนมือถือทั่วไปผ่าน 4G
- [ ] Lighthouse PWA/Performance ≥ 90 บนหน้าแกลเลอรี
- [ ] Host ซ่อนรูปแล้วหายจากแกลเลอรีแขกภายใน 15 วินาที
- [ ] มี Privacy Notice + ปุ่ม Report ใช้งานได้

### ลำดับงานย่อยใน Phase 1
1. **Foundation** — repo, Next.js skeleton, Dockerfile, CI/CD → Cloud Run (staging), Atlas, R2 bucket + CORS + custom domain, Sentry
2. **Host Auth + Event CRUD + QR**
3. **Guest Session + Presigned Upload Flow** (ส่วนที่เสี่ยงที่สุด ทำให้เสร็จเร็ว)
4. **Gallery + Lightbox + Save to Phone**
5. **Moderation + Report**
6. **Live Slideshow page**
7. **PWA polish + Load test** (เช่น k6 จำลองแขก 200 คนอัปโหลดพร้อมกัน) → Pilot event

---

## Phase 2 — Commercial Launch

- **Pay-per-Event**: แพ็กเกจตามจำนวนแขก/Storage — ชำระผ่าน Stripe หรือ Opn Payments (Omise) รองรับ **PromptPay** + บัตร
- **Plan limits enforcement**: จำกัดจำนวนรูป/แขก/Storage/อายุอัลบั้ม ตามแพ็กเกจ
- **Freemium**: งานฟรีได้รูปความละเอียดจำกัด + ลายน้ำแพลตฟอร์ม (ใช้ Cloudflare Image Transformations ซ้อนลายน้ำแบบ on-the-fly ได้ โดยไม่ต้องเก็บไฟล์ซ้ำ)
- **High-res Download (In-app purchase)**: แขกจ่ายเพื่อโหลด original
- **Custom Branding**: สี, ธีม, โลโก้, ฟอนต์ ของหน้า PWA ต่ออีเวนต์ + แบนเนอร์ผู้สนับสนุน
- **Auto-Expiration**: Cloud Scheduler → Cloud Run Job ทุกวัน ปิดสิทธิ์/ลบอัลบั้มที่หมดอายุ (แจ้ง Host ล่วงหน้า 7 วัน)
- **Private Access**: ยกระดับการเสิร์ฟรูปเป็น Cloudflare Worker ตรวจ signed token
- **Auto Moderation**: Google Cloud Vision SafeSearch ตรวจรูปไม่เหมาะสมอัตโนมัติ
- **PDPA**: Privacy Policy, Consent ตอนแขกอัปโหลด, ระบบ Request to Delete ที่มี SLA, บันทึก audit log
- **Download ทั้งอัลบั้มเป็น ZIP** (สร้างผ่าน Cloud Run Job แล้วส่งลิงก์)
- **แจ้งเตือนแขกเมื่อรูป Official พร้อม** — ให้แขกกรอก Email หรือเพิ่มเพื่อน LINE OA แบบ opt-in (ดูหมายเหตุเรื่อง Push ใน Phase 5)

### การตัดสินใจและลำดับงาน (18 ต.ค. 2026)

- ผู้ให้บริการชำระเงิน: **Stripe Checkout** (บัตร + PromptPay, สกุล THB) และใช้ Stripe Billing ต่อสำหรับ Pro Subscription ใน Phase 3
- แพ็กเกจต่องาน (ตัวเลขอยู่ใน `src/server/plans.ts` ไฟล์เดียว ปรับได้ภายหลัง):

| | Free | Standard | Premium |
|---|---|---|---|
| ราคา | 0 ฿ | 590 ฿ | 1,490 ฿ |
| แขกสูงสุด | 50 | 300 | 1,000 |
| รูปทั้งงาน | 300 | 5,000 | 20,000 |
| เก็บอัลบั้ม (นับจากวันงาน) | 7 วัน | 60 วัน | 180 วัน |
| ลายน้ำแพลตฟอร์ม | มี | ไม่มี | ไม่มี |
| Custom Branding + แบนเนอร์ผู้สนับสนุน | – | – | ✓ |

- อัปเกรดจาก Standard เป็น Premium จ่ายเฉพาะส่วนต่าง
- อัลบั้มที่หมดอายุ: แขกเข้าไม่ได้ทันที และลบไฟล์จริงหลังหมดอายุ 7 วัน (ช่วงผ่อนผันให้เจ้าภาพอัปเกรดเพื่อต่ออายุ)

ลำดับงาน:
1. **2a — แพ็กเกจ + ชำระเงิน**: บังคับใช้ limit, หน้าอัปเกรด, Stripe Checkout + webhook, ลบอัลบั้มหมดอายุ
2. **2b — Freemium**: ลายน้ำบนงาน Free (เบราว์เซอร์สร้างสำเนาที่มีลายน้ำตอนอัปโหลด แขกเห็นเฉพาะสำเนานี้
   ไฟล์ต้นฉบับเก็บด้วยชื่อสุ่ม อัปเกรดแล้วรูปเดิมเปลี่ยนเป็นไม่มีลายน้ำทันที)
   ส่วนดาวน์โหลดความละเอียดสูงแบบเสียเงินย้ายไป Phase 3 เพราะต้องมีไฟล์ต้นฉบับจากแอปช่างภาพก่อน
3. **2c — Custom Branding** + แบนเนอร์ผู้สนับสนุน (Premium): สีหลัก (ปุ่ม/ไฮไลต์ ผ่าน CSS variable `--brand`),
   ฟอนต์ไทย 6 แบบ, โลโก้, รูปปก 3:1, ข้อความต้อนรับ และโลโก้ผู้สนับสนุนสูงสุด 12 รายพร้อมลิงก์
4. **2d — PDPA**: `/privacy` + `/terms` (ร่าง รอทนายตรวจ), consent ก่อนแขกอัปโหลดครั้งแรก (บันทึกเวอร์ชันนโยบาย),
   แขกลบรูปของตัวเองได้, เจ้าภาพเห็นเหตุผล/เวลาของคำขอลบ, audit log เก็บ 400 วัน
5. **2e**: Auto Moderation (Vision SafeSearch ซ่อนรูปรอตรวจ), ZIP ทั้งอัลบั้ม (สตรีม ไฟล์ละ 300 รูป),
   อีเมลแจ้งแขก + เตือนเจ้าภาพก่อนหมดอายุ (Resend), Private Access แบบ path รูปมี token สุ่ม
   (แทน Cloudflare Worker — URL ของรูปในงานที่ตั้งรหัสผ่านเดาไม่ได้และแจกเฉพาะแขกที่ผ่านรหัส)

## Phase 3 — Photographer Suite

- **Desktop App (macOS/Windows)** — แนะนำ **Tauri** (เบา, ไฟล์เล็ก) หรือ Electron (ถ้าอยากใช้ Node ecosystem ทั้งหมด)
- **Bulk Upload** แบบ S3 Multipart + resumable, อัปโหลดขนานหลายไฟล์, ทนเน็ตหลุด
- **Folder Watcher** — วิธีที่ใช้ได้จริงสำหรับ "Tethering": ให้ช่างภาพใช้ซอฟต์แวร์ tether ของกล้อง/Lightroom/Capture One ที่เขาใช้อยู่แล้ว ซึ่งเขียนไฟล์ลงโฟลเดอร์ แล้วแอปเราคอยดูโฟลเดอร์นั้นและอัปโหลดทันที (การ tether ตรงกับกล้องผ่าน SDK ของแต่ละยี่ห้อค่อยพิจารณาภายหลัง เพราะต้นทุนสูงมาก)
- **Auto-watermarking** — preset ลายน้ำของช่างภาพ ใส่ก่อนอัปโหลด
- **Pro Subscription** — รายเดือน/รายปี สร้างงานไม่จำกัด, Storage สูง, ปลดล็อก White-label
- **Portfolio/Client gallery** ของช่างภาพ, ทีมช่างภาพหลายคนต่องาน (เบื้องต้น)

## Phase 4 — AI Face Search

- แขกอัปโหลดเซลฟี่ 1 รูป → ระบบคืนรูปทั้งหมดที่มีหน้าคนนั้น
- ตัวเลือกเทคโนโลยี:
  - **Managed**: AWS Rekognition (Face Collections ต่ออีเวนต์) — เริ่มเร็ว จ่ายตามการใช้
  - **Self-host**: InsightFace/ArcFace บน Cloud Run (GPU) สร้าง face embedding แล้วค้นด้วย **MongoDB Atlas Vector Search** — ถูกกว่าเมื่อปริมาณมาก
- Pipeline: รูปเข้า → queue (Pub/Sub) → worker ตรวจจับใบหน้า + สร้าง embedding → เก็บใน collection `faces`
- **PDPA สำคัญมาก**: ข้อมูลใบหน้าเป็น "ข้อมูลชีวภาพ" ซึ่งเป็นข้อมูลอ่อนไหวตาม PDPA มาตรา 26 ต้องขอ **ความยินยอมโดยชัดแจ้ง**, ลบเซลฟี่ทันทีหลังค้นหา, ให้ Host เลือกเปิด/ปิดฟีเจอร์ต่ออีเวนต์, และลบ embeddings เมื่ออัลบั้มหมดอายุ

## Phase 5 — Native Host & Kiosk Apps

- **Tech แนะนำ: Expo (React Native)** — ใช้ทักษะ React ต่อได้, แชร์ type/Zod schema/API client กับเว็บผ่าน monorepo, ได้ทั้ง iOS/Android/Tablet
- **Host App**: จัดการอีเวนต์, แชร์ QR, Moderation queue แบบ realtime, สถิติ, Push ถึง Host (Expo Push / FCM)
- **Tablet Kiosk / Photobooth**: โหมด Guided Access/Kiosk, กล้องหน้า + countdown + frame/overlay ตามแบรนด์งาน, พิมพ์/แสดง QR ให้แขกสแกนรับรูป
- **Projector Mode**: ต่อยอดจาก Live Slideshow ใน Phase 1 + ใช้ WebSocket หรือ Mongo Change Streams เพื่อ realtime จริง
- **หมายเหตุเรื่อง Push ถึงแขก**: แขกใช้ PWA และไม่มีบัญชี — Web Push บน iOS ใช้ได้เฉพาะเมื่อแขก "Add to Home Screen" แล้วเท่านั้น (iOS 16.4+) ซึ่งเพิ่มความเสียดทาน ช่องทางหลักจึงควรเป็น Email/LINE OA แบบ opt-in (เริ่มใน Phase 2) ส่วน Web Push เป็นช่องทางเสริมสำหรับ Android และผู้ที่ติดตั้ง PWA

## Phase 6 — Scale & Enterprise

- White-label เต็มรูปแบบ (custom domain ต่อ Pro account)
- Sponsor analytics (impression/click ของแบนเนอร์)
- Print-on-demand
- Multi-region / CDN tuning, cost optimization
- Public API / Webhooks สำหรับออร์แกไนเซอร์รายใหญ่

---

## MongoDB ดีไหม?

**สรุป: ใช้ได้ดี แนะนำให้ไปต่อกับ MongoDB Atlas** — ถ้าทีมคุ้นเคยอยู่แล้ว

ข้อดีที่เข้ากับโปรเจกต์นี้:
- ข้อมูลส่วนใหญ่เป็นลักษณะ document: Event ที่มี settings/branding ซ้อนอยู่ข้างใน, Photo เป็น document อิสระ — schema เปลี่ยนบ่อยช่วง MVP ได้สบาย
- **Atlas Vector Search** รองรับ face embeddings ใน Phase 4 ได้เลย ไม่ต้องเพิ่ม vector DB อีกตัว
- **Change Streams** ใช้ทำ realtime slideshow/moderation ใน Phase 5 ได้
- Cloud Run เป็น container ที่อยู่ได้นาน (ไม่ใช่ function ที่เกิด-ตายทุก request) connection pool ของ Mongo driver จึงทำงานปกติ

ข้อควรระวัง:
- ส่วน **การเงิน/Subscription** มีความเป็น relational สูง — ต้องใช้ multi-document transaction ให้ถูกที่ และให้ Payment Provider (Stripe/Omise) เป็น source of truth ของสถานะการชำระเงินผ่าน webhook
- ระวัง unbounded array — อย่าเก็บรายการรูปไว้ใน event document ให้แยก collection `photos`
- เลือก Atlas region ให้ตรงกับ Cloud Run (`asia-southeast1`) และเปิด IP access ผ่าน VPC peering/Private Endpoint หรือ static egress IP (Cloud NAT) แทน `0.0.0.0/0` ใน production

ทางเลือกอื่นที่พิจารณาได้: PostgreSQL (Cloud SQL/Neon) + pgvector — เหมาะถ้าให้น้ำหนักกับระบบการเงินและรายงานเชิง relational มากกว่า แต่บน Cloud Run ต้องมี connection pooler เพิ่ม และ schema migration ช่วง MVP ช้ากว่า

## Cost Notes (Phase 1)

- **R2**: ไม่มีค่า egress — ได้เปรียบมากสำหรับแอปที่เสิร์ฟรูปจำนวนมาก จ่ายแค่ storage + operations
- **Cloud Run**: `min-instances=0` เกือบเป็นศูนย์ตอนไม่มีงาน
- **Atlas**: เริ่มที่ Free/Flex tier ได้ระหว่างพัฒนา แต่ production ควรใช้ dedicated tier เล็กสุดเพื่อ performance ที่คงที่และได้ backup
- **Image Transformations ของ Cloudflare**: คิดเงินตามจำนวน transformation ไม่ซ้ำต่อเดือน — Phase 1 จึงสร้าง thumb/display ฝั่ง client แทน
