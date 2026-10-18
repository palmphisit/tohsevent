// Client-side image preparation: decode (applying EXIF orientation), downscale and
// re-encode as JPEG. Re-encoding through <canvas> also strips EXIF metadata such as
// GPS location, so guests never leak where a photo was taken.
import type { VideoContentType } from "@/server/models";

export const IMAGE_VARIANTS = {
  display: { maxEdge: 2560, quality: 0.85 },
  thumb: { maxEdge: 480, quality: 0.75 },
} as const;

export interface PreparedImage {
  display: Blob;
  thumb: Blob;
  /** Display-size copy with the platform watermark (Free events only). */
  watermarked?: Blob;
  width: number;
  height: number;
  /** Video items: the clip itself, uploaded as-is; display/thumb are its poster frames (see lib/video.ts). */
  video?: { blob: Blob; contentType: VideoContentType; durationSec: number; posterFallback?: boolean };
}

export const WATERMARK_TEXT = "Tohs Event";

/** Draws the platform mark in the bottom-right corner (rounded dark pill, white text). */
function drawWatermark(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = draw(source, source.width, source.height);
  const ctx = canvas.getContext("2d")!;
  const short = Math.min(canvas.width, canvas.height);
  const fontSize = Math.max(16, Math.round(short * 0.045));
  const padX = Math.round(fontSize * 0.7);
  const padY = Math.round(fontSize * 0.45);
  const margin = Math.round(short * 0.03);
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = "middle";
  const textWidth = ctx.measureText(WATERMARK_TEXT).width;
  const boxW = textWidth + padX * 2;
  const boxH = fontSize + padY * 2;
  const x = canvas.width - boxW - margin;
  const y = canvas.height - boxH - margin;

  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.roundRect(x, y, boxW, boxH, boxH / 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fillText(WATERMARK_TEXT, x + padX, y + boxH / 2);
  return canvas;
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decode(file: Blob): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    // Fallback for browsers whose createImageBitmap can't decode the format (e.g. HEIC on some Safari versions).
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  }
}

export function fit(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function draw(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

export function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image encoding failed"))), "image/jpeg", quality);
  });
}

export async function prepareImage(file: Blob, options: { watermark?: boolean } = {}): Promise<PreparedImage> {
  const decoded = await decode(file);
  try {
    const size = fit(decoded.width, decoded.height, IMAGE_VARIANTS.display.maxEdge);
    const displayCanvas = draw(decoded.source, size.width, size.height);
    const thumbSize = fit(size.width, size.height, IMAGE_VARIANTS.thumb.maxEdge);
    const thumbCanvas = draw(displayCanvas, thumbSize.width, thumbSize.height);

    const watermarkCanvas = options.watermark ? drawWatermark(displayCanvas) : null;

    const [display, thumb, watermarked] = await Promise.all([
      toJpeg(displayCanvas, IMAGE_VARIANTS.display.quality),
      toJpeg(thumbCanvas, IMAGE_VARIANTS.thumb.quality),
      watermarkCanvas ? toJpeg(watermarkCanvas, IMAGE_VARIANTS.display.quality) : undefined,
    ]);
    // Release canvas backing stores early; iOS Safari caps total canvas memory.
    for (const c of [displayCanvas, thumbCanvas, watermarkCanvas]) if (c) c.width = c.height = 0;
    return { display, thumb, watermarked, width: size.width, height: size.height };
  } finally {
    decoded.release();
  }
}

/**
 * Single resized copy for branding images. PNG keeps transparency (logos); JPEG is
 * smaller for photos (cover).
 */
export async function resizeImage(
  file: Blob,
  options: { maxEdge: number; type: "image/png" | "image/jpeg"; quality?: number },
): Promise<Blob> {
  const decoded = await decode(file);
  try {
    const size = fit(decoded.width, decoded.height, options.maxEdge);
    const canvas = draw(decoded.source, size.width, size.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image encoding failed"))), options.type, options.quality),
    );
    canvas.width = canvas.height = 0;
    return blob;
  } finally {
    decoded.release();
  }
}
