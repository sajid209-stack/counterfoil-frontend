import { cn } from "@/lib/cn";
import { useEnumLabels } from "@/lib/labels";

export type PillTone = "success" | "warning" | "danger" | "info" | "neutral";

/**
 * Two axes, because two unrelated things were sharing one scale.
 *
 * TONE says what happened to the money. SHAPE says which lifecycle the word
 * belongs to: a transaction state is a soft tint of its tone, a record state is
 * a quiet neutral tint with the word in full ink. Before this, "Active" (a
 * booking is on sale) and "Confirmed" (a reservation exists) were drawn
 * identically, so two unrelated lifecycles read as one.
 *
 * The calm pass took every outline off: a pill is sentence case Inter 12/500 on
 * a rounded-full soft tint, with no border and no ring. What used to be carried
 * by an outline (record states) is now carried by the neutral tint and the
 * full-ink word, and what used to be carried by a ring (attention) is carried
 * by a stronger tint. The owner removed chip dots on 2026-09-27, so there is no
 * dot on any pill. Contrast is
 * measured, not assumed: every pair below is >= 4.5:1 on a card, in light and
 * in dark (the dark neutral steps off `bg-subtle`, which IS the card there).
 */
type PillShape = "transaction" | "record";

const TONES: Record<PillTone, string> = {
  success: "bg-success/10 text-success",
  /* ATTENTION — the only tone that means somebody has to do something. It is
     the one that costs an operator money when it is missed, so it gets the
     strongest non-destructive treatment available: a heavier tint than every
     other tone, so it separates from `info` by weight as well as by hue. Not
     a filled ember pill: white on ember is 3.50:1, which a 12px label cannot
     carry. */
  warning: "bg-warning/20 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  /* Dark: `subtle` is the card colour there, so the tint comes off the
     foreground instead — and the text steps up from `muted`, which measures
     3.9:1 on that tint. */
  neutral: "bg-subtle text-muted dark:bg-fg/10 dark:text-fg/75",
};

/* A record state is quiet on purpose: a neutral tint with the word in full ink,
   so it reads apart from the transaction tints without a dot (the owner removed
   chip dots on 2026-09-27). "Active" is a fact about a record, not an event to
   be noticed. */
const RECORD_BG = "bg-subtle dark:bg-fg/10";
const RECORD_TEXT: Record<PillTone, string> = {
  success: "text-fg",
  warning: "text-fg",
  danger: "text-fg",
  info: "text-fg",
  neutral: "text-muted dark:text-fg/75",
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
  const record = resolvedShape === "record";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-sans text-[0.75rem] font-medium leading-5",
        record ? cn(RECORD_BG, RECORD_TEXT[resolvedTone]) : TONES[resolvedTone],
        className,
      )}
    >
      {label}
    </span>
  );
}
