import {
  DeleteObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";
import { UPLOAD_LIMITS } from "./models";

let client: S3Client | undefined;

export function s3(): S3Client {
  if (!client) {
    const e = env();
    client = new S3Client({
      region: "auto", // R2 ignores region but the SDK requires one
      endpoint: e.R2_ENDPOINT,
      forcePathStyle: true,
      credentials: { accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY },
      // R2 rejects the CRC32 checksum headers newer SDKs add by default to presigned PUTs.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return client;
}

/**
 * Presigned PUT URL that only accepts exactly `contentType` and `contentLength`,
 * so the browser uploads straight to R2 without the file passing through Cloud Run.
 */
export function presignPut(key: string, contentType: string, contentLength: number): Promise<string> {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: env().R2_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    {
      expiresIn: UPLOAD_LIMITS.presignExpiresSeconds,
      signableHeaders: new Set(["content-type", "content-length"]),
    },
  );
}

export async function headObject(key: string): Promise<HeadObjectCommandOutput | null> {
  try {
    return await s3().send(new HeadObjectCommand({ Bucket: env().R2_BUCKET, Key: key }));
  } catch (error) {
    if (error instanceof NotFound || (error as { name?: string }).name === "NotFound") return null;
    throw error;
  }
}

/**
 * Deletes objects one by one. DeleteObjects (batch) requires a checksum header whose
 * algorithm support differs between R2 and S3 SDK versions; photos only have a few keys.
 */
export async function deleteObjects(keys: string[]): Promise<void> {
  await Promise.all(keys.map((Key) => s3().send(new DeleteObjectCommand({ Bucket: env().R2_BUCKET, Key }))));
}

export function publicUrl(key: string): string {
  return `${env().R2_PUBLIC_BASE_URL}/${key}`;
}
