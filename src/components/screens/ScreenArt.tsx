import { cn } from "@/lib/cn";

/**
 * The line drawing every empty page and status page shares: a ticket torn at
 * its perforation, with the page's own icon on the body and a short run of
 * dashes on the stub. A counterfoil IS the stub the venue keeps, so it is the
 * one picture the product can claim as its own.
 *
 * Drawn in `currentColor` and token colour classes only, so it is right in
 * light and dark and in both products without a single literal colour. It is
 * decoration: hidden from assistive tech, and it never animates.
 *
 * `tone` colours the icon, never the outline — the outline stays a quiet line
 * so the same drawing can sit on an empty list and on an error without either
 * looking like a different product.
 */
export type ArtTone = "neutral" | "danger" | "warning" | "info" | "accent";

const TONE: Record<ArtTone, string> = {
  neutral: "text-muted",
  danger: "text-danger",
  warning: "text-warning",
  info: "text-info",
  accent: "text-brand-foreground",
};

/* The ticket, as one path with two notches cut into the perforation. Arcs with
   sweep 0 bulge INTO the ticket, which is what a notch is. */
const OUTLINE =
  "M26 22H100A8 8 0 0 0 116 22H134A10 10 0 0 1 144 32V88A10 10 0 0 1 134 98H116A8 8 0 0 0 100 98H26A10 10 0 0 1 16 88V32A10 10 0 0 1 26 22Z";

export function ScreenArt({
  icon,
  tone = "neutral",
  size = "md",
  className,
}: {
  /** A lucide icon element, drawn on the ticket's body. */
  icon: React.ReactNode;
  tone?: ArtTone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("relative shrink-0", size === "sm" ? "w-28" : size === "md" ? "w-36" : "w-44", className)}
    >
      <svg viewBox="0 0 160 120" fill="none" className="block h-auto w-full">
        {/* The body, filled one step off the page so it reads as a surface in
            both themes; the outline is a line token, never a fill. */}
        <path d={OUTLINE} fill="currentColor" className="text-subtle" />
        <path d={OUTLINE} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="text-strong" />
        <path d="M108 30V90" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 5" strokeLinecap="round" className="text-strong" />
        {/* The stub: what the venue keeps. */}
        <path d="M120 46H132M120 60H130M120 74H126" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-strong" />
      </svg>
      {/* The icon sits on the body's centre (x 62, y 60 of the 160 × 120 box). */}
      <span className={cn("absolute inset-y-0 left-0 flex items-center justify-center", TONE[tone])} style={{ width: "77.5%" }}>
        {icon}
      </span>
    </div>
  );
}
