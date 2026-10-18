import type { PublicPhoto } from "@/lib/api-client";
import { VideoBadge } from "./video-badge";

/**
 * Square gallery tile for a photo or video. Video tiles show the poster frame captured on
 * upload; when the uploader's browser could not capture one, the viewer's browser draws
 * the first frame from the clip itself.
 */
export function MediaThumb({
  photo,
  alt = "",
  className = "",
}: {
  photo: Pick<PublicPhoto, "thumbUrl" | "kind" | "videoUrl" | "durationSec" | "posterFallback">;
  alt?: string;
  className?: string;
}) {
  const liveFrame = photo.kind === "video" && photo.posterFallback && photo.videoUrl;
  return (
    <>
      {liveFrame ? (
        <span className="block h-full w-full bg-gradient-to-br from-primary-ink to-accent">
          <video
            src={`${photo.videoUrl}#t=0.5`}
            preload="metadata"
            muted
            playsInline
            aria-label={alt}
            className={`h-full w-full object-cover ${className}`}
          />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- served directly from R2/CDN
        <img src={photo.thumbUrl} alt={alt} loading="lazy" className={`h-full w-full object-cover ${className}`} />
      )}
      {photo.kind === "video" && <VideoBadge durationSec={photo.durationSec} />}
    </>
  );
}
