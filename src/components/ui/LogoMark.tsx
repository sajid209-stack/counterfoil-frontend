import { cn } from "@/lib/cn";

/* The Counterfoil foil mark — the PLAIN one, without the orange motion
   streaks. The streaks belong to Counterfoil Go and would brand every surface
   that used this as the till. Mode-aware: black foil in light, white in dark. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mark-plain.png" alt="" className="absolute inset-0 h-full w-full object-contain dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mark-plain-dark.png" alt="" className="absolute inset-0 hidden h-full w-full object-contain dark:block" />
    </span>
  );
}
