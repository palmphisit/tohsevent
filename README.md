# Tohs Event

แพลตฟอร์มแชร์รูปงานอีเวนต์ด้วย QR Code: แขกสแกน ถ่ายรูป แล้วอัปโหลดได้ทันที ไม่ต้องโหลดแอป ไม่ต้องสมัครสมาชิก

- แผนพัฒนาแต่ละ Phase: [docs/ROADMAP.md](docs/ROADMAP.md)
- การ deploy (Cloud Run + Atlas + R2): [docs/DEPLOY.md](docs/DEPLOY.md)

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · MongoDB · Cloudflare R2 · Google Cloud Run

## Local development

ต้องมี Node 24+, pnpm และ Docker

```bash
pnpm install
cp .env.example .env.local
pnpm services:up      # MongoDB (Atlas Local) + RustFS (S3-compatible แทน R2)
pnpm setup:dev        # สร้าง index, bucket + CORS และอีเวนต์ demo
pnpm dev
```

- หน้าแขก: http://localhost:3000/e/demo (งาน public) หรือ http://localhost:3000/e/demo-private (รหัสผ่าน `1234`)
- หน้าเจ้าภาพ: http://localhost:3000/dashboard สมัครบัญชีด้วยอีเมลใดก็ได้ (ไม่มีการส่งอีเมลยืนยัน)

## Upload flow

ไฟล์รูปไม่ผ่าน Cloud Run เลย เบราว์เซอร์อัปโหลดตรงเข้า R2

1. เบราว์เซอร์ย่อรูปเป็น `display` (2560px) และ `thumb` (480px) ด้วย canvas ซึ่งลบ EXIF/GPS ออกไปด้วย
2. `POST /api/v1/events/:slug/uploads` จองโควตาของแขก สร้าง photo ที่สถานะ `pending` และคืน presigned PUT URL
   (เซ็น `Content-Type` และ `Content-Length` ไว้ ถ้าไฟล์ไม่ตรงกับที่ประกาศ storage จะตอบ 403)
3. เบราว์เซอร์ `PUT` ทั้งสองไฟล์ตรงเข้า R2
4. `POST /api/v1/events/:slug/photos/:id/complete` ตรวจ object ใน R2 ด้วย `HEAD` แล้วเปลี่ยนเป็น `ready`

ไฟล์ที่ยังอัปโหลดไม่เสร็จถูกเก็บไว้ใน IndexedDB ของเบราว์เซอร์ ถ้าแขกปิดแท็บกลางคัน (iOS ไม่มี Background Sync)
รูปที่เหลือจะอัปโหลดต่อเองเมื่อเปิดหน้างานอีกครั้ง ส่วนการจองที่ค้างเกิน 24 ชม. จะถูกล้างโดย `/api/internal/cleanup`

## API (v1)

| Method | Path | Description |
|---|---|---|
| GET | `/api/healthz` | Health check (ping MongoDB) |
| GET | `/api/v1/events/:slug` | ข้อมูลอีเวนต์สำหรับแขก |
| GET / POST | `/api/v1/events/:slug/session` | ดู / สร้าง guest session (เป็น cookie แยกต่ออีเวนต์) |
| GET | `/api/v1/events/:slug/photos?source=guest\|official&cursor=` | รายการรูป (แบ่งหน้าด้วย cursor) |
| POST | `/api/v1/events/:slug/uploads` | ขอ presigned upload URL (สูงสุด 10 ไฟล์ต่อครั้ง) |
| POST | `/api/v1/events/:slug/photos/:photoId/complete` | ยืนยันว่าอัปโหลดเสร็จแล้ว |
| POST | `/api/v1/events/:slug/photos/:photoId/report` | แขกรายงาน / ขอลบรูป (`inappropriate`, `remove_me`, `other`) |
| POST | `/api/v1/host/events/:id/checkout` | เริ่ม Stripe Checkout เพื่ออัปเกรดแพ็กเกจ (`{ tier }`) |
| POST | `/api/stripe/webhook` | Stripe webhook (`checkout.session.*`) |
| POST | `/api/internal/cleanup` | งานรายวันสำหรับ Cloud Scheduler: ล้างอัปโหลดค้าง, ปิดอัลบั้มหมดอายุ, ลบไฟล์อัลบั้มที่หมดอายุเกิน 7 วัน (`Authorization: Bearer <CRON_SECRET>`) |
| * | `/api/auth/*` | บัญชีเจ้าภาพ (Better Auth): `sign-up/email`, `sign-in/email`, `sign-out`, `get-session` |
| GET / POST | `/api/v1/host/events` | รายการงานของฉัน / สร้างงาน (ต้อง login) |
| GET / PATCH | `/api/v1/host/events/:id` | ดู / แก้ไขงาน (เฉพาะเจ้าของ) |
| GET | `/api/v1/host/events/:id/qr?format=png\|svg&size=` | ดาวน์โหลด QR Code ของหน้าแขก |
| GET | `/api/v1/host/events/:id/photos?view=guest\|official\|reported` | รูปทั้งหมดรวมที่ซ่อนอยู่ สำหรับ moderation |
| PATCH / DELETE | `/api/v1/host/events/:id/photos/:photoId` | ซ่อน/แสดง (`status`), ปิดรายงาน (`dismissReports`) / ลบรูปและไฟล์ใน storage |
| POST | `/api/v1/host/events/:id/uploads` และ `.../photos/:photoId/complete` | อัปโหลดรูป Official (flow เดียวกับแขก) |

## Project layout

```
src/
  app/
    api/            Route handlers (REST API, ใช้ร่วมกับ native apps ในอนาคต)
    e/[slug]/       Guest PWA: หน้าอีเวนต์, ตัวอัปโหลด, แกลเลอรี
    dashboard/      Host console: รายการงาน, สร้าง/แก้ไขงาน, QR Code, โปสเตอร์
    login/          เข้าสู่ระบบ / สมัครสมาชิกเจ้าภาพ
  lib/              โค้ดฝั่ง client (ย่อรูป, API client)
  server/           โค้ดฝั่ง server เท่านั้น (env, db, storage, auth, sessions, services)
  proxy.ts          กันหน้า /dashboard ให้ redirect ไป /login เมื่อไม่มี session
scripts/setup.ts    สร้าง index, bucket/CORS และ seed (ใช้ได้ทุก environment)
scripts/load/       k6 load test (แขกอัปโหลดพร้อมกัน) ดูวิธีรันใน docs/DEPLOY.md
Dockerfile          Image สำหรับ Cloud Run (standalone output, port 8080)
```
