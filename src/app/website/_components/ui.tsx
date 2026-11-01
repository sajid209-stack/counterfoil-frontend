import Image, { type StaticImageData } from "next/image";
import { ArrowRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/Button";

/* The website's shared primitives, in attio.com's manner: a white page inside
   hairline rails, sections divided by hairlines with a + at each rail, two-tone
   headings, small black buttons, and white product windows on a dotted ground.
   Sections compose these and the cf-* classes in website.css. */

/** Stagger helper for `data-reveal`: `style={delay(120)}`. */
export const delay = (ms: number) => ({ "--cf-delay": `${ms}ms` }) as CSSProperties;

/** One section of the page: a hairline on top with a + at each rail. */
export function Section({
  id,
  children,
  className,
  label,
  flush,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  /** Accessible name when the section has no visible heading. */
  label?: string;
  /** No padding — the section draws its own (e.g. a full-bleed cell grid). */
  flush?: boolean;
}) {
  return (
    <section id={id} aria-label={label} className={cn("cf-sec scroll-mt-16", !flush && "px-5 py-20 md:px-12 md:py-28", className)}>
      {children}
    </section>
  );
}

/** A small mono label with an ember dot — the only place the accent leads. */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("cf-label inline-flex items-center gap-2", className)}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--cf-accent)]" />
      {children}
    </p>
  );
}

/**
 * The heading every section opens with. Two-tone: `title` in ink, `dim` in
 * grey after it — "Never sold twice. A place sold at one counter is gone at
 * every other." — which is how the page stays quiet without being flat.
 */
export function Heading({
  label,
  title,
  dim,
  lead,
  align = "left",
  as: H = "h2",
  className,
  children,
}: {
  label?: ReactNode;
  title: ReactNode;
  dim?: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2";
  className?: string;
  /** Buttons or links under the lead. */
  children?: ReactNode;
}) {
  const center = align === "center";
  return (
    <div className={cn("max-w-[720px]", center && "mx-auto text-center", className)}>
      {label && (
        <div data-reveal className={cn("mb-5", center && "flex justify-center")}>
          <Label>{label}</Label>
        </div>
      )}
      <H data-reveal style={delay(60)} className={H === "h1" ? "cf-display" : "cf-h2"}>
        {title}
        {dim && <span className="cf-dimtext"> {dim}</span>}
      </H>
      {lead && (
        <p data-reveal style={delay(120)} className={cn("cf-lead mt-5", center && "mx-auto max-w-[560px]")}>
          {lead}
        </p>
      )}
      {children && (
        <div data-reveal style={delay(180)} className={cn("mt-8 flex flex-wrap items-center gap-2.5", center && "justify-center")}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * A link that is the app's own Button — `primary` is the solid ember of every
 * OS and Go primary action, `secondary` the neutral one — so the site's calls
 * to action are the product's, not a lookalike. ("dark"/"light" are kept as
 * aliases for primary/secondary.)
 */
export function LinkButton({
  href,
  children,
  variant = "primary",
  arrow,
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "dark" | "light";
  arrow?: boolean;
  className?: string;
}) {
  const v = variant === "dark" ? "primary" : variant === "light" ? "secondary" : variant;
  // ButtonLink is a client component, so a server section can render it; the
  // class helper behind it cannot be called from the server.
  return (
    <ButtonLink href={href} variant={v} size="sm" className={cn("group whitespace-nowrap", v === "secondary" && "!border-transparent", className)}>
      {children}
      {arrow && <ArrowRight aria-hidden size={15} strokeWidth={2} className="transition-transform duration-200 group-hover:translate-x-0.5" />}
    </ButtonLink>
  );
}

/**
 * A white product window — the frame every live mockup sits in. A title bar is
 * optional; with `title` it reads like an app's own window, with `dots` like a
 * browser.
 */
export function Window({
  title,
  dots,
  right,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  dots?: boolean;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("cf-window overflow-hidden", className)}>
      {(title || dots) && (
        <div className="flex h-10 items-center gap-2.5 bg-[var(--cf-bg-2)] px-3.5">
          {dots && (
            <span aria-hidden className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2.5 w-2.5 rounded-full bg-[var(--cf-line-2)]" />
              ))}
            </span>
          )}
          {title && <span className="min-w-0 truncate text-[13px] font-medium text-[var(--cf-fg-2)]">{title}</span>}
          {right && <span className="ml-auto shrink-0">{right}</span>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

/**
 * A mouse pointer that walks around a demo. Position it in px inside a
 * `relative` parent; change `x`/`y` per step and it glides there. `click`
 * set true for a step shows a press ring. Decorative: always aria-hidden.
 */
export function Cursor({ x, y, click, name, className }: { x: number; y: number; click?: boolean; name?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute left-0 top-0 z-20 transition-transform duration-[900ms] ease-[cubic-bezier(0.65,0,0.35,1)]", className)}
      style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}
    >
      <span
        className={cn(
          "absolute -left-2 -top-2 h-6 w-6 rounded-full bg-[var(--cf-fg)]/15 transition-[transform,opacity] duration-300",
          click ? "scale-100 opacity-100" : "scale-50 opacity-0",
        )}
      />
      <svg width="18" height="18" viewBox="0 0 18 18" className={cn("relative drop-shadow-[0_1px_1px_rgb(0_0_0/0.25)] transition-transform duration-150", click && "scale-90")}>
        <path d="M2 1.5 15 8.2 9.2 9.6 6.6 15.4Z" fill="#111110" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
      {name && (
        <span className="absolute left-4 top-4 whitespace-nowrap rounded-md bg-[var(--cf-fg)] px-1.5 py-0.5 text-[12px] font-medium text-white">{name}</span>
      )}
    </span>
  );
}

/** A real screenshot of the product in a light browser frame. */
export function Shot({
  src,
  alt,
  className,
  priority,
  sizes = "(min-width: 1200px) 1000px, 100vw",
}: {
  src: StaticImageData;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <figure className={cn("cf-window overflow-hidden", className)}>
      <div className="flex h-8 items-center gap-1.5 bg-[var(--cf-bg-2)] px-3">
        {[0, 1, 2].map((i) => (
          <span key={i} aria-hidden className="h-2 w-2 rounded-full bg-[var(--cf-line-2)]" />
        ))}
      </div>
      <Image src={src} alt={alt} priority={priority} sizes={sizes} placeholder="blur" className="block h-auto w-full" />
    </figure>
  );
}
