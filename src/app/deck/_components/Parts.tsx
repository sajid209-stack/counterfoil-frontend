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
  /** Hotspots, placed as a share of the device. */
  children?: ReactNode;
}

export function Laptop({ src, alt, width, tilt = "none", priority, className, children }: DeviceProps) {
  return (
    <div className={cn(s.device, tiltClass(tilt), className)} style={{ width, "--device-w": `${width}px` } as CSSProperties}>
      <div className={s.lid}>
        <div className={s.screen}>
          <Image src={src} alt={alt} sizes={`${width}px`} priority={priority} placeholder="blur" />
        </div>
      </div>
      <div aria-hidden className={s.base} />
      {children}
    </div>
  );
}

export function Tablet({ src, alt, width, tilt = "none", priority, className, children }: DeviceProps) {
  return (
    <div className={cn(s.device, tiltClass(tilt), className)} style={{ width }}>
      <div className={s.tablet}>
        <div className={s.screen}>
          <Image src={src} alt={alt} sizes={`${width}px`} priority={priority} placeholder="blur" />
        </div>
      </div>
      {children}
    </div>
  );
}

export function Phone({ src, alt, width, tilt = "none", className, children }: DeviceProps) {
  return (
    <div className={cn(s.device, tiltClass(tilt), className)} style={{ width }}>
      <div className={s.phone}>
        <span aria-hidden className={s.island} />
        <div className={s.screen}>
          <Image src={src} alt={alt} sizes={`${width}px`} placeholder="blur" />
        </div>
      </div>
      {children}
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
 * Printed on paper: white stock, black type, the black mark on the stub. The
 * frosted variant is the ticket behind it on dark slides, so a pair still
 * reads as two objects. Nothing moves: the website and the PDF are one picture.
 */
export function Ticket({
  word = "ADMIT 2",
  kicker = "Counterfoil",
  code,
  variant = "paper",
  width,
  tilt,
  className,
}: {
  word?: string;
  kicker?: string;
  code?: string;
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
          <span className={s.ticketWord}>
            <small>{kicker}</small>
            {word}
          </span>
          {code && <span className={s.ticketCode}>{code}</span>}
          <Image src={markBlack} alt="" className={s.ticketMark} sizes="96px" />
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
 * A numbered point on a screen. `x`% and `y`% of the device it sits on place
 * the mark's top-left corner, so a point centred on a control sits 18px up and
 * to the left of it.
 */
export function Hotspot({ n, x, y }: { n: number; x: number; y: number }) {
  return (
    <span aria-hidden className={s.hotspot} style={{ left: `${x}%`, top: `${y}%` }}>
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
