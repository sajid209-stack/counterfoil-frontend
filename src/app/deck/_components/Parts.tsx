import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/cn";
import s from "../deck.module.css";
import markBlack from "../_media/mark-plain.png";

export const TOTAL = 25;

export type Tone = "ink" | "paper";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * One slide: a 16:9 stage from a laptop up, its own height on a phone.
 * `half` is a 32:11 band — for a section that needs a glance, not a page.
 */
export function Slide({
  tone,
  n,
  section,
  label,
  size = "full",
  className,
  children,
}: {
  tone: Tone;
  n: number;
  section: string;
  label: string;
  size?: "full" | "half";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={label} className={cn(s.slide, size === "half" && s.half, tone === "ink" ? s.ink : s.paper, className)}>
      <div className={s.inner}>{children}</div>
      <div aria-hidden className={s.footer}>
        <span>{section}</span>
        <span>
          {pad(n)} / {TOTAL}
        </span>
      </div>
    </section>
  );
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn(s.pill, className)}>{children}</span>;
}

export function Glow({ className }: { className?: string }) {
  return <div aria-hidden className={cn(s.glow, className)} />;
}

export function Floor({ className }: { className?: string }) {
  return <div aria-hidden className={cn(s.floor, className)} />;
}

type Tilt = "left" | "right" | "up" | "none";
const tiltClass = (t: Tilt) => (t === "left" ? s.tiltLeft : t === "right" ? s.tiltRight : t === "up" ? s.tiltUp : undefined);

export function Laptop({
  src,
  alt,
  tilt = "left",
  sizes = "(min-width: 1280px) 760px, 92vw",
  priority,
  className,
}: {
  src: StaticImageData;
  alt: string;
  tilt?: Tilt;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(s.device, tiltClass(tilt), className)}>
      <div className={s.lid}>
        <div className={s.screen}>
          <Image src={src} alt={alt} sizes={sizes} priority={priority} placeholder="blur" />
        </div>
      </div>
      <div aria-hidden className={s.base} />
    </div>
  );
}

export function Tablet({
  src,
  alt,
  tilt = "left",
  sizes = "(min-width: 1280px) 600px, 92vw",
  priority,
  className,
}: {
  src: StaticImageData;
  alt: string;
  tilt?: Tilt;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(s.device, tiltClass(tilt), className)}>
      <div className={s.tablet}>
        <div className={s.screen}>
          <Image src={src} alt={alt} sizes={sizes} priority={priority} placeholder="blur" />
        </div>
      </div>
    </div>
  );
}

export function Phone({
  src,
  alt,
  tilt = "right",
  sizes = "(min-width: 1280px) 260px, 60vw",
  className,
}: {
  src: StaticImageData;
  alt: string;
  tilt?: Tilt;
  sizes?: string;
  className?: string;
}) {
  return (
    <div className={cn(s.device, tiltClass(tilt), className)}>
      <div className={s.phone}>
        <span aria-hidden className={s.island} />
        <div className={s.screen}>
          <Image src={src} alt={alt} sizes={sizes} placeholder="blur" />
        </div>
      </div>
    </div>
  );
}

export function Callout({
  tone,
  label,
  value,
  dot,
  n,
  className,
}: {
  tone: Tone;
  label: string;
  value: React.ReactNode;
  dot?: boolean;
  /** Matches a numbered hotspot on the screen beside it. */
  n?: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn(s.callout, tone === "ink" ? s.calloutInk : s.calloutPaper, className)}>
      <span className={cn(s.calloutLabel, "flex items-center gap-[0.6em]")}>
        {n !== undefined && (
          <span className="grid h-[1.9em] w-[1.9em] place-items-center rounded-full bg-[#f94a00] font-sans text-[1em] font-semibold tracking-normal text-white">
            {n}
          </span>
        )}
        {label}
      </span>
      <span className={cn(s.calloutValue, "flex items-center gap-[0.45em]")}>
        {dot && <span className="inline-block h-[0.5em] w-[0.5em] shrink-0 rounded-full bg-[#1f9d55]" />}
        {value}
      </span>
    </div>
  );
}

