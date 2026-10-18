// Client-side image preparation: decode (applying EXIF orientation), downscale and
// re-encode as JPEG. Re-encoding through <canvas> also strips EXIF metadata such as
// GPS location, so guests never leak where a photo was taken.

export const IMAGE_VARIANTS = {
  display: { maxEdge: 2560, quality: 0.85 },
  thumb: { maxEdge: 480, quality: 0.75 },
} as const;

export interface PreparedImage {
  display: Blob;
  thumb: Blob;
  width: number;
  height: number;
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

function fit(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function draw(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image encoding failed"))), "image/jpeg", quality);
  });
}

export async function prepareImage(file: Blob): Promise<PreparedImage> {
  const decoded = await decode(file);
  try {
    const size = fit(decoded.width, decoded.height, IMAGE_VARIANTS.display.maxEdge);
    const displayCanvas = draw(decoded.source, size.width, size.height);
    const thumbSize = fit(size.width, size.height, IMAGE_VARIANTS.thumb.maxEdge);
    const thumbCanvas = draw(displayCanvas, thumbSize.width, thumbSize.height);

    const [display, thumb] = await Promise.all([
      toJpeg(displayCanvas, IMAGE_VARIANTS.display.quality),
      toJpeg(thumbCanvas, IMAGE_VARIANTS.thumb.quality),
    ]);
    // Release canvas backing stores early; iOS Safari caps total canvas memory.
    displayCanvas.width = displayCanvas.height = thumbCanvas.width = thumbCanvas.height = 0;
    return { display, thumb, width: size.width, height: size.height };
  } finally {
    decoded.release();
  }
}
