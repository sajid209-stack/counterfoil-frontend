import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Small dark-glass pieces shared by the Interface, PhoneStory and Payments scenes. */

/** A dark-glass pill: an ember dot, a title and an optional sub line. */
export function GlassChip({
  title,
  sub,
  icon,
  className,
  style,
}: {
  title: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={style}
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-[rgb(12_12_11/0.74)] px-3 py-1.5 text-[12px] text-[var(--cf-fg)] shadow-[0_0_0_1px_rgb(0_0_0/0.4),0_14px_36px_-12px_rgb(0_0_0/0.9),0_0_28px_-10px_rgb(249_74_0/0.45)] backdrop-blur-md",
        className,
      )}
    >
      {icon ?? <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--cf-accent)] shadow-[0_0_8px_var(--cf-accent)]" />}
      <span className="min-w-0">
        <span className="block font-medium leading-tight">{title}</span>
        {sub && <span className="block leading-tight text-[var(--cf-muted)]">{sub}</span>}
      </span>
    </span>
  );
}

/* A fixed scatter of stars, drawn as CSS gradients: no canvas, nothing to repaint. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const STARS = (() => {
  const r = seeded(20261101);
  const layers: string[] = [];
  for (let i = 0; i < 46; i++) {
    const a = (0.25 + r() * 0.55).toFixed(2);
    layers.push(`radial-gradient(1px 1px at ${(r() * 100).toFixed(1)}% ${(r() * 100).toFixed(1)}%, rgb(245 242 235 / ${a}), transparent)`);
  }
  return layers.join(",");
})();

/** A quiet starfield behind a section. Decorative. */
export function StarBg({ className }: { className?: string }) {
  return <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)} style={{ backgroundImage: STARS }} />;
}
