/**
 * Idempotent setup for an environment:
 *   - MongoDB indexes
 *   - Bucket existence + CORS rules (browser uploads via presigned PUT need CORS)
 *   - Public-read bucket policy (local RustFS only; R2 uses a custom domain instead)
 *   - Demo events when run with --seed (never in production)
 *
 * Local:      pnpm setup:dev
 * Production: pnpm tsx --env-file=.env.production scripts/setup.ts
 */
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";
import { ObjectId } from "mongodb";
import { collections, ensureIndexes, getMongoClient } from "../src/server/db";
import { env } from "../src/server/env";
import type { EventDoc } from "../src/server/models";
import { hashPassword } from "../src/server/password";
import { s3 } from "../src/server/storage";

const seed = process.argv.includes("--seed");

async function setupBucket() {
  const { R2_BUCKET: Bucket, R2_ENDPOINT, APP_ORIGIN } = env();
  const isLocal = /localhost|127\.0\.0\.1/.test(R2_ENDPOINT);

  try {
    await s3().send(new HeadBucketCommand({ Bucket }));
  } catch {
    console.log(`Creating bucket ${Bucket}`);
    await s3().send(new CreateBucketCommand({ Bucket }));
  }

  await s3().send(
    new PutBucketCorsCommand({
      Bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [APP_ORIGIN],
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["content-type"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  console.log(`CORS set on ${Bucket} for ${APP_ORIGIN}`);

  if (isLocal) {
    await s3().send(
      new PutBucketPolicyCommand({
        Bucket,
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            { Effect: "Allow", Principal: { AWS: ["*"] }, Action: ["s3:GetObject"], Resource: [`arn:aws:s3:::${Bucket}/*`] },
          ],
        }),
      }),
    );
    console.log(`Public-read policy set on local bucket ${Bucket}`);
  }
}

async function seedDemoEvents() {
  if (env().NODE_ENV === "production") throw new Error("Refusing to seed demo data in production");
  const { events } = await collections();
  const now = new Date();
  const base = (slug: string, title: string): EventDoc => ({
    _id: new ObjectId(),
    slug,
    ownerId: null,
    title,
    date: now,
    access: { mode: "public" },
    settings: { guestUpload: true, moderation: "post", maxPhotosPerGuest: 200 },
    status: "live",
    expiresAt: null,
    counters: { photos: 0, guests: 0 },
    createdAt: now,
    updatedAt: now,
  });

  const demos: EventDoc[] = [
    base("demo", "Demo Wedding · งานแต่งตัวอย่าง"),
    { ...base("demo-private", "Private Party (password: 1234)"), access: { mode: "password", passwordHash: await hashPassword("1234") } },
  ];
  for (const demo of demos) {
    const { _id, ...fields } = demo;
    const res = await events.updateOne({ slug: demo.slug }, { $setOnInsert: { _id, ...fields } }, { upsert: true });
    console.log(res.upsertedCount ? `Seeded event /e/${demo.slug}` : `Event /e/${demo.slug} already exists`);
  }
}

async function main() {
  await ensureIndexes();
  console.log("MongoDB indexes ensured");
  await setupBucket();
  if (seed) await seedDemoEvents();
}

main()
  .then(async () => {
    await (await getMongoClient()).close();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
