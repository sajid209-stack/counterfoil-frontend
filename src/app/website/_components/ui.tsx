import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

/* The website's shared primitives. Sections compose these and the classes in
   website.css; they never reach for the app's tokens, because the site is
   mode-locked and carries its own palette (--w-*). */

/** 1200px content column with a 20px gutter on phones and 32px from md. */
export function Container({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-5 md:px-8", wide ? "max-w-[1360px]" : "max-w-[1200px]", className)}>{children}</div>;
}

/**
 * One chapter of the story. `tone` decides the ground: paper chapters and ink
 * chapters alternate, which is how the page carries light and dark. `id` is the
 * anchor the nav links to.
 */
export function Section({
  id,
  tone = "paper",
  children,
  className,
  label,
}: {
  id?: string;
  tone?: "paper" | "ink" | "white";
  children: ReactNode;
  className?: string;
  /** Accessible name for the region when it has no visible heading. */
  label?: string;
}) {
  return (
    <section
      id={id}
      aria-label={label}
      data-tone={tone}
      className={cn(
        "relative scroll-mt-20 py-24 md:py-36",
        tone === "ink" && "w-ink w-grain",
        tone === "white" && "bg-[var(--w-white)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Mono eyebrow with a small ember tick — "01 · The problem". */
export function Eyebrow({ children, n, className }: { children: ReactNode; n?: string; className?: string }) {
  return (
    <p className={cn("w-eyebrow flex items-center gap-2.5", className)}>
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--w-ember)]" />
      {n && <span className="opacity-60">{n}</span>}
      {n && <span aria-hidden className="opacity-30">/</span>}
      <span>{children}</span>
    </p>
  );
}

/** The heading block every chapter opens with: eyebrow, title, lead. */
export function ChapterHead({
  eyebrow,
  n,
  title,
  lead,
  align = "left",
  className,
}: {
  eyebrow: ReactNode;
  n?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-[760px]", align === "center" && "mx-auto text-center", className)}>
      <div data-reveal className={cn(align === "center" && "flex justify-center")}>
        <Eyebrow n={n} className="text-[var(--w-ember-text)] [.w-ink_&]:text-[var(--w-ember-soft)]">
          {eyebrow}
        </Eyebrow>
      </div>
      <h2 data-reveal style={{ "--w-delay": "80ms" } as CSSProperties} className="w-h2 mt-5">
        {title}
      </h2>
      {lead && (
        <p
          data-reveal
          style={{ "--w-delay": "160ms" } as CSSProperties}
          className={cn("w-lead mt-6 text-[var(--w-muted)] [.w-ink_&]:text-[var(--w-muted-ink)]", align === "center" && "mx-auto max-w-[620px]")}
        >
          {lead}
        </p>
      )}
    </div>
  );
}

/** A link styled as a button. Internal hrefs use next/link. */
export function LinkButton({
  href,
  children,
  variant = "primary",
  arrow,
  className,
  onInk,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "dark" | "ghost";
  arrow?: boolean;
  className?: string;
  /** A ghost button sitting on ink outside an ink Section (e.g. the nav). */
  onInk?: boolean;
}) {
  const cls = cn("w-btn", `w-btn-${variant}`, onInk && "on-ink", className);
  const inner = (
    <>
      {children}
      {arrow && <ArrowRight aria-hidden size={16} strokeWidth={2} className="w-arrow" />}
    </>
  );
  return href.startsWith("#") || href.startsWith("http") ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

/* ── device frames ─────────────────────────────────────────────────────── */

/** A browser window around an OS screenshot: traffic lights and an address bar. */
export function BrowserFrame({
  src,
  alt,
  url = "app.counterfoil.app",
  className,
  priority,
  dark,
  sizes = "(min-width: 1200px) 1100px, 100vw",
}: {
  src: StaticImageData;
  alt: string;
  url?: string;
  className?: string;
  priority?: boolean;
  dark?: boolean;
  sizes?: string;
}) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-[14px] md:rounded-[18px]",
        dark
          ? "bg-[var(--w-ink-2)] shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_40px_120px_-30px_rgb(0_0_0/0.8)]"
          : "bg-[var(--w-white)] shadow-[0_0_0_1px_rgb(20_20_19/0.08),0_40px_100px_-40px_rgb(20_20_19/0.45)]",
        className,
      )}
    >
      <div className={cn("flex h-8 items-center gap-3 px-3.5 md:h-10", dark ? "border-b border-white/[0.06]" : "border-b border-[var(--w-line)]")}>
        <span aria-hidden className="flex gap-1.5">
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
          ))}
        </span>
        <span
          className={cn(
            "w-mono mx-auto hidden truncate rounded-md px-3 py-0.5 text-[12px] sm:block",
            dark ? "bg-white/[0.06] text-white/50" : "bg-[var(--w-paper)] text-[var(--w-muted)]",
          )}
        >
          {url}
        </span>
        <span aria-hidden className="hidden w-[46px] sm:block" />
      </div>
      <Image src={src} alt={alt} priority={priority} sizes={sizes} className="block h-auto w-full" placeholder="blur" />
    </figure>
  );
}

/** A phone around a Go screenshot. Width is set by the caller. */
export function PhoneFrame({ src, alt, className, sizes = "320px" }: { src: StaticImageData; alt: string; className?: string; sizes?: string }) {
  return (
    <figure
      className={cn(
        "relative rounded-[34px] bg-[#0d0d0c] p-[7px] shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_30px_80px_-20px_rgb(0_0_0/0.55)]",
        className,
      )}
    >
      <div className="overflow-hidden rounded-[28px]">
        <Image src={src} alt={alt} sizes={sizes} className="block h-auto w-full" placeholder="blur" />
      </div>
      <span aria-hidden className="absolute left-1/2 top-[13px] h-[14px] w-[64px] -translate-x-1/2 rounded-full bg-[#0d0d0c]" />
    </figure>
  );
}

/** A tablet (the till) around a landscape Go screenshot. */
export function TabletFrame({ src, alt, className, sizes = "(min-width: 1024px) 760px, 100vw" }: { src: StaticImageData; alt: string; className?: string; sizes?: string }) {
  return (
    <figure
      className={cn(
        "rounded-[22px] bg-[#0d0d0c] p-[10px] shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_40px_100px_-30px_rgb(0_0_0/0.6)] md:rounded-[28px] md:p-[14px]",
        className,
      )}
    >
      <div className="overflow-hidden rounded-[12px] md:rounded-[16px]">
        <Image src={src} alt={alt} sizes={sizes} className="block h-auto w-full" placeholder="blur" />
      </div>
    </figure>
  );
}
