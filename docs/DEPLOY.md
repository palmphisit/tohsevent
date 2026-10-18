# Deploy: Cloud Run + MongoDB Atlas + Cloudflare R2

ขั้นตอนตั้งค่า production ครั้งแรก (ทำ staging ด้วยขั้นตอนเดียวกัน แต่แยก service / database / bucket)

## 1. MongoDB Atlas

1. สร้าง cluster บน **Google Cloud region `asia-southeast1` (Singapore)** ให้อยู่ region เดียวกับ Cloud Run
2. สร้าง Database user สิทธิ์ `readWrite` บน database `tohsevent`
3. Network Access: ช่วงเริ่มต้นใช้ `0.0.0.0/0` ได้ (มี user/password ป้องกัน) แต่ก่อนเปิดจริงควรเปลี่ยนเป็น
   static egress IP ของ Cloud Run (Serverless VPC Access + Cloud NAT) หรือ Private Service Connect
4. คัดลอก connection string `mongodb+srv://...` ไปใช้เป็น `MONGODB_URI`

## 2. Cloudflare R2

1. สร้าง bucket เช่น `tohsevent-prod` (Location hint: Asia-Pacific)
2. **Public access**: ผูก Custom Domain เช่น `media.tohsevent.com` กับ bucket ใช้ค่านี้เป็น `R2_PUBLIC_BASE_URL`
   (อย่าใช้ `r2.dev` ใน production เพราะมี rate limit และไม่ได้ CDN cache)
3. สร้าง **R2 API Token** แบบ *Object Read & Write* จำกัดเฉพาะ bucket นี้ จะได้ `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`
4. `R2_ENDPOINT` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
5. **CORS** (จำเป็น เพราะเบราว์เซอร์อัปโหลดตรงเข้า R2): ตั้งใน Dashboard → bucket → Settings → CORS Policy

   ```json
   [
     {
       "AllowedOrigins": ["https://tohsevent.com"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["content-type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   หรือรัน `scripts/setup.ts` ด้วย token ที่มีสิทธิ์ *Admin Read & Write* (สคริปต์จะตั้ง CORS และสร้าง index ของ Mongo ให้)

6. แนะนำตั้ง Cache Rule บน custom domain ให้ cache รูปนาน ๆ (key ของรูปไม่ซ้ำกันอยู่แล้ว ไม่ต้องกลัวได้รูปเก่าจาก cache)

## 3. Google Cloud

```bash
gcloud config set project <PROJECT_ID>
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
```

เก็บ secrets ใน Secret Manager:

```bash
printf '%s' 'mongodb+srv://...' | gcloud secrets create mongodb-uri --data-file=-
printf '%s' '<R2 secret>'       | gcloud secrets create r2-secret-access-key --data-file=-
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create session-secret --data-file=-
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create auth-secret --data-file=-
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create cron-secret --data-file=-
```

ให้ service account ของ Cloud Run อ่าน secrets ได้ (`roles/secretmanager.secretAccessor`)

## 4. สร้าง index ใน MongoDB (ครั้งแรก และทุกครั้งที่เพิ่ม index)

ดึง connection string จาก Secret Manager มาใช้เฉพาะคำสั่งนี้ (ไม่ต้องเก็บค่าลับไว้ในไฟล์)
และข้ามขั้น bucket เพราะตั้ง CORS ใน dashboard แล้ว:

```bash
MONGODB_URI="$(gcloud secrets versions access latest --secret=mongodb-uri)" pnpm tsx --env-file=.env.example scripts/setup.ts --skip-storage
```

เพิ่ม `--seed` ถ้าต้องการอีเวนต์ demo (`/e/demo`, `/e/demo-private`) ไว้ทดสอบ

## 5. Deploy

### อัตโนมัติผ่าน GitHub Actions (ปกติใช้ทางนี้)

ทุกครั้งที่ push เข้า `main` workflow [`.github/workflows/ci-deploy.yml`](../.github/workflows/ci-deploy.yml) จะ
lint → typecheck → build → build image → push ไป Artifact Registry (`tohsevent/web:<commit sha>`) → `gcloud run deploy`
→ เช็ก `/api/healthz` ส่วน Pull Request จะรันเฉพาะ CI ไม่ deploy

ยืนยันตัวตนกับ GCP ด้วย Workload Identity Federation (org policy ห้ามสร้าง service account key) ตั้งค่าครั้งเดียวด้วย:

```bash
bash scripts/gcp/setup-github-deploy.sh
```

สคริปต์สร้าง Artifact Registry repo, service account `github-deployer` (push image + deploy revision เท่านั้น)
และ WIF provider ที่รับ token จาก `palmphisit/tohsevent` branch `main` เท่านั้น

workflow เปลี่ยนแค่ image env vars, secrets และค่า scaling เดิมของ service จะคงไว้
ถ้าจะเปลี่ยนค่าเหล่านั้นให้ใช้ `gcloud run services update` (ดูด้านล่าง)

### ด้วยมือ (ครั้งแรก หรือเมื่อต้องเปลี่ยน env/secrets)

ใช้ `Dockerfile` ใน repo ได้เลย โดย Cloud Build จะ build ให้

```bash
gcloud run deploy tohsevent \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 1 --memory 512Mi \
  --concurrency 80 \
  --min-instances 0 --max-instances 10 \
  --set-env-vars "APP_ORIGIN=https://tohsevent.com,MONGODB_DB=tohsevent,R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com,R2_ACCESS_KEY_ID=<KEY_ID>,R2_BUCKET=tohsevent-prod,R2_PUBLIC_BASE_URL=https://media.tohsevent.com" \
  --set-secrets "MONGODB_URI=mongodb-uri:latest,R2_SECRET_ACCESS_KEY=r2-secret-access-key:latest,SESSION_SECRET=session-secret:latest,AUTH_SECRET=auth-secret:latest,CRON_SECRET=cron-secret:latest"
