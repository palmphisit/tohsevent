import QRCode from "qrcode";

// Medium error correction keeps the code scannable when printed small or slightly damaged.
const OPTIONS = { errorCorrectionLevel: "M", margin: 2 } as const;

/** `margin` is the quiet zone in modules: 2 for print, 1 is enough on a screen inside a white card. */
export function qrSvg(url: string, margin: number = OPTIONS.margin): Promise<string> {
  return QRCode.toString(url, { ...OPTIONS, margin, type: "svg" });
}

export function qrPng(url: string, size: number): Promise<Buffer> {
  return QRCode.toBuffer(url, { ...OPTIONS, type: "png", width: size });
}
