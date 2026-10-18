import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";
import { s3 } from "./storage";

// Original (full-resolution) files live in a separate, non-public bucket. They are only
// reachable through short-lived presigned URLs, never through the public media domain.

export function originalsBucket(): string | null {
  return env().R2_ORIGINALS_BUCKET ?? null;
}

function bucket(): string {
  const name = originalsBucket();
  if (!name) throw new Error("R2_ORIGINALS_BUCKET is not configured");
  return name;
}

export async function createMultipart(key: string, contentType: string): Promise<string> {
  const res = await s3().send(new CreateMultipartUploadCommand({ Bucket: bucket(), Key: key, ContentType: contentType }));
  if (!res.UploadId) throw new Error("No UploadId from storage");
  return res.UploadId;
}

export function presignPart(key: string, uploadId: string, partNumber: number): Promise<string> {
  return getSignedUrl(s3(), new UploadPartCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, PartNumber: partNumber }), {
    expiresIn: 60 * 60,
  });
}

export async function listParts(key: string, uploadId: string): Promise<{ partNumber: number; etag: string; size: number }[]> {
  const parts: { partNumber: number; etag: string; size: number }[] = [];
  let marker: string | undefined;
  do {
    const res = await s3().send(
      new ListPartsCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, PartNumberMarker: marker }),
    );
    for (const p of res.Parts ?? []) parts.push({ partNumber: p.PartNumber!, etag: p.ETag!, size: p.Size ?? 0 });
    marker = res.IsTruncated ? res.NextPartNumberMarker : undefined;
  } while (marker);
  return parts;
}

export async function completeMultipart(key: string, uploadId: string, parts: { partNumber: number; etag: string }[]) {
  await s3().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })) },
    }),
  );
}

export async function abortMultipart(key: string, uploadId: string): Promise<void> {
  await s3().send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: key, UploadId: uploadId }));
}

export async function headOriginal(key: string): Promise<{ size: number } | null> {
  try {
    const res = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { size: res.ContentLength ?? 0 };
  } catch (error) {
    if ((error as { name?: string }).name === "NotFound") return null;
    throw error;
  }
}

export async function deleteOriginal(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** Short-lived download link that saves the file under its original name. */
export function presignOriginalDownload(key: string, filename: string): Promise<string> {
  const safe = filename.replace(/["\\\r\n]/g, "_");
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: `attachment; filename="${safe.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(safe)}`,
    }),
    { expiresIn: 10 * 60 },
  );
}
