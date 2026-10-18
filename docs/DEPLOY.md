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
```

ให้ service account ของ Cloud Run อ่าน secrets ได้ (`roles/secretmanager.secretAccessor`)

## 4. สร้าง index ใน MongoDB (ครั้งแรก และทุกครั้งที่เพิ่ม index)

```bash
pnpm tsx --env-file=.env.production scripts/setup.ts
```

`.env.production` เป็นไฟล์ในเครื่องที่ไม่ commit มีค่าเดียวกับที่ใช้ใน Cloud Run
(ไม่ต้องใส่ `--seed` เพราะสคริปต์จะไม่ยอม seed ข้อมูล demo เมื่อ `NODE_ENV=production`)

## 5. Deploy

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
  --set-secrets "MONGODB_URI=mongodb-uri:latest,R2_SECRET_ACCESS_KEY=r2-secret-access-key:latest,SESSION_SECRET=session-secret:latest"
```

- **วันจัดงานจริง**: ตั้ง `--min-instances 1` ไว้ก่อนงานเริ่ม จะได้ไม่เจอ cold start ตอนแขกสแกน QR พร้อมกัน
- Health check: `GET /api/healthz` จะ ping MongoDB (ใช้เป็น startup/liveness probe ได้)
- Custom domain: ใช้ Cloud Run domain mapping หรือ Cloudflare proxy ชี้มาที่ service

## Checklist ก่อนเปิดใช้งาน

- [ ] `APP_ORIGIN` ตรงกับโดเมนจริง และอยู่ใน CORS ของ R2
- [ ] `SESSION_SECRET` สุ่มใหม่ ไม่ใช้ค่า dev
- [ ] รัน `scripts/setup.ts` กับ production แล้ว (index ครบ)
- [ ] ทดสอบอัปโหลดจากมือถือจริง (iOS Safari + Android Chrome) ผ่าน 4G
