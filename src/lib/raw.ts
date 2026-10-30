// Camera RAW files (CR2/CR3, NEF, ARW, DNG, RAF, ORF, RW2, …): browsers cannot decode the
// sensor data, but almost every RAW file carries a full-size JPEG the camera rendered when the
// shot was taken. We find the largest such JPEG and use it like an ordinary photo; the RAW
// itself is never uploaded.

export const RAW_EXTENSIONS = [
  "3fr", "arw", "cr2", "cr3", "crw", "dng", "erf", "iiq", "kdc", "mos", "mrw",
  "nef", "nrw", "orf", "pef", "raf", "rw2", "rwl", "sr2", "srf", "srw", "x3f",
] as const;

/** For `<input accept>` on desktop: some OSes don't map RAW extensions to image/*. */
export const RAW_ACCEPT = RAW_EXTENSIONS.map((ext) => `.${ext}`).join(",");

/** RAW uploads are published at most this size (long edge, px). */
export const RAW_MAX_EDGE = 2048;

export class RawRejected extends Error {
  readonly code = "raw_unsupported";
}

export function isRawFile(file: Blob): boolean {
  const name = "name" in file && typeof file.name === "string" ? file.name.toLowerCase() : "";
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  if ((RAW_EXTENSIONS as readonly string[]).includes(ext)) return true;
  return /^image\/(x-(canon|nikon|sony|adobe|fuji|olympus|panasonic|pentax|samsung|hasselblad|kodak|minolta|leica|sigma)-|x-dcraw|x-raw)/.test(
    file.type,
  );
}

interface Jpeg {
  start: number;
  end: number;
  width: number;
  height: number;
  /** EXIF orientation inside this JPEG, if it has one. */
  orientation: number | null;
}

/** Orientation tag (0x0112) from the first IFD of a TIFF structure at `base`, or null. */
function tiffOrientation(b: Uint8Array, base: number): number | null {
  if (base + 8 > b.length) return null;
  const le = b[base] === 0x49 && b[base + 1] === 0x49;
  const be = b[base] === 0x4d && b[base + 1] === 0x4d;
  if (!le && !be) return null;
  const u16 = (p: number) => (le ? b[p] | (b[p + 1] << 8) : (b[p] << 8) | b[p + 1]);
  const u32 = (p: number) =>
    le ? (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0 : ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;
  const ifd = base + u32(base + 4);
  if (ifd + 2 > b.length) return null;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > b.length) return null;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

/**
 * Walks one JPEG from its SOI marker: segments up to each scan, then the entropy-coded data
 * (where 0xFF is always stuffed), until EOI. Returns null for anything that isn't a complete
 * baseline/progressive JPEG (e.g. the lossless JPEG that some RAWs use for sensor data).
 */
function parseJpeg(b: Uint8Array, start: number): Jpeg | null {
  let p = start + 2;
  let width = 0;
  let height = 0;
  let sof = 0;
  let orientation: number | null = null;
  while (p + 4 <= b.length) {
    if (b[p] !== 0xff) return null;
    while (b[p] === 0xff && p < b.length) p++;
    const marker = b[p++];
    if (marker === 0xd9) {
      if (!sof || !width || !height || ![0xc0, 0xc1, 0xc2].includes(sof)) return null;
      return { start, end: p, width, height, orientation };
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
    const length = (b[p] << 8) | b[p + 1];
    if (length < 2 || p + length > b.length) return null;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      sof = marker;
      height = (b[p + 3] << 8) | b[p + 4];
      width = (b[p + 5] << 8) | b[p + 6];
    } else if (marker === 0xe1 && orientation === null && b[p + 2] === 0x45 && b[p + 3] === 0x78 && b[p + 4] === 0x69 && b[p + 5] === 0x66) {
      orientation = tiffOrientation(b, p + 8); // "Exif\0\0" then TIFF
    }
    p += length;
    if (marker === 0xda) {
      // Entropy-coded data: stop at the next real marker (not stuffing, not a restart marker).
      while (p + 1 < b.length) {
        if (b[p] === 0xff) {
          const next = b[p + 1];
          if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) p += 2;
          else if (next === 0xff) p += 1;
          else break;
        } else p++;
      }
    }
  }
  return null;
}

/** Largest decodable JPEG embedded in the RAW, plus the container's orientation. */
export function findRawPreview(b: Uint8Array): { jpeg: Jpeg; containerOrientation: number | null } | null {
  let best: Jpeg | null = null;
  for (let i = 0; i + 3 < b.length; i++) {
    if (b[i] !== 0xff || b[i + 1] !== 0xd8 || b[i + 2] !== 0xff) continue;
    const jpeg = parseJpeg(b, i);
    if (!jpeg) continue;
    if (!best || jpeg.width * jpeg.height > best.width * best.height) best = jpeg;
    i = jpeg.end - 1; // its EXIF thumbnail is smaller anyway
  }
  if (!best) return null;
  // TIFF-based RAWs keep the orientation in IFD0 ("II*\0", "MM\0*", ORF "IIRO", RW2 "IIU\0").
  const containerOrientation = b[0] === 0x49 || b[0] === 0x4d ? tiffOrientation(b, 0) : null;
  return { jpeg: best, containerOrientation };
}

/** Draws `bitmap` (decoded without orientation) the way EXIF orientation 1–8 says it should look. */
function orient(bitmap: ImageBitmap, orientation: number): HTMLCanvasElement {
  const swap = orientation >= 5;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? bitmap.height : bitmap.width;
  canvas.height = swap ? bitmap.width : bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  const { width: w, height: h } = bitmap;
  const transforms: Record<number, [number, number, number, number, number, number]> = {
    2: [-1, 0, 0, 1, w, 0],
    3: [-1, 0, 0, -1, w, h],
    4: [1, 0, 0, -1, 0, h],
    5: [0, 1, 1, 0, 0, 0],
    6: [0, 1, -1, 0, h, 0],
    7: [0, -1, -1, 0, h, w],
    8: [0, -1, 1, 0, 0, w],
  };
  const t = transforms[orientation];
  if (t) ctx.setTransform(...t);
  ctx.drawImage(bitmap, 0, 0);
  return canvas;
}

/** Decodes a RAW file through its embedded JPEG, upright. Throws RawRejected when there is none. */
export async function decodeRaw(
  file: Blob,
): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const found = findRawPreview(bytes);
  if (!found) throw new RawRejected("No usable preview in this RAW file");
  const { jpeg, containerOrientation } = found;
  const blob = new Blob([bytes.subarray(jpeg.start, jpeg.end)], { type: "image/jpeg" });
  // The preview's own EXIF orientation wins; otherwise apply the RAW container's.
  if (jpeg.orientation !== null || !containerOrientation || containerOrientation === 1) {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  }
  const bitmap = await createImageBitmap(blob, { imageOrientation: "none" });
  try {
    const canvas = orient(bitmap, containerOrientation);
    return { source: canvas, width: canvas.width, height: canvas.height, release: () => (canvas.width = canvas.height = 0) };
  } finally {
    bitmap.close();
  }
}
