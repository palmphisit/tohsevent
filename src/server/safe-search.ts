import { env } from "./env";

// Automatic moderation with Google Cloud Vision SafeSearch. Runs on Cloud Run with the
// service account's token from the metadata server (no keys). Fails open: if Vision is
// unavailable the photo is published normally and can still be reported.

const FLAG_LEVELS = new Set(["LIKELY", "VERY_LIKELY"]);
const METADATA_TOKEN_URL = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

export interface SafeSearchVerdict {
  flagged: boolean;
  labels: { adult: string; violence: string; racy: string };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.value;
  const res = await fetch(METADATA_TOKEN_URL, { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(2_000) });
  if (!res.ok) throw new Error(`metadata token: HTTP ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

export function autoModerationEnabled(): boolean {
  return env().AUTO_MODERATION === "vision";
}

/** Returns null when moderation is off or the check could not be completed. */
export async function checkImage(imageUrl: string): Promise<SafeSearchVerdict | null> {
  if (!autoModerationEnabled()) return null;
  try {
    const res = await fetch("https://vision.googleapis.com/v1/images:annotate", {
      method: "POST",
      headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ image: { source: { imageUri: imageUrl } }, features: [{ type: "SAFE_SEARCH_DETECTION" }] }],
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`vision: HTTP ${res.status} ${await res.text()}`);
    const body = (await res.json()) as {
      responses: { safeSearchAnnotation?: { adult: string; violence: string; racy: string }; error?: { message: string } }[];
    };
    const annotation = body.responses[0]?.safeSearchAnnotation;
    if (!annotation) throw new Error(`vision: ${body.responses[0]?.error?.message ?? "no annotation"}`);
    const labels = { adult: annotation.adult, violence: annotation.violence, racy: annotation.racy };
    // Racy content is common at parties (swimwear etc.), so only the strongest signal counts.
    const flagged = FLAG_LEVELS.has(labels.adult) || FLAG_LEVELS.has(labels.violence) || labels.racy === "VERY_LIKELY";
    return { flagged, labels };
  } catch (error) {
    console.error("auto moderation skipped", error);
    return null;
  }
}
