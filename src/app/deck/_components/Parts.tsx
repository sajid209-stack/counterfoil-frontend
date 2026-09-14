import Image, { type StaticImageData } from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import s from "../deck.module.css";
import markBlack from "../_media/mark-plain.png";

export const TOTAL = 25;

export type Tone = "ink" | "paper";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * One page of the deck: a 1600 × 900 canvas, scaled to fit the page's width.
 *
 * Everything on a slide is placed in canvas pixels. The frame keeps the page
 * 16 : 9 at every width, so every page is the same size as every other.
 */
export function Slide({
  tone,
  n,
  section,
  label,
  children,
}: {
  tone: Tone;
  n: number;
  section: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className={s.frame}>
      <div className={cn(s.canvas, tone === "ink" ? s.ink : s.paper)}>
        {children}
        {/* The footer names the chapter, never the slide — the eyebrow does that. */}
        <div aria-hidden data-deck-footer className={s.footer}>
          <span>{section}</span>
          <span>
            {pad(n)} / {TOTAL}
          </span>
        </div>
      </div>
    </section>
  );
}

/**
 * The slide's words, at the deck's one position: eyebrow at y 92, the title
 * under it, then the lead, then whatever the slide lists — each at the same
 * distance on every slide.
 */
export function TextBlock({
  eyebrow,
  title,
  lead,
  left = 96,
  top = 92,
  width = 520,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  left?: number;
  top?: number;
  width?: number;
  children?: ReactNode;
}) {
  return (
    <div className={s.text} style={{ left, top, width }}>
      <p className={s.eyebrow}>{eyebrow}</p>
      <h2 className={cn(s.title, "mt-[22px]")}>{title}</h2>
      {lead && <p className={cn(s.lead, "mt-6")}>{lead}</p>}
      {children && <div className="mt-11">{children}</div>}
    </div>
  );
}

/** `style` is for size: padding and font size set with utilities lose to the module. */
export function Pill({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span className={cn(s.pill, className)} style={style}>
      {children}
    </span>
  );
}

export function Glow({ className }: { className?: string }) {
  return <div aria-hidden className={cn(s.glow, className)} />;
}

export function Floor() {
  return <div aria-hidden className={s.floor} />;
}

type Tilt = "left" | "right" | "none";
const tiltClass = (t: Tilt) => (t === "left" ? s.tiltLeft : t === "right" ? s.tiltRight : undefined);

interface DeviceProps {
  src: StaticImageData;
  alt: string;
  /** Width on the canvas, in canvas pixels. */
  width: number;
  tilt?: Tilt;
  priority?: boolean;
  /** Placement on the canvas — `absolute left-[…] top-[…]`. */
  className?: string;
  /** Hotspots, placed as a share of the screen. */
  children?: ReactNode;
}

export function Laptop({ src, alt, width, tilt = "none", priority, className, children }: DeviceProps) {
  return (
    <div className={cn(s.device, tiltClass(tilt), className)} style={{ width, "--device-w": `${width}px` } as CSSProperties}>
      <div className={s.lid}>
        <div className={s.screenBox}>
          <div className={s.screen}>
            <Image src={src} alt={alt} sizes={`${width}px`} priority={priority} placeholder="blur" />
          </div>
          {children}
        </div>
      </div>
      <div aria-hidden className={s.base} />
    </div>
  );
}

