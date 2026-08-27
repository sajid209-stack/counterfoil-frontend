import { cn } from "@/lib/cn";
import { LogoMark } from "./LogoMark";

/**
 * The Counterfoil logo lockup.
 * - `variant="go"` renders the real "counterfoil GO" horizontal lockup image
 *   (front-of-house), mode-aware (black in light, white in dark).
 * - otherwise: the foil mark + "Counterfoil" wordmark, with an optional quiet
 *   OS badge for the admin surface. `size` is the mark/lockup height in px.
 */
export function Logo({
  variant,
  size = 32,
  className,
}: {
  variant?: "os" | "go";
  size?: number;
  className?: string;
}) {
  if (variant === "go") {
    return (
      <span className={cn("inline-flex items-center", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-go.png" alt="Counterfoil Go" style={{ height: size }} className="w-auto dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-go-dark.png" alt="Counterfoil Go" style={{ height: size }} className="hidden w-auto dark:block" />
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center", className)} style={{ gap: Math.round(size * 0.32) }}>
      <LogoMark size={size} />
      <span className="font-extrabold leading-none tracking-tight" style={{ fontSize: Math.round(size * 0.72) }}>
        Counterfoil
      </span>
      {variant === "os" && (
        <span className="ml-0.5 self-start font-mono text-[11px] uppercase tracking-wide text-faint">OS</span>
      )}
    </span>
  );
}
