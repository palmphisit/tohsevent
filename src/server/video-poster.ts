import { spawn } from "node:child_process";
import { env } from "./env";

// Poster frames cut on the server with ffmpeg. Browsers cannot always draw a frame
// (iOS Safari, HEVC clips on Chrome), ffmpeg reads every format guests upload.

const TIMEOUT_MS = 30_000;
const DISPLAY_EDGE = 2560;
const THUMB_EDGE = 480;

let missingBinary = false;

/** True once we know ffmpeg cannot be started here. */
export function ffmpegMissing(): boolean {
  return missingBinary;
}

// One ffmpeg at a time per instance: Cloud Run gives us 512 MiB shared with Node, and a
// 4K HEVC frame alone needs a good part of that.
let queue: Promise<unknown> = Promise.resolve();

function run(args: string[], input?: Uint8Array, onStderr?: (text: string) => void): Promise<Buffer | null> {
  const job = queue.then(() => runNow(["-threads", "1", ...args], input, onStderr));
  queue = job.catch(() => {});
  return job;
}

function runNow(args: string[], input?: Uint8Array, onStderr?: (text: string) => void): Promise<Buffer | null> {
  if (missingBinary) return Promise.resolve(null);
  return new Promise((resolve) => {
    const child = spawn(env().FFMPEG_PATH, args, { stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), TIMEOUT_MS);
    child.stdout!.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr!.on("data", (chunk: Buffer) => (err += chunk.toString()).length > 4_000 && (err = err.slice(-4_000)));
    child.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (error.code === "ENOENT") {
        missingBinary = true;
        console.warn("video-poster: ffmpeg not found; server-side posters are disabled");
      } else console.error("video-poster: ffmpeg failed to start", error);
      resolve(null);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      onStderr?.(err);
      const body = Buffer.concat(out);
      if (code === 0 && body.length > 0) resolve(body);
      else {
        if (err.trim() && !onStderr) console.warn("video-poster: ffmpeg", code, err.trim().slice(-500));
        resolve(null);
      }
    });
    if (input) child.stdin!.end(input);
  });
}

/**
 * Clip length in seconds, read by ffmpeg (for clips the uploader's browser could not open).
 * Null when ffmpeg is unavailable or cannot read the file.
 */
export async function probeDuration(url: string): Promise<number | null> {
  let stderr = "";
  // No output file: ffmpeg prints the input's details and exits with an error, which is expected.
  await run(["-hide_banner", "-nostdin", "-i", url], undefined, (text) => (stderr = text));
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  if (!m || !/Stream #.*Video:/.test(stderr)) return null;
  const seconds = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return seconds > 0 ? seconds : null;
}

const scale = (edge: number) => `scale=w='min(${edge},iw)':h='min(${edge},ih)':force_original_aspect_ratio=decrease`;

/** Pixel size from a baseline/progressive JPEG's SOF marker. */
export function jpegSize(jpeg: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < jpeg.length) {
    if (jpeg[i] !== 0xff) return null;
    const marker = jpeg[i + 1];
    const length = (jpeg[i + 2] << 8) | jpeg[i + 3];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: (jpeg[i + 5] << 8) | jpeg[i + 6], width: (jpeg[i + 7] << 8) | jpeg[i + 8] };
    }
    i += 2 + length;
  }
  return null;
}

/**
 * Grabs a frame from the clip at `url` (ffmpeg range-reads it, so only the needed bytes
 * are fetched) and returns display + thumb JPEGs. Null when ffmpeg is unavailable or the
 * clip cannot be decoded.
 */
export async function cutPoster(
  url: string,
  durationSec: number,
): Promise<{ display: Buffer; thumb: Buffer; width: number; height: number } | null> {
  const grab = (at: number) =>
    run([
      ...["-hide_banner", "-loglevel", "error", "-nostdin"],
      ...["-ss", String(at), "-i", url],
      ...["-frames:v", "1", "-vf", `${scale(DISPLAY_EDGE)},format=yuvj420p`, "-q:v", "3"],
      ...["-f", "image2", "-c:v", "mjpeg", "pipe:1"],
    ]);
  // Half a second in skips fade-ins; very short clips fall back to their first frame.
  const display = (durationSec > 1 ? await grab(0.5) : null) ?? (await grab(0));
  if (!display) return null;
  const size = jpegSize(display);
  const thumb = await run(
    [
      ...["-hide_banner", "-loglevel", "error"],
      ...["-f", "image2pipe", "-c:v", "mjpeg", "-i", "pipe:0"],
      ...["-vf", `${scale(THUMB_EDGE)},format=yuvj420p`, "-q:v", "5"],
      ...["-f", "image2", "-c:v", "mjpeg", "pipe:1"],
    ],
    display,
  );
  if (!size || !thumb) return null;
  return { display, thumb, ...size };
}
