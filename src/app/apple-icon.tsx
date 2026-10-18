import { ImageResponse } from "next/og";
import { IconArt } from "./icon-art";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS applies its own rounded mask, so the artwork stays square.
export default function AppleIcon() {
  return new ImageResponse(<IconArt size={180} rounded={false} />, size);
}
