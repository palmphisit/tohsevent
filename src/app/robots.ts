import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Event pages are private to their guests and must never be indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/e/", "/th/e/", "/dashboard", "/api/", "/invite/", "/login", "/th/login"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
