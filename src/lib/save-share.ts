// Saving photos/videos to the guest's phone and sharing them.
//
// iOS Safari has no way to write to the Photos app except the share sheet ("Save Image" /
// "Save Video"), so on iPhone/iPad saving goes through navigator.share with the files.
// Android and desktop browsers save a download straight to the device (Downloads/Gallery).
// navigator.share must run right after a tap, so files are fetched ahead of time where we can.

import type { PublicPhoto } from "./api-client";

type Media = Pick<PublicPhoto, "id" | "displayUrl" | "videoUrl" | "kind">;

/** The browser dropped the tap while the file was downloading: ask for one more tap. */
export class GestureRequired extends Error {}

const files = new Map<string, Promise<File>>();

function extension(type: string, url: string): string {
  if (type.includes("jpeg")) return "jpg";
  if (type.includes("webp")) return "webp";
  if (type.includes("mp4")) return "mp4";
  if (type.includes("quicktime")) return "mov";
  if (type.includes("webm")) return "webm";
  return url.split("?")[0].split(".").pop() ?? "bin";
}

/** The photo (display copy) or video clip as a File, fetched once and cached. */
export function mediaFile(photo: Media): Promise<File> {
  let file = files.get(photo.id);
  if (!file) {
    const url = photo.kind === "video" && photo.videoUrl ? photo.videoUrl : photo.displayUrl;
    file = fetch(url)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((blob) => new File([blob], `tohsevent-${photo.id}.${extension(blob.type, url)}`, { type: blob.type }));
    file.catch(() => files.delete(photo.id));
    files.set(photo.id, file);
  }
  return file;
}

/** Start fetching so a later tap can hand the file to the share sheet immediately. */
export function prefetchMedia(photo: Media): void {
  void mediaFile(photo).catch(() => {});
}

export function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function canShareFiles(list: File[]): boolean {
  try {
    return !!navigator.canShare?.({ files: list });
  } catch {
    return false;
  }
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function share(data: ShareData): Promise<"shared" | "cancelled"> {
  try {
    await navigator.share(data);
    return "shared";
  } catch (error) {
    const name = (error as Error).name;
    if (name === "AbortError") return "cancelled";
    if (name === "NotAllowedError") throw new GestureRequired();
    throw error;
  }
}

/** Saves files to the device: Photos via the share sheet on iOS, a download elsewhere. */
export async function saveToDevice(list: File[]): Promise<"saved" | "cancelled"> {
  if (isIOS() && canShareFiles(list)) {
    return (await share({ files: list })) === "shared" ? "saved" : "cancelled";
  }
  for (const [i, file] of list.entries()) {
    // Browsers block a burst of downloads; space them out a little.
    if (i > 0) await new Promise((r) => setTimeout(r, 400));
    download(file);
  }
  return "saved";
}

export interface ShareInfo {
  title: string;
  text: string;
  url: string;
}

/**
 * Shares the files (with a link to the album) through the phone's share sheet. Returns
 * "unsupported" when the browser has no share sheet: show the fallback links instead.
 */
export async function shareMedia(list: File[] | null, info: ShareInfo): Promise<"shared" | "cancelled" | "unsupported"> {
  if (list && list.length > 0 && canShareFiles(list)) {
    return share({ files: list, title: info.title, text: `${info.text}\n${info.url}` });
  }
  if (typeof navigator.share === "function") return share({ title: info.title, text: info.text, url: info.url });
  return "unsupported";
}

export function lineShareUrl(info: ShareInfo): string {
  return `https://line.me/R/share?text=${encodeURIComponent(`${info.text}\n${info.url}`)}`;
}

export function facebookShareUrl(info: ShareInfo): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(info.url)}`;
}
