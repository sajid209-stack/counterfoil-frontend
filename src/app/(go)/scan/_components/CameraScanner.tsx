"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Flashlight, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The camera, where the device actually has one.
 *
 * What was here before was a dashed rectangle reading "Camera scan (mock)" in
 * the hero position of the gate screen — an announcement, at the door, that
 * the product is unfinished. This is the real thing: `getUserMedia` for the
 * picture and `BarcodeDetector` for the decode, both feature-detected.
 *
 * `BarcodeDetector` ships in Chrome on Android — which is what a gate tablet
 * runs — and is absent in Safari and in desktop Chrome on Windows. So the
 * camera is an ENHANCEMENT and never the backbone: where it is missing the
 * affordance is not offered at all, and the code field, which every device
 * has and which every hardware scanner types into, carries the gate.
 */

type DetectedBarcode = { rawValue: string };
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
/* `torch` is real on Android and absent from the DOM types, so it is read
   through a narrow cast rather than by widening the whole track. */
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

const readSupport = () =>
  typeof window !== "undefined" &&
  typeof (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector === "function" &&
  !!navigator.mediaDevices?.getUserMedia;

/** Whether this device can scan with its camera at all.
 *
 *  Read through `useSyncExternalStore` rather than an effect, because that is
 *  what it is — a fact about the browser, not React state — and it keeps the
 *  server and the first client render agreeing on "no camera yet". */
export function useCameraSupport(): boolean {
  return useSyncExternalStore(
    () => () => {},
    readSupport,
    () => false,
  );
}

export interface CameraLabels {
  title: string;
  aim: string;
  close: string;
  torch: string;
  denied: string;
  deniedHint: string;
  retry: string;
}

export function CameraScanner({ onCode, onClose, labels }: { onCode: (code: string) => void; onClose: () => void; labels: CameraLabels }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef<number>(0);
  const [denied, setDenied] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [canTorch, setCanTorch] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    let live = true;
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector) return;
    const detector = new Detector({ formats: ["qr_code", "code_128", "ean_13"] });

    const run = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
        if (!live) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        const track = s.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as TorchCapabilities | undefined;
        if (caps?.torch) setCanTorch(true);
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        const tick = async () => {
          if (!live || !video.current || video.current.readyState < 2) {
            frame.current = requestAnimationFrame(() => void tick());
            return;
          }
          try {
            const hits = await detector.detect(video.current);
            const value = hits[0]?.rawValue?.trim();
            if (value) {
              live = false;
              stop();
              onCode(value);
              return;
            }
          } catch {
            /* A frame that cannot be decoded is the normal case, not a fault. */
          }
          frame.current = requestAnimationFrame(() => void tick());
        };
        frame.current = requestAnimationFrame(() => void tick());
      } catch {
        if (live) setDenied(true);
      }
    };
    void run();
    return () => {
      live = false;
      stop();
    };
  }, [onCode, stop, attempt]);

  const toggleTorch = async () => {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as unknown as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setCanTorch(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink text-paper" role="dialog" aria-modal="true" aria-label={labels.title}>
      <video ref={video} playsInline muted className={cn("absolute inset-0 h-full w-full object-cover", denied && "hidden")} />

      {denied ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-comfortable px-section text-center">
          <p className="text-xl font-semibold">{labels.denied}</p>
          <p className="max-w-sm text-sm text-paper/80">{labels.deniedHint}</p>
          <button
            type="button"
            onClick={() => {
              setDenied(false);
              setAttempt((n) => n + 1);
            }}
            className="mt-tight h-12 rounded-full bg-paper px-major text-base font-semibold text-ink"
          >
            {labels.retry}
          </button>
        </div>
      ) : (
        /* A window on the picture rather than a box drawn over it: the ground
           outside the reticle is dimmed, so the aiming area is the one part of
           the frame at full brightness. */
        <div aria-hidden className="relative z-10 flex flex-1 items-center justify-center">
          <div className="h-[min(70vw,300px)] w-[min(70vw,300px)] rounded-go-lg shadow-[0_0_0_9999px_rgba(20,20,19,0.62)]">
            <span className="absolute left-0 top-0 h-10 w-10 rounded-tl-go-lg border-l-4 border-t-4 border-paper" />
            <span className="absolute right-0 top-0 h-10 w-10 rounded-tr-go-lg border-r-4 border-t-4 border-paper" />
            <span className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-go-lg border-b-4 border-l-4 border-paper" />
            <span className="absolute bottom-0 right-0 h-10 w-10 rounded-br-go-lg border-b-4 border-r-4 border-paper" />
          </div>
        </div>
      )}

      <div className="relative z-10 flex items-center justify-between gap-tight px-section pb-[calc(24px+env(safe-area-inset-bottom))] pt-section">
        <button type="button" onClick={onClose} aria-label={labels.close} className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-paper/60">
          <X size={24} strokeWidth={2} />
        </button>
        {!denied && <p className="min-w-0 flex-1 truncate text-center text-sm text-paper/90">{labels.aim}</p>}
        {canTorch ? (
          <button
            type="button"
            onClick={toggleTorch}
            aria-pressed={torchOn}
            aria-label={labels.torch}
            className={cn("flex h-14 w-14 items-center justify-center rounded-full border-2", torchOn ? "border-paper bg-paper text-ink" : "border-paper/60")}
          >
            <Flashlight size={22} strokeWidth={2} />
          </button>
        ) : (
          <span aria-hidden className="h-14 w-14 shrink-0" />
        )}
      </div>
    </div>
  );
}
