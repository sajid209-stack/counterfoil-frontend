import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/cn";
import s from "../deck.module.css";
import markWhite from "../_media/mark-plain-dark.png";

export const TOTAL = 12;

export type Tone = "ink" | "paper";

/** One slide: a 16:9 stage from a laptop up, its own height on a phone. */
export function Slide({
  tone,
  n,
  section,
  label,
  className,
  children,
}: {
  tone: Tone;
  n: number;
  section: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={label} className={cn(s.slide, tone === "ink" ? s.ink : s.paper, className)}>
      <div className={s.inner}>{children}</div>
      <div aria-hidden className={s.footer}>
        <span>{section}</span>
        <span>
          {String(n).padStart(2, "0")} / {TOTAL}
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
  className,
}: {
  tone: Tone;
  label: string;
  value: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn(s.callout, tone === "ink" ? s.calloutInk : s.calloutPaper, className)}>
      <span className={s.calloutLabel}>{label}</span>
      <span className={cn(s.calloutValue, "flex items-center gap-[0.45em]")}>
        {dot && <span className="inline-block h-[0.5em] w-[0.5em] shrink-0 rounded-full bg-[#1f9d55]" />}
        {value}
      </span>
    </div>
  );
}

/** The counterfoil itself — the one object this company is named after. */
export function Ticket({
  word = "ADMIT 2",
  kicker = "Counterfoil",
  variant = "ember",
  className,
}: {
  word?: string;
  kicker?: string;
  variant?: "ember" | "glass";
  className?: string;
}) {
  return (
    <div aria-hidden className={cn(s.ticket, variant === "glass" && s.ticketGlass, className)}>
      <div className={s.ticketDepth} />
      <div className={s.ticketFace} />
      {variant === "ember" && (
        <>
          <span className={s.ticketWord}>
            <small>{kicker}</small>
            {word}
          </span>
          <Image src={markWhite} alt="" className={s.ticketMark} sizes="80px" />
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

export { s as deckStyles };
