import { cn } from "@/lib/cn";

/**
 * The Counterfoil logo lockups.
 *
 * Two marques, and they are not interchangeable:
 *
 * - **Counterfoil** — the plain foil + lowercase wordmark. The platform, and
 *   therefore OS, the landing page and sign-in.
 * - **Counterfoil Go** — the same foil with orange motion streaks, plus the GO
 *   marque. Front-of-house ONLY. The streaks *are* the Go identity, so putting
 *   them on OS brands the admin surface as the till.
 *
 * Both are real artwork rather than a font approximation: the wordmark is a
 * drawn logotype and setting "Counterfoil" in a bold sans is a lookalike, not
 * the logo.
 */
export function Logo({
  variant,
  size = 32,
  className,
}: {
  /** "go" for the front-of-house lockup; anything else is the platform mark. */
  variant?: "os" | "go";
  /** Lockup height in px. */
  size?: number;
  className?: string;
}) {
  const isGo = variant === "go";
  const src = isGo ? "/logo-go.png" : "/logo-counterfoil.png";
  const darkSrc = isGo ? "/logo-go-dark.png" : "/logo-counterfoil-dark.png";
  const alt = isGo ? "Counterfoil Go" : "Counterfoil";

  return (
    <span className={cn("inline-flex items-center gap-tight", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} style={{ height: size }} className="w-auto dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={darkSrc} alt={alt} style={{ height: size }} className="hidden w-auto dark:block" />
      {variant === "os" && (
        <span className="self-center font-mono text-[11px] uppercase tracking-wide text-faint">
          OS
        </span>
      )}
    </span>
  );
}