```

- **วันจัดงานจริง**: ตั้ง `--min-instances 1` ไว้ก่อนงานเริ่ม จะได้ไม่เจอ cold start ตอนแขกสแกน QR พร้อมกัน
- Health check: `GET /api/healthz` จะ ping MongoDB (ใช้เป็น startup/liveness probe ได้)
- Custom domain: ใช้ Cloud Run domain mapping หรือ Cloudflare proxy ชี้มาที่ service

## 6. งานรายวัน (Cloud Scheduler)

`POST /api/internal/cleanup` ทำ 2 อย่าง:
- ลบรูปที่จองอัปโหลดไว้แต่ไม่เสร็จเกิน 24 ชม. (ทั้ง record และไฟล์) และคืนโควตาให้แขก
- เปลี่ยนสถานะงานที่เลย `expiresAt` เป็น `expired`

endpoint นี้ต้องได้ header `Authorization: Bearer <CRON_SECRET>` ถ้าไม่ได้ตั้ง `CRON_SECRET` จะตอบ 503

```bash
gcloud services enable cloudscheduler.googleapis.com
gcloud scheduler jobs create http tohsevent-daily-cleanup \
  --location asia-southeast1 \
  --schedule "0 4 * * *" --time-zone "Asia/Bangkok" \
  --uri "https://<SERVICE_URL>/api/internal/cleanup" \
  --http-method POST \
  --attempt-deadline 300s \
  --headers "Authorization=Bearer $(gcloud secrets versions access latest --secret=cron-secret)"
```

ทดสอบทันทีโดยไม่ต้องรอเวลา:

```bash
gcloud scheduler jobs run tohsevent-daily-cleanup --location asia-southeast1
```

ค่า header จะถูกเก็บไว้ใน config ของ job (คนที่มีสิทธิ์ดู job ใน project จะเห็น) ถ้าเปลี่ยน `cron-secret`
ต้องอัปเดต job ด้วย `gcloud scheduler jobs update http ... --update-headers`

## 7. Load test ก่อนจัดงานจริง

สคริปต์ k6 อยู่ที่ `scripts/load/guest-upload.js` จำลองแขกเข้างานแล้วอัปโหลดพร้อมกัน (ค่าเริ่มต้น 200 คน คนละ 3 รูป)
ใช้ Docker รันได้โดยไม่ต้องติดตั้ง k6 **ทุกการอัปโหลดสร้างรูปและไฟล์จริง** ให้ยิงเฉพาะ environment ที่ใช้ทดสอบ
และใช้งานที่สร้างไว้สำหรับทดสอบโดยเฉพาะ

```bash
docker run --rm -i -e BASE_URL=https://<SERVICE_URL> -e SLUG=<test-event-slug> grafana/k6:1.3.0 run - < scripts/load/guest-upload.js
```

ผลบนเครื่อง local (production build + Mongo/RustFS ใน Docker, 18 ต.ค. 2026): แขก 200 คนพร้อมกัน, อัปโหลด ~7,500 รูป,
error 0%, API p95 79 ms ค่าบน Cloud Run + Atlas + R2 จะต่างออกไป ควรรันซ้ำก่อนงานจริง โดยเฉพาะถ้า Atlas เป็น tier ฟรี/Flex
ซึ่งจำกัดจำนวน connection และ ops/s

## 8. Stripe (รับชำระเงินค่าแพ็กเกจ)

ถ้าไม่ได้ตั้ง `STRIPE_SECRET_KEY` หน้าแพ็กเกจจะยังแสดงได้ แต่ปุ่มอัปเกรดจะถูกปิดไว้

1. Stripe Dashboard → Settings → Payment methods: เปิด **Cards** และ **PromptPay** (บัญชีธุรกิจไทย, สกุล THB)
2. Developers → Webhooks → Add endpoint
   - URL: `https://<SERVICE_URL>/api/stripe/webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired`
   - คัดลอก Signing secret (`whsec_...`)
3. เก็บ key ใน Secret Manager (เริ่มจาก test mode `sk_test_...` ก่อน) แล้วผูกเข้ากับ service:

