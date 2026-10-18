import { cn } from "@/lib/cn";

type Tone = "ember" | "success" | "info" | "warning" | "danger" | "neutral";

/** Soft-round icon tints, the same pairs the figure cards use. */
const TONE: Record<Tone, string> = {
  ember: "bg-ember-wash text-brand-foreground",
  success: "bg-success-wash text-success",
  info: "bg-info-wash text-info",
  warning: "bg-warning-wash text-warning",
  danger: "bg-danger-wash text-danger",
  neutral: "bg-subtle text-fg-secondary",
};

/**
 * The calm lead card of a record page on a phone (docs/mobile.md section 6):
 * what this is, the one figure that matters, and who or when. Phone only —
 * from `sm` the page draws what it always did.
 */
export function RecordHero({
  icon,
  tone = "neutral",
  label,
  figure,
  sub,
  meta,
  className,
}: {
  icon: React.ReactNode;
  tone?: Tone;
  /** What the figure is ("On hand", "Price from"). */
  label: string;
  figure: React.ReactNode;
  /** One line under the figure. */
  sub?: React.ReactNode;
  /** A quiet last line: who, when. */
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card-surface p-card sm:hidden", className)}>
      <div className="flex items-center gap-comfortable">
        <span aria-hidden className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full [&>svg]:h-4 [&>svg]:w-4", TONE[tone])}>
          {icon}
        </span>
        <p className="min-w-0 truncate text-sm text-muted">{label}</p>
      </div>
      <p className="type-figure mt-comfortable break-words text-3xl font-semibold leading-tight">{figure}</p>
      {sub && <p className="mt-inline text-sm text-muted">{sub}</p>}
      {meta && <p className="mt-comfortable text-sm text-muted">{meta}</p>}
    </section>
  );
}