/**
 * The counterfoil itself — the one object this company is named after.
 *
 * Printed on paper: white stock, black type, the black mark on the stub. The
 * frosted variant is the ticket behind it on dark slides, so a pair still
 * reads as two objects.
 */
export function Ticket({
  word = "ADMIT 2",
  kicker = "Counterfoil",
  code,
  variant = "paper",
  className,
}: {
  word?: string;
  kicker?: string;
  code?: string;
  variant?: "paper" | "glass";
  className?: string;
}) {
  return (
    <div aria-hidden className={cn(s.ticket, variant === "glass" && s.ticketGlass, className)}>
      <div className={s.ticketDepth} />
      <div className={s.ticketFace} />
      {variant === "paper" && (
        <>
          <span className={s.ticketWord}>
            <small>{kicker}</small>
            {word}
          </span>
          {code && <span className={s.ticketCode}>{code}</span>}
          <Image src={markBlack} alt="" className={s.ticketMark} sizes="80px" />
        </>
      )}
    </div>
  );
}

/** A browser window with no address in it — the page is the point, not a URL. */
export function BrowserCard({
  src,
  alt,
  sizes = "(min-width: 1280px) 420px, 70vw",
  className,
}: {
  src: StaticImageData;
  alt: string;
  sizes?: string;
  className?: string;
}) {
  return (
    <div className={cn(s.browser, className)}>
      <div aria-hidden className={s.browserBar}>
        <span />
        <span />
        <span />
      </div>
      <div className={s.screen}>
        <Image src={src} alt={alt} sizes={sizes} placeholder="blur" />
      </div>
    </div>
  );
}

/** A piece of the till lifted out of the phone — the part a cashier reads. */
export function SheetCard({
  src,
  alt,
  sizes = "(min-width: 1280px) 280px, 60vw",
  className,
}: {
  src: StaticImageData;
  alt: string;
  sizes?: string;
  className?: string;
}) {
  return (
    <div className={cn(s.sheetCard, className)}>
      <div className={s.screen}>
        <Image src={src} alt={alt} sizes={sizes} placeholder="blur" />
      </div>
    </div>
  );
}

/**
 * A close-up of one region of a screenshot, given as fractions of the image:
 * `x`, `y` for the top-left corner and `w`, `h` for the size. The box takes the
 * region's own aspect ratio, so the crop is never stretched.
 */
export function Crop({
  src,
  alt,
  x,
  y,
  w,
  h,
  tone = "paper",
  sizes,
  className,
}: {
  src: StaticImageData;
  alt: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tone?: Tone;
  sizes?: string;
  className?: string;
}) {
  const ratio = (w * src.width) / (h * src.height);
  // The image is drawn 1/w times wider than its box, so it has to be fetched
  // that much larger or a close-up is an upscaled blur.
  const fetch = sizes ?? `${Math.min(3840, Math.round(900 / w))}px`;
  return (
    <div className={className} style={{ aspectRatio: String(ratio) }}>
      <div className={cn(s.cropFrame, tone === "ink" && s.cropFrameInk)}>
        <Image
          src={src}
          alt={alt}
          sizes={fetch}
          placeholder="blur"
          className={s.cropImg}
          style={{ width: `${100 / w}%`, left: `${(-x / w) * 100}%`, top: `${(-y / h) * 100}%` }}
        />
      </div>
    </div>
  );
}

/** A numbered point on a screen; the caller places it with `left`/`top`. */
export function Hotspot({ n, className }: { n: number; className?: string }) {
  return (
    <span aria-hidden className={cn(s.hotspot, className)}>
      {n}
    </span>
  );
}

/** One step of a walkthrough, numbered to match its hotspot. */
export function Step({ n, title, body, className }: { n: number; title: string; body: string; className?: string }) {
  return (
    <li className={cn("flex gap-[max(12px,1cqw)]", className)}>
      <span aria-hidden className={s.stepNum}>
        {n}
      </span>
      <span className="min-w-0">
        <span className={cn(s.heading, "block")}>{title}</span>
        <span className={cn(s.body, "mt-[max(4px,0.3cqw)] block")}>{body}</span>
      </span>
    </li>
  );
}

export { s as deckStyles };
