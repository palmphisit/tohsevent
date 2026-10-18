import { Play } from "lucide-react";
import { formatDuration } from "@/lib/video";

/** Corner badge on gallery thumbnails of video items. */
export function VideoBadge({ durationSec }: { durationSec?: number }) {
  return (
    <span className="pointer-events-none absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
      <Play className="h-3 w-3 fill-current" />
      {durationSec !== undefined && formatDuration(durationSec)}
    </span>
  );
}
