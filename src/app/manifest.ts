import type { MetadataRoute } from "next";

// No start_url: it then defaults to the page that was installed, so a guest who adds an
// event page to the home screen reopens that event rather than the landing page.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tohs Event",
    short_name: "Tohs Event",
    description: "แชร์รูปในงานอีเวนต์ด้วย QR Code",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#18181b",
    lang: "th",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
