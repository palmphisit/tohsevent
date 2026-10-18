import { ImageResponse } from "next/og";
import { IconArt } from "./icon-art";

const SIZES = [32, 192, 512];

export function generateImageMetadata() {
  return SIZES.map((size) => ({ id: String(size), size: { width: size, height: size }, contentType: "image/png" }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id);
  return new ImageResponse(<IconArt size={size} rounded={size <= 32} />, { width: size, height: size });
}
