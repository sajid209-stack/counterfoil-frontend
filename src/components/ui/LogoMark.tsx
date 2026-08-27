import { cn } from "@/lib/cn";

// The Counterfoil "foil" mark (the real brand icon). Mode-aware: the black
// foil in light mode, a white foil in dark mode (both keep the ember streaks).
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mark.png" alt="" className="absolute inset-0 h-full w-full object-contain dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mark-dark.png" alt="" className="absolute inset-0 hidden h-full w-full object-contain dark:block" />
    </span>
  );
}
