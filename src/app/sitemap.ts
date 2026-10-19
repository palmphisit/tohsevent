import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

const PAGES: { path: string; changeFrequency: "weekly" | "yearly"; priority: number }[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
];

/** Every public page in English ("/…") and Thai ("/th…"), each listing the other as an alternate. */
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap(({ path, changeFrequency, priority }) => {
    const en = `${SITE.url}${path === "/" ? "" : path}`;
    const th = `${SITE.url}/th${path === "/" ? "" : path}`;
    const alternates = { languages: { en, th } };
    return [
      { url: en, changeFrequency, priority, alternates },
      { url: th, changeFrequency, priority, alternates },
    ];
  });
}