export function Tablet({ src, alt, width, tilt = "none", priority, className, children }: DeviceProps) {
  return (
    <div className={cn(s.device, tiltClass(tilt), className)} style={{ width }}>
      <div className={s.tablet}>
        <div className={s.screenBox}>
          <div className={s.screen}>
            <Image src={src} alt={alt} sizes={`${width}px`} priority={priority} placeholder="blur" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Counterfoil Go on a countertop stand: the tablet the till runs on, mounted
 * the way a venue mounts it. Landscape at the counter, portrait at the gate.
 */
export function PosStand({
  src,
  alt,
  width,
  tilt = "none",
  priority,
  orientation = "landscape",
  className,
  children,
}: DeviceProps & { orientation?: "landscape" | "portrait" }) {
  return (
    <div className={cn(s.device, tiltClass(tilt), orientation === "portrait" && s.posPortrait, className)} style={{ width }}>
      <div className={s.posHead}>
        <div className={s.screenBox}>
          <div className={s.screen}>
            <Image src={src} alt={alt} sizes={`${width}px`} priority={priority} placeholder="blur" />
          </div>
          {children}
        </div>
      </div>
      <div aria-hidden className={s.posNeck} />
      <div aria-hidden className={s.posBase} />
    </div>
  );
}

/** Signal, Wi-Fi and battery, drawn in the status bar's ink. */
function StatusIcons() {
  return (
    <span aria-hidden className={s.statusIcons}>
      <svg viewBox="0 0 18 12" fill="currentColor">
        <rect x="0" y="8" width="3" height="4" rx="0.8" />
        <rect x="5" y="5.5" width="3" height="6.5" rx="0.8" />
        <rect x="10" y="3" width="3" height="9" rx="0.8" />
        <rect x="15" y="0" width="3" height="12" rx="0.8" />
      </svg>
      <svg viewBox="0 0 16 12" fill="currentColor">
        <path d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.3-1.4A10.6 10.6 0 0 0 8 .3 10.6 10.6 0 0 0 .5 3.3l1.3 1.4A8.7 8.7 0 0 1 8 2.2Z" />
        <path d="M8 5.8c1.4 0 2.7.5 3.7 1.4L13 5.8A7.1 7.1 0 0 0 8 3.9a7.1 7.1 0 0 0-5 1.9l1.3 1.4A5.2 5.2 0 0 1 8 5.8Z" />
        <path d="M8 9.3c.6 0 1.1.2 1.5.6L8 11.6 6.5 9.9c.4-.4.9-.6 1.5-.6Z" />
      </svg>
      <svg viewBox="0 0 27 12" fill="none">
        <rect x="0.6" y="0.6" width="22.8" height="10.8" rx="3.2" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.2" />
        <rect x="2.4" y="2.4" width="19.2" height="7.2" rx="1.8" fill="currentColor" />
        <path d="M25 4v4c.8-.3 1.4-1.1 1.4-2S25.8 4.3 25 4Z" fill="currentColor" fillOpacity="0.45" />
      </svg>
    </span>
  );
}

/**
 * A phone. Its status bar — the time, the island, signal, Wi-Fi and battery —
 * is drawn here rather than captured, so every phone in the deck shows the
 * same one and the island never sits on the app's own header.
 *
 * `bar` is the colour behind the status bar: the app's own top edge, so the
 * bar reads as part of the screen. `screen` replaces the screenshot with
 * content drawn on the slide, such as a guest's messages.
 */
export function Phone({
  src,
  alt,
  width,
  tilt = "none",
  priority,
  bar = "#f5f2eb",
  ink = "dark",
  screen,
  className,
  children,
}: Omit<DeviceProps, "src" | "alt"> & {
  src?: StaticImageData;
  alt?: string;
  bar?: string;
  ink?: "dark" | "light";
  screen?: ReactNode;
}) {
  return (
    <div className={cn(s.device, tiltClass(tilt), className)} style={{ width }}>
      <div className={s.phone}>
        <div className={s.screenBox} style={{ "--bar-bg": bar, "--bar-ink": ink === "dark" ? "#141413" : "#ffffff" } as CSSProperties}>
          <div className={s.screen}>
            <div aria-hidden className={s.statusBar}>
              <span className={s.statusTime}>9:41</span>
              <StatusIcons />
            </div>
            <div className={s.shot}>{src ? <Image src={src} alt={alt ?? ""} sizes={`${width}px`} priority={priority} placeholder="blur" /> : screen}</div>
          </div>
          <span aria-hidden className={s.island} />
          {children && <div className={s.shotLayer}>{children}</div>}
        </div>
      </div>
    </div>
  );
}

export function Callout({
  tone,
  label,
  value,
  className,
}: {
  tone: Tone;
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn(s.callout, tone === "ink" ? s.calloutInk : s.calloutPaper, className)}>
      <span className={s.calloutLabel}>{label}</span>
      <span className={s.calloutValue}>{value}</span>
    </div>
  );
}

/**
 * The counterfoil itself — the one object this company is named after.
 *
 * Printed on paper: white stock, black type, the black mark on the stub. A
 * ticket can carry a word (ADMIT 1) or a product's own logo, and its stub can
 * carry the mark or a number. The frosted variant is the ticket behind it on
 * dark slides, so a pair still reads as two objects.
 */
export function Ticket({
  word = "ADMIT 2",
  kicker = "Counterfoil",
  code,
  logo,
  stub,
  variant = "paper",
  width,
  tilt,
  className,
}: {
  word?: string;
  kicker?: string;
  code?: string;
  /** A logo printed on the face in place of the word. */
  logo?: ReactNode;
  /** What the stub carries in place of the mark. */
  stub?: ReactNode;
  variant?: "paper" | "glass";
  width: number;
  /** A CSS transform, to set this ticket's own angle. */
  tilt?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(s.ticket, variant === "glass" && s.ticketGlass, className)}
      style={{ width, ...(tilt ? { "--tilt": tilt } : {}) } as CSSProperties}
    >
      <div className={s.ticketDepth} />
      <div className={s.ticketFace} />
      {variant === "paper" && (
        <>
          {logo ? (
            <span className={s.ticketLogo}>
              <small>{kicker}</small>
              {logo}
            </span>
          ) : (
            <span className={s.ticketWord}>
              <small>{kicker}</small>
              {word}
            </span>
          )}
          {code && <span className={s.ticketCode}>{code}</span>}
          {stub ? <span className={s.ticketStub}>{stub}</span> : <Image src={markBlack} alt="" className={s.ticketMark} sizes="96px" />}
        </>
      )}
    </div>
  );
}

