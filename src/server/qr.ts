import QRCode from "qrcode";

// Medium error correction keeps the code scannable when printed small or slightly damaged.
const OPTIONS = { errorCorrectionLevel: "M", margin: 2 } as const;

export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { ...OPTIONS, type: "svg" });
}

export function qrPng(url: string, size: number): Promise<Buffer> {
  return QRCode.toBuffer(url, { ...OPTIONS, type: "png", width: size });
}
