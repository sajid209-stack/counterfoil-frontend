"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Camera, Flashlight, RefreshCw, VideoOff } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * The gate's camera view: a viewport that is ALWAYS on the screen.
 *
 * Where the device has a camera and `BarcodeDetector` (Chrome on Android — a
 * gate tablet) it starts when the person taps Start camera (browsers need a
 * gesture) and decodes QR codes into the same scan path as the code field.
 * Everywhere else (desktop, Safari, test browsers) the SAME frame and reticle
 * are drawn over a calm placeholder with a plain message, so the scanning area
 * is always visible and the layout never jumps. Everything is feature-detected.
 */

type DetectedBarcode = { rawValue: string };
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
/* `torch` is real on Android and absent from the DOM types. */
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

const readSupport = () =>
  typeof window !== "undefined" &&
  typeof (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector === "function" &&
  !!navigator.mediaDevices?.getUserMedia;

/** Whether this device can scan with its camera at all. A fact about the
 *  browser, so it is read as an external store: the server and the first client
 *  render agree on "no camera yet". */
export function useCameraSupport(): boolean {
  return useSyncExternalStore(
    () => () => {},
    readSupport,
    () => false,
  );
}

export interface CameraLabels {
  viewfinder: string;
  aim: string;
  start: string;
  stop: string;
  starting: string;
  none: string;
  torch: string;
  switchCamera: string;
  denied: string;
  deniedHint: string;
  retry: string;
}

/* The scan line moves only for people who have not asked for less motion. */
const SCAN_CSS = `
@keyframes cf-scan { 0% { top: 6%; } 50% { top: 92%; } 100% { top: 6%; } }
@media (prefers-reduced-motion: no-preference) { .cf-scanline { animation: cf-scan 2.6s ease-in-out infinite; } }
`;

export function CameraView({ onCode, labels }: { onCode: (code: string) => void; labels: CameraLabels }) {
  const supported = useCameraSupport();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef<number>(0);
  const onCodeRef = useRef(onCode);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [canTorch, setCanTorch] = useState(false);
  const [devices, setDevices] = useState<string[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    if (!active) return;
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) return;
    let live = true;
    const detector = new Detector({ formats: ["qr_code"] });
    let lastCode = "";
    let lastAt = 0;
    let lastTick = 0;

    const run = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } },
        });
        if (!live) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        const track = s.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as TorchCapabilities | undefined;
        setCanTorch(!!caps?.torch);
        navigator.mediaDevices
          .enumerateDevices()
          .then((all) => live && setDevices(all.filter((d) => d.kind === "videoinput").map((d) => d.deviceId)))
          .catch(() => {});
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        setReady(true);
        const tick = async (now: number) => {
          if (!live) return;
          if (now - lastTick > 150 && video.current && video.current.readyState >= 2) {
            lastTick = now;
            try {
              const hits = await detector.detect(video.current);
              const value = hits[0]?.rawValue?.trim();
              /* The camera stays on for the next guest, so the same code is not
                 handed over again while it is still in front of the lens. */
              if (value && (value !== lastCode || Date.now() - lastAt > 3000)) {
                lastCode = value;
                lastAt = Date.now();
                onCodeRef.current(value);
              }
            } catch {
              /* A frame that cannot be decoded is the normal case, not a fault. */
            }
          }
          frame.current = requestAnimationFrame((t) => void tick(t));
        };
        frame.current = requestAnimationFrame((t) => void tick(t));
      } catch {
        if (live) {
          setDenied(true);
          setActive(false);
        }
      }
    };
    void run();
    return () => {
      live = false;
      stop();
    };
  }, [active, deviceId, stop]);

  const begin = () => {
    setDenied(false);
    setReady(false);
    setActive(true);
  };
  const end = () => {
    setActive(false);
    setReady(false);
    setTorchOn(false);
  };

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

  const switchCamera = () => {
    if (devices.length < 2) return;
    const i = devices.indexOf(deviceId ?? "");
    setReady(false);
    setDeviceId(devices[(i + 1) % devices.length]);
  };

  const running = active && ready;

  return (
    <section aria-label={labels.viewfinder} className="flex flex-col gap-tight">
      <style>{SCAN_CSS}</style>
      <div className="relative mx-auto aspect-square w-full max-w-xl overflow-hidden rounded-card bg-inverse sm:aspect-[4/3]">
        <video ref={video} playsInline muted className={cn("absolute inset-0 h-full w-full object-cover", !running && "invisible")} />

        {/* The calm placeholder, where there is no picture. */}
        {!running && (
          <div aria-hidden className="absolute inset-0 flex items-center justify-center bg-neutral-800">
            {supported ? (
              <Camera size={40} strokeWidth={1.5} className="text-neutral-500" />
            ) : (
              <VideoOff size={40} strokeWidth={1.5} className="text-neutral-500" />
            )}
          </div>
        )}

        {/* The scanning area: a window cut in a dimmed surround, brand corners,
            and a line that sweeps it. */}
        <div aria-hidden className="absolute inset-0 flex items-center justify-center">
          {/* ds-exception: viewfinder cut-out needs a spread shadow */}
          <div className="relative aspect-square h-[62%] shadow-[0_0_0_9999px_rgba(20,20,19,0.55)]">
            <span className="absolute left-0 top-0 h-9 w-9 rounded-tl-inner border-l-4 border-t-4 border-ember" />
            <span className="absolute right-0 top-0 h-9 w-9 rounded-tr-inner border-r-4 border-t-4 border-ember" />
            <span className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-inner border-b-4 border-l-4 border-ember" />
            <span className="absolute bottom-0 right-0 h-9 w-9 rounded-br-inner border-b-4 border-r-4 border-ember" />
            {running && <span className="cf-scanline absolute left-2 right-2 top-1/2 h-0.5 rounded-full bg-ember" />}
          </div>
        </div>

        {/* Controls (or the reason there are none), inside the frame so the
            layout never moves. */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-tight p-comfortable">
          {supported ? (
            <>
              <Button
                variant={active ? "secondary" : "primary"}
                size="lg"
                onClick={active ? end : begin}
                className="min-w-0"
              >
                <Camera size={18} strokeWidth={1.5} aria-hidden />
                {active ? (ready ? labels.stop : labels.starting) : labels.start}
              </Button>
              <span className="flex shrink-0 gap-tight">
                {running && canTorch && (
                  <Button size="icon" variant="secondary" aria-pressed={torchOn} aria-label={labels.torch} onClick={toggleTorch}>
                    <Flashlight size={20} strokeWidth={1.5} aria-hidden />
                  </Button>
                )}
                {running && devices.length > 1 && (
                  <Button size="icon" variant="secondary" aria-label={labels.switchCamera} onClick={switchCamera}>
                    <RefreshCw size={20} strokeWidth={1.5} aria-hidden />
                  </Button>
                )}
              </span>
            </>
          ) : (
            <p className="w-full text-center text-sm text-neutral-200">{labels.none}</p>
          )}
        </div>

        {denied && (
          <div role="alert" className="absolute inset-x-comfortable top-comfortable flex flex-col gap-inline rounded-inner bg-card p-comfortable text-fg">
            <p className="text-sm font-semibold">{labels.denied}</p>
            <p className="text-sm text-muted">{labels.deniedHint}</p>
            <Button size="lg" variant="secondary" onClick={begin}>
              {labels.retry}
            </Button>
          </div>
        )}
      </div>
      <p className="text-center text-md font-semibold">{labels.aim}</p>
    </section>
  );
}
