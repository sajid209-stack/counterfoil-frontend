import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import styles from "./Stage.module.css";

/**
 * A Jimo-style floating bubble: a white soft-shadow pill with an ember-wash
 * icon tile. It pops in with a spring when `show` turns true and then bobs.
 * `className` positions it (absolute) inside a relative stage. Decorative —
 * whatever it says is also on screen in the recording or the copy beside it.
 */
export function Bubble({
  icon: Icon,
  title,
  sub,
  show,
  className,
  bob = 0,
}: {
  icon: LucideIcon;
  title: string;
  sub?: string;
  show: boolean;
  className?: string;
  /** Seconds to offset this bubble's float so a group never bobs in step. */
  bob?: number;
}) {
  return (
    <div aria-hidden className={cn("absolute z-20", className)}>
      <div className={cn(styles.pop, show && styles.in)}>
        <div className={styles.float} style={{ animationDelay: `${-bob}s` } as CSSProperties}>
          <div className="flex items-center gap-2.5 rounded-2xl bg-white py-2 pl-2 pr-4 shadow-[0_22px_44px_-16px_rgb(140_50_0/0.34),0_4px_12px_-4px_rgb(0_0_0/0.08)]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-brand-50,#fff5ee)] text-[var(--color-brand-foreground,#aa3000)]">
              <Icon size={18} strokeWidth={1.8} />
            </span>
            <span className="whitespace-nowrap">
              <span className="block text-[13px] font-semibold leading-tight text-[var(--cf-fg)]">{title}</span>
              {sub && <span className="mt-0.5 block text-[12px] leading-tight text-[var(--cf-muted)]">{sub}</span>}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The warm, slowly drifting mesh that sits behind every stage. */
export function Mesh() {
  return (
    <div aria-hidden className={styles.mesh}>
      <span className={cn(styles.blob, styles.b1)} />
      <span className={cn(styles.blob, styles.b2)} />
      <span className={cn(styles.blob, styles.b3)} />
    </div>
  );
}
