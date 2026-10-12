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
 * A pill is sentence case Inter 12/500 on a rounded-full soft badge — the Color
 * System's `*-wash` fill with the tone's own foreground token on the word, and
 * no border, no ring and no dot (the owner removed chip dots on 2026-09-27).
 * Neutral and record states are `subtle` with `fg-secondary`; because `subtle`
 * and the card are the same value in dark, those two carry a `line` ring so
 * the badge still has an edge there. Nothing is an alpha tint or a `dark:`
 * override: light and dark differ only because the tokens do, and each pair is
 * >= 4.5:1 on a card in both modes.
 */
type PillShape = "transaction" | "record";

const TONES: Record<PillTone, string> = {
  success: "bg-success-wash text-success",
  /* ATTENTION — the only tone that means somebody has to do something. It is
     the one that costs an operator money when it is missed, and it separates
     from `info` by hue and by its amber wash. */
  warning: "bg-warning-wash text-warning",
  danger: "bg-danger-wash text-danger",
  info: "bg-info-wash text-info",
  neutral: "bg-subtle text-fg-secondary ring-1 ring-inset ring-line",
};

/* A record state is quiet on purpose: `subtle` with `fg-secondary` and a `line`
   ring (the outlined record style), so it reads apart from the transaction
   tints. "Active" is a fact about a record, not an event to be noticed. */
const RECORD = "bg-subtle text-fg-secondary ring-1 ring-inset ring-line";

/** Record lifecycle — is this thing on the shelf? — rather than what a sale did. */
const RECORD_STATES = new Set(["active", "inactive", "archived", "suspended", "invited"]);

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
  size = "sm",
  className,
}: {
  children?: React.ReactNode;
  tone?: PillTone;
  /** convenience: derive tone + label from a domain status string */
  status?: string;
  /** Override the lifecycle the status belongs to; derived from it otherwise. */
  shape?: PillShape;
  /** `sm` (default) is 12px; `md` is 13px for the Go surface, which reads at
   *  arm's length. The shape is a pill either way. */
  size?: "sm" | "md";
  className?: string;
}) {
  const { status: statusLabel } = useEnumLabels();
  const resolvedTone = tone ?? (status ? statusTone(status) : "neutral");
  const resolvedShape: PillShape = shape ?? (status && RECORD_STATES.has(status) ? "record" : "transaction");
  const label = children ?? (status ? statusLabel(status) : "");
  const record = resolvedShape === "record";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-inline rounded-full py-0.5 font-sans font-medium leading-5",
        size === "md" ? "px-3 text-sm" : "px-2.5 text-xs",
        record ? RECORD : TONES[resolvedTone],
        className,
      )}
    >
      {label}
    </span>
  );
}
