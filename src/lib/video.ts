// Client-side video preparation: the clip is uploaded untouched, plus two JPEG poster
// frames (display + thumb) grabbed from it so galleries can show it like any photo.
import type { VideoContentType } from "@/server/models";
import { draw, fit, IMAGE_VARIANTS, toJpeg, type PreparedImage } from "./image";

export interface VideoLimits {
  maxBytes: number;
  maxDurationSec: number;
}

export class VideoRejected extends Error {
  constructor(readonly code: "video_not_allowed" | "video_too_large" | "video_too_long" | "video_unsupported") {
    super(code);
  }
}

const BY_EXTENSION: Record<string, VideoContentType> = { mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm" };

/** Content type we store the clip under, or null when the file is not a video we accept. */
export function videoContentType(file: Blob): VideoContentType | null {
  if (file.type === "video/mp4" || file.type === "video/quicktime" || file.type === "video/webm") return file.type;
  const name = file instanceof File ? file.name : "";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (file.type.startsWith("video/") || !file.type) return BY_EXTENSION[ext] ?? null;
  return null;
}

export function isVideoFile(file: Blob): boolean {
  if (file.type.startsWith("video/")) return true;
  return !file.type && videoContentType(file) !== null;
}

function once(target: HTMLVideoElement, event: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`video ${event} timed out`));
    }, timeoutMs);
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("video decode failed"));
    };
    function cleanup() {
      clearTimeout(timer);
      target.removeEventListener(event, onEvent);
      target.removeEventListener("error", onError);
    }
    target.addEventListener(event, onEvent);
    target.addEventListener("error", onError);
  });
}

/** Neutral poster for clips the browser cannot decode (e.g. HEVC on desktop Chrome). */
function placeholderPoster(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#1e3a8a");
  gradient.addColorStop(1, "#0ea5e9");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  const r = Math.min(width, height) * 0.12;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.moveTo(width / 2 - r * 0.6, height / 2 - r);
  ctx.lineTo(width / 2 + r, height / 2);
  ctx.lineTo(width / 2 - r * 0.6, height / 2 + r);
  ctx.closePath();
  ctx.fill();
  return canvas;
}

/**
 * Reads duration and a poster frame, checks the plan limits, and returns the same shape as
 * prepareImage so the upload queue treats videos like photos.
 */
export async function prepareVideo(file: Blob, limits: VideoLimits | null): Promise<PreparedImage> {
  if (!limits) throw new VideoRejected("video_not_allowed");
  const contentType = videoContentType(file);
  if (!contentType) throw new VideoRejected("video_unsupported");
  if (file.size > limits.maxBytes) throw new VideoRejected("video_too_large");

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    let durationSec: number;
    let poster: HTMLCanvasElement;
    try {
      await once(video, "loadedmetadata", 15_000);
      durationSec = video.duration;
      if (!Number.isFinite(durationSec)) {
        // Some WebM recordings report Infinity until the end has been seen.
        video.currentTime = 1e7;
        await once(video, "seeked", 15_000);
        durationSec = video.duration;
      }
      if (durationSec > limits.maxDurationSec + 1) throw new VideoRejected("video_too_long");
      video.currentTime = Math.min(0.5, durationSec / 2);
      await once(video, "seeked", 15_000);
      const size = fit(video.videoWidth || 1280, video.videoHeight || 720, IMAGE_VARIANTS.display.maxEdge);
      poster = draw(video, size.width, size.height);
    } catch (error) {
      if (error instanceof VideoRejected) throw error;
      // Metadata loaded but no frame decodes in this browser (e.g. HEVC): keep the clip, use a
      // placeholder poster. Without a known duration we cannot check the limit, so reject.
      if (!Number.isFinite(video.duration) || video.duration <= 0) throw new VideoRejected("video_unsupported");
      durationSec = video.duration;
      if (durationSec > limits.maxDurationSec + 1) throw new VideoRejected("video_too_long");
      poster = placeholderPoster(1280, 720);
    }

    const thumbSize = fit(poster.width, poster.height, IMAGE_VARIANTS.thumb.maxEdge);
    const thumbCanvas = draw(poster, thumbSize.width, thumbSize.height);
    const [display, thumb] = await Promise.all([
      toJpeg(poster, IMAGE_VARIANTS.display.quality),
      toJpeg(thumbCanvas, IMAGE_VARIANTS.thumb.quality),
    ]);
    const width = poster.width;
    const height = poster.height;
    for (const c of [poster, thumbCanvas]) c.width = c.height = 0;
    return { display, thumb, width, height, video: { blob: file, contentType, durationSec } };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
