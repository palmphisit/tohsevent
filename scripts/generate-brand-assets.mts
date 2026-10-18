// Regenerates the app icons and the social share image from the brand mark.
//   pnpm tsx scripts/generate-brand-assets.mts
import { writeFileSync } from "node:fs";
import { createElement as h } from "react";
import { ImageResponse } from "next/og";

const BLUE_TOP = "#3b82f6";
const BLUE_BOTTOM = "#1d4ed8";

function mark(size: number, rounded: boolean) {
  const r = rounded ? size * 0.25 : 0;
  return h(
    "div",
    {
      style: {
        width: size,
        height: size,
        display: "flex",
        background: `linear-gradient(135deg, ${BLUE_TOP}, ${BLUE_BOTTOM})`,
        borderRadius: r,
        position: "relative",
      },
    },
    h(
      "svg",
      { width: size, height: size, viewBox: "0 0 32 32", style: { position: "absolute", top: 0, left: 0 } },
      h("path", { d: "M9 10.5h14v3.2h-5.4V23h-3.2v-9.3H9z", fill: "#fff" }),
      h("circle", { cx: 23.5, cy: 21.5, r: 2.2, fill: "#7dd3fc" }),
    ),
  );
}

async function png(element: ReturnType<typeof h>, width: number, height: number, path: string) {
  const res = new ImageResponse(element, { width, height });
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  console.log("wrote", path);
}

await png(mark(32, true), 32, 32, "src/app/icon.png");
await png(mark(180, false), 180, 180, "src/app/apple-icon.png"); // iOS rounds it itself
await png(mark(192, true), 192, 192, "public/icons/icon-192.png");
await png(mark(512, false), 512, 512, "public/icons/icon-512.png"); // full bleed: also used as maskable

const og = h(
  "div",
  {
    style: {
      width: 1200,
      height: 630,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      padding: 80,
      background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 55%, #bae6fd 100%)",
      fontFamily: "sans-serif",
    },
  },
  h("div", { style: { display: "flex", alignItems: "center", gap: 24 } }, mark(96, true), h("div", { style: { fontSize: 56, fontWeight: 700, color: "#1e3a8a" } }, "Tohs Event")),
  h("div", { style: { marginTop: 48, fontSize: 64, fontWeight: 700, color: "#0f172a", lineHeight: 1.15 } }, "Every guest's photos, in one album."),
  h("div", { style: { marginTop: 24, fontSize: 32, color: "#334155" } }, "Scan a QR code, share instantly. No app, no sign-up."),
);
await png(og, 1200, 630, "public/og.png");
