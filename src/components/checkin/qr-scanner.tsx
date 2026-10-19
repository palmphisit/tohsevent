"use client";

import { Camera, CameraOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

/**
 * Camera QR scanner. Uses the browser's BarcodeDetector where it exists (Chrome/Android),
 * otherwise decodes frames with jsQR (iPhone Safari). Calls `onScan` with the QR text.
 */
export function QrScanner({ onScan, paused }: { onScan: (text: string) => void; paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"idle" | "starting" | "on" | "denied" | "unsupported">("idle");
  const scanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  useEffect(() => {
    scanRef.current = onScan;
    pausedRef.current = paused;
  });

  useEffect(() => {
    if (state !== "starting") return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setState("unsupported");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false,
        });
      } catch {
        return setState("denied");
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => {});
      setState("on");

      const Native = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      const native = Native ? new Native({ formats: ["qr_code"] }) : null;
      const jsQR = native ? null : (await import("jsqr")).default;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

      const tick = async () => {
        if (stopped) return;
        if (!pausedRef.current && video.readyState >= 2) {
          try {
            let text: string | null = null;
            if (native) {
              text = (await native.detect(video))[0]?.rawValue ?? null;
            } else if (jsQR) {
              const w = 480;
              const h = Math.round((video.videoHeight / video.videoWidth) * w) || 360;
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              text = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
            }
            if (text) scanRef.current(text);
          } catch {
            // a bad frame: try the next one
          }
        }
        timer = setTimeout(tick, 200);
      };
      void tick();
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [state]);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-slate-900 sm:aspect-video">
      <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${state === "on" ? "" : "hidden"}`} />
      {state === "on" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative h-56 w-56 max-w-[70%] max-h-[70%]">
            {["top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl"].map((c) => (
              <span key={c} className={`absolute h-10 w-10 border-white ${c}`} />
            ))}
            <span className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-sky-400 shadow-[0_0_12px_#38bdf8]" />
          </div>
        </div>
      )}
      {state !== "on" && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
          {state === "denied" || state === "unsupported" ? (
            <div>
              <CameraOff className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-2 text-sm text-slate-300">
                {state === "denied" ? "ไม่ได้รับอนุญาตให้ใช้กล้อง เปิดสิทธิ์กล้องในการตั้งค่าเบราว์เซอร์" : "เบราว์เซอร์นี้ใช้กล้องไม่ได้"} · ใช้การค้นหารายชื่อด้านล่างแทนได้
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setState("starting")}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-4 font-semibold text-slate-900 shadow-lg"
            >
              <Camera className="h-5 w-5" /> {state === "starting" ? "กำลังเปิดกล้อง…" : "เปิดกล้องสแกน QR"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
