import { cn } from "@/lib/cn";
import { LogoMark } from "./LogoMark";

/**
 * The Counterfoil logo lockup — mark + wordmark, with an optional surface
 * badge. `variant="go"` gives the front-of-house "Counterfoil Go" lockup
 * (ember GO badge); `variant="os"` the admin one (quiet OS badge).
 */
export function Logo({
  variant,
  size = 28,
  className,
}: {
  variant?: "os" | "go";
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-tight", className)}>
      <LogoMark size={size} />
      <span className="type-h2 leading-none" style={{ fontSize: Math.round(size * 0.62) }}>
        Counterfoil
      </span>
      {variant === "go" && (
        <span className="rounded-xs bg-ember/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-ember">
          Go
        </span>
      )}
      {variant === "os" && (
        <span className="font-mono text-[11px] uppercase tracking-wide text-faint">OS</span>
      )}
    </span>
  );
}
