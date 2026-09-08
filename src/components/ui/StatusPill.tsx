import { cn } from "@/lib/cn";
import { useEnumLabels } from "@/lib/labels";

export type PillTone = "success" | "warning" | "danger" | "info" | "neutral";

/**
 * Two axes, because two unrelated things were sharing one scale.
 *
 * TONE says what happened to the money. SHAPE says which lifecycle the word
 * belongs to: a transaction state is tinted, a record state is outlined. Before
 * this, "Active" (a booking is on sale) and "Confirmed" (a reservation exists)
 * were drawn identically, so two unrelated lifecycles read as one.
 */
type PillShape = "transaction" | "record";

const TONES: Record<PillTone, string> = {
  success: "bg-success/10 text-success",
  /* ATTENTION — the only tone that means somebody has to do something. It is
     the one that costs an operator money when it is missed, so it gets the
     strongest non-destructive treatment available: a heavier tint AND a ring,
     so it is separable from `info` by shape as well as by hue. Not a filled
     ember pill: white on ember is 3.50:1, which a 12px label cannot carry. */
  warning: "bg-warning/15 text-warning ring-1 ring-warning/35",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  neutral: "bg-subtle text-muted",
};

const OUTLINED: Record<PillTone, string> = {
  success: "border border-success/40 text-success",
  warning: "border border-warning/50 text-warning",
  danger: "border border-danger/40 text-danger",
  info: "border border-info/40 text-info",
  neutral: "border border-strong text-muted",
};

const DOTS: Record<PillTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-muted",
};

/** Record lifecycle — is this thing on the shelf? — rather than what a sale did. */
const RECORD = new Set(["active", "inactive", "archived", "suspended", "invited"]);

/**
 * Map a domain status string to a tone. Colour never carries meaning alone —
 * the label text always accompanies it, and the shape carries the lifecycle.
 *
 * The mapping changed on 2026-09-08. It used to put `pending` and `partial` on
 * the same warning tint, which is the single most expensive collision in a POS:
 * pending is in flight and needs nobody, partial means a customer owes money
 * and somebody has to collect it. It also drew `cancelled` in danger beside
 * `refunded`, implying something went wrong with an order that simply never
 * happened and moved no money.
 */
export function statusTone(status: string): PillTone {
  switch (status) {
    // Settled — terminal, the money is in.
    case "active":
    case "confirmed":
    case "paid":
    case "completed":
      return "success";
    // In flight, no action needed.
    case "pending":
    case "invited":
      return "info";
    // Action needed: a balance is owed, or part of one has gone back.
    case "partial":
    case "partly_refunded":
      return "warning";
    // Reversed — money went back out.
    case "refunded":
    case "suspended":
      return "danger";
    // Void — terminal, no money moved. Not an error.
    case "cancelled":
    case "void":
    case "inactive":
    case "archived":
      return "neutral";
    default:
      return "neutral";
  }
}

export function StatusPill({
  children,
  tone,
  status,
  shape,
  className,
}: {
  children?: React.ReactNode;
  tone?: PillTone;
  /** convenience: derive tone + label from a domain status string */
  status?: string;
  /** Override the lifecycle the status belongs to; derived from it otherwise. */
  shape?: PillShape;
  className?: string;
}) {
  const { status: statusLabel } = useEnumLabels();
  const resolvedTone = tone ?? (status ? statusTone(status) : "neutral");
  const resolvedShape: PillShape = shape ?? (status && RECORD.has(status) ? "record" : "transaction");
  const label = children ?? (status ? statusLabel(status) : "");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-inline rounded-xs px-tight py-inline font-mono text-[12px] uppercase tracking-wide",
        resolvedShape === "record" ? OUTLINED[resolvedTone] : TONES[resolvedTone],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[resolvedTone])} aria-hidden />
      {label}
    </span>
  );
}