/** A piece of the till lifted out of the phone — the part a cashier reads. */
export function SheetCard({
  src,
  alt,
  width,
  className,
  style,
}: {
  src: StaticImageData;
  alt: string;
  width: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn(s.sheetCard, className)} style={{ width, ...style }}>
      <div className={s.screen}>
        <Image src={src} alt={alt} sizes={`${width}px`} placeholder="blur" />
      </div>
    </div>
  );
}

/**
 * A close-up of one region of a screenshot, given as fractions of the image:
 * `x`, `y` for the top-left corner and `w`, `h` for the size. The box takes the
 * region's own aspect ratio, so the crop is never stretched, and the image is
 * fetched as large as the zoom needs.
 */
export function Crop({
  src,
  alt,
  x,
  y,
  w,
  h,
  width,
  tone = "paper",
  className,
  children,
}: {
  src: StaticImageData;
  alt: string;
  x: number;
  y: number;
  w: number;
  h: number;
  width: number;
  tone?: Tone;
  className?: string;
  children?: ReactNode;
}) {
  const height = width / ((w * src.width) / (h * src.height));
  return (
    <div className={className} style={{ width, height }}>
      <div className={cn(s.cropFrame, tone === "ink" && s.cropFrameInk)}>
        <Image
          src={src}
          alt={alt}
          sizes={`${Math.min(3840, Math.round(width / w))}px`}
          placeholder="blur"
          className={s.cropImg}
          style={{ width: `${100 / w}%`, left: `${(-x / w) * 100}%`, top: `${(-y / h) * 100}%` }}
        />
      </div>
      {children}
    </div>
  );
}

/**
 * A numbered point on a screen. `x`% and `y`% are the point it marks, as a
 * share of the screen it sits on — the mark is centred there.
 */
export function Hotspot({ n, x, y, small }: { n: number; x: number; y: number; small?: boolean }) {
  return (
    <span aria-hidden className={cn(s.hotspot, small && s.hotspotSm)} style={{ left: `${x}%`, top: `${y}%` }}>
      {n}
    </span>
  );
}

/** One step of a walkthrough, numbered to match its hotspot. */
export function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <span aria-hidden className={s.stepNum}>
        {n}
      </span>
      <span className="min-w-0 pt-[3px]">
        <span className={cn(s.heading, "block")}>{title}</span>
        <span className={cn(s.body, "mt-1.5 block")}>{body}</span>
      </span>
    </li>
  );
}

export function Ticks({ items, tone }: { items: string[]; tone: Tone }) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((line) => (
        <li key={line} className={cn(s.body, "flex items-start gap-3.5")}>
          <span
            aria-hidden
            className={cn(
              "mt-[3px] grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full",
              tone === "paper" ? "bg-[#141413] text-[#f5f2eb]" : "bg-white/10 text-[#ffa572]",
            )}
          >
            <Check size={15} strokeWidth={2.6} />
          </span>
          {line}
        </li>
      ))}
    </ul>
  );
}

export { s as deckStyles };