```bash
printf '%s' 'sk_test_...' | gcloud secrets create stripe-secret-key --data-file=-
printf '%s' 'whsec_...' | gcloud secrets create stripe-webhook-secret --data-file=-
for s in stripe-secret-key stripe-webhook-secret; do
  gcloud secrets add-iam-policy-binding "$s" --member="serviceAccount:tohsevent-run@tohs-event.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" --condition=None
done
gcloud run services update tohsevent --region asia-southeast1 \
  --update-secrets "STRIPE_SECRET_KEY=stripe-secret-key:latest,STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest"
```

ทดสอบในเครื่อง: ใส่ `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` ใน `.env.local` แล้วใช้ Stripe CLI
`stripe listen --forward-to localhost:3000/api/stripe/webhook` (CLI จะแสดง `whsec_...` สำหรับใช้ในเครื่อง)
บัตรทดสอบ: `4242 4242 4242 4242`, วันหมดอายุในอนาคต, CVC อะไรก็ได้

webhook เป็นตัวยืนยันหลัก ส่วนหน้า `/dashboard/events/:id/plan?checkout=success` จะดึงสถานะจาก Stripe ซ้ำอีกรอบ
เผื่อ webhook มาช้า การอัปเกรดแต่ละครั้งถูก apply เพียงครั้งเดียวแม้ webhook จะถูกส่งซ้ำ

## 9. ฟีเจอร์เสริม (เปิดเมื่อพร้อม)

### Auto Moderation (Google Cloud Vision SafeSearch)

ตรวจรูปตอนอัปโหลด ถ้าเจอว่าน่าจะเป็นรูปโป๊/รุนแรง จะซ่อนรูปไว้ในแท็บ "ถูกรายงาน" ให้เจ้าภาพตรวจ
ถ้าเรียก Vision ไม่ได้ ระบบจะปล่อยรูปผ่านตามปกติ (fail-open) ค่าใช้จ่าย: ฟรี 1,000 รูปแรกต่อเดือน
จากนั้นประมาณ $1.50 ต่อ 1,000 รูป

```bash
gcloud services enable vision.googleapis.com
gcloud projects add-iam-policy-binding tohs-event --member="serviceAccount:tohsevent-run@tohs-event.iam.gserviceaccount.com" --role="roles/serviceusage.serviceUsageConsumer" --condition=None
gcloud run services update tohsevent --region asia-southeast1 --update-env-vars AUTO_MODERATION=vision
```

### อีเมลแจ้งเตือน (Resend)

ใช้แจ้งแขกที่สมัครไว้ว่ารูป Official พร้อมแล้ว และเตือนเจ้าภาพ 7 วันก่อนอัลบั้มหมดอายุ ถ้าไม่ได้ตั้ง key ฟีเจอร์เหล่านี้จะซ่อนอยู่

1. สมัคร Resend แล้วเพิ่มโดเมน `tohsevent.com` จากนั้นใส่ DNS record ที่ Resend ให้มาใน Cloudflare (SPF/DKIM) แบบ DNS only
2. สร้าง API key แล้วเก็บเข้า Secret Manager (วาง key แล้วกด Enter ตามด้วย Ctrl-D):

```bash
gcloud secrets create resend-api-key --data-file=-
gcloud secrets add-iam-policy-binding resend-api-key --member="serviceAccount:tohsevent-run@tohs-event.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor" --condition=None
gcloud run services update tohsevent --region asia-southeast1 --update-secrets RESEND_API_KEY=resend-api-key:latest --update-env-vars "EMAIL_FROM=Tohs Event <noreply@tohsevent.com>"
```

### ดาวน์โหลด ZIP

ไฟล์ ZIP ถูกสตรีมจาก Cloud Run ไฟล์ละ 300 รูป ควรขยาย request timeout เพื่อให้ไฟล์ใหญ่ดาวน์โหลดจบ:

```bash
gcloud run services update tohsevent --region asia-southeast1 --timeout 3600
```

## Checklist ก่อนเปิดใช้งาน

- [ ] `APP_ORIGIN` ตรงกับโดเมนจริง และอยู่ใน CORS ของ R2
- [ ] `SESSION_SECRET` และ `AUTH_SECRET` สุ่มใหม่ ไม่ใช้ค่า dev และไม่ซ้ำกัน
- [ ] รัน `scripts/setup.ts` กับ production แล้ว (index ครบ)
- [ ] ตั้ง Cloud Scheduler สำหรับ cleanup และทดสอบรันแล้ว
- [ ] รัน load test กับ environment จริงแล้ว และตั้ง `--min-instances 1` ช่วงวันงาน
- [ ] Stripe: เปลี่ยนเป็น live key, ลงทะเบียน webhook ของ live mode และทดลองจ่ายจริงด้วยยอดเล็ก ๆ 1 ครั้ง
- [ ] กรอกข้อมูลผู้ให้บริการใน `src/lib/legal.ts` และให้ทนายตรวจ `/privacy` กับ `/terms`
- [ ] ทดสอบอัปโหลดจากมือถือจริง (iOS Safari + Android Chrome) ผ่าน 4G
