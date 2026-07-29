import { cn } from "@/lib/cn";

export type PillTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<PillTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  neutral: "bg-neutral-200 text-neutral-800",
};

const DOTS: Record<PillTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-neutral-600",
};

/** Map a domain status string to a tone. Colour never carries meaning alone —
 *  the label text always accompanies it. */
export function statusTone(status: string): PillTone {
  switch (status) {
    case "active":
    case "confirmed":
    case "paid":
    case "completed":
      return "success";
    case "pending":
    case "invited":
    case "partial":
      return "warning";
    case "archived":
    case "refunded":
    case "suspended":
    case "cancelled":
    case "void":
      return "danger";
    case "inactive":
      return "neutral";
    default:
      return "neutral";
  }
}

export function StatusPill({
  children,
  tone,
  status,
  className,
}: {
  children?: React.ReactNode;
  tone?: PillTone;
  /** convenience: derive tone + label from a domain status string */
  status?: string;
  className?: string;
}) {
  const resolvedTone = tone ?? (status ? statusTone(status) : "neutral");
  const label = children ?? status ?? "";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-inline rounded-xs px-tight py-inline font-mono text-[11px] uppercase tracking-wide",
        TONES[resolvedTone],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[resolvedTone])} aria-hidden />
      {label}
    </span>
  );
}
