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

เปิด http://localhost:3000/e/demo (งาน public) หรือ http://localhost:3000/e/demo-private (รหัสผ่าน `1234`)

## Upload flow

ไฟล์รูปไม่ผ่าน Cloud Run เลย เบราว์เซอร์อัปโหลดตรงเข้า R2

1. เบราว์เซอร์ย่อรูปเป็น `display` (2560px) และ `thumb` (480px) ด้วย canvas ซึ่งลบ EXIF/GPS ออกไปด้วย
2. `POST /api/v1/events/:slug/uploads` จองโควตาของแขก สร้าง photo ที่สถานะ `pending` และคืน presigned PUT URL
   (เซ็น `Content-Type` และ `Content-Length` ไว้ ถ้าไฟล์ไม่ตรงกับที่ประกาศ storage จะตอบ 403)
3. เบราว์เซอร์ `PUT` ทั้งสองไฟล์ตรงเข้า R2
4. `POST /api/v1/events/:slug/photos/:id/complete` ตรวจ object ใน R2 ด้วย `HEAD` แล้วเปลี่ยนเป็น `ready`

## API (v1)

| Method | Path | Description |
|---|---|---|
| GET | `/api/healthz` | Health check (ping MongoDB) |
| GET | `/api/v1/events/:slug` | ข้อมูลอีเวนต์สำหรับแขก |
| GET / POST | `/api/v1/events/:slug/session` | ดู / สร้าง guest session (เป็น cookie แยกต่ออีเวนต์) |
| GET | `/api/v1/events/:slug/photos?source=guest\|official&cursor=` | รายการรูป (แบ่งหน้าด้วย cursor) |
| POST | `/api/v1/events/:slug/uploads` | ขอ presigned upload URL (สูงสุด 10 ไฟล์ต่อครั้ง) |
| POST | `/api/v1/events/:slug/photos/:photoId/complete` | ยืนยันว่าอัปโหลดเสร็จแล้ว |

## Project layout

```
src/
  app/
    api/            Route handlers (REST API, ใช้ร่วมกับ native apps ในอนาคต)
    e/[slug]/       Guest PWA: หน้าอีเวนต์, ตัวอัปโหลด, แกลเลอรี
  lib/              โค้ดฝั่ง client (ย่อรูป, API client)
  server/           โค้ดฝั่ง server เท่านั้น (env, db, storage, sessions, services)
scripts/setup.ts    สร้าง index, bucket/CORS และ seed (ใช้ได้ทุก environment)
Dockerfile          Image สำหรับ Cloud Run (standalone output, port 8080)
```
