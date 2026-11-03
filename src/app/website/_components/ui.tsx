import { ButtonLink } from "@/components/ui/Button";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

/* The website's primitives. The rules they enforce came from measuring eight
   world-class SaaS sites (attio, linear, ramp, stripe, mercury, square, toast,
   shopify): one type scale, one column, generous section rhythm, and buttons
   that are the product's own. Sections compose these; nothing decorates. */

/** Stagger helper for `data-reveal`: `style={delay(120)}`. */
export const delay = (ms: number) => ({ "--cf-delay": `${ms}ms` }) as CSSProperties;

/** The one column: 1200px with a 20px gutter on phones, 32px from md. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1264px] px-5 md:px-8", className)}>{children}</div>;
}

/** A band of the page. `paper` is the warm neutral, `ink` the one dark band. */
export function Section({
  id,
  tone = "white",
  children,
  className,
  label,
}: {
  id?: string;
  tone?: "white" | "paper" | "ink";
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section
      id={id}
      aria-label={label}
      className={cn(
        "scroll-mt-20 py-20 md:py-28",
        tone === "paper" && "bg-[var(--cf-paper)]",
        tone === "ink" && "cf-on-ink bg-[var(--cf-ink)]",
        className,
      )}
    >
      <Container>{children}</Container>
    </section>
  );
}

/** Eyebrow, heading, lead: how every section opens. Plain ink, no tricks. */
export function Heading({
  eyebrow,
  title,
  lead,
  align = "left",
  as: H = "h2",
  className,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2";
  className?: string;
  /** Buttons under the lead. */
  children?: ReactNode;
}) {
  const center = align === "center";
  return (
    <div className={cn("max-w-[760px]", center && "mx-auto text-center", className)}>
      {eyebrow && (
        <p data-reveal className="cf-eyebrow mb-4">
          {eyebrow}
        </p>
      )}
      <H data-reveal style={delay(60)} className={H === "h1" ? "cf-display" : "cf-h2"}>
        {title}
      </H>
      {lead && (
        <p data-reveal style={delay(120)} className={cn("cf-lead mt-5", center && "mx-auto max-w-[620px]")}>
          {lead}
        </p>
      )}
      {children && (
        <div data-reveal style={delay(180)} className={cn("mt-8 flex flex-wrap items-center gap-3", center && "justify-center")}>
          {children}
        </div>
      )}
    </div>
  );
}

/** A link that is the app's own Button, so the calls to action are the product's. */
export function LinkButton({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <ButtonLink href={href} variant={variant} size={size} className={cn("whitespace-nowrap", className)}>
      {children}
    </ButtonLink>
  );
}
