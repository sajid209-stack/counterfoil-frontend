import { cn } from "@/lib/cn";

/**
 * The anatomy of a flat phone list row (docs/mobile.md section 8, rule 6).
 *
 *     [lead]  Title 16/600                         trailing 15/600
 *             meta · meta · meta  14 muted
 *             [status pill]
 *
 * `DataTable` draws the row itself (the tappable, full-width, hairlined
 * element) and a page's `renderCard` fills it with this, so every list reads the
 * same: a name or reference, one quiet line, the money at the right. A row's
 * hairline is inset to the text column by `DataTable`'s `phoneInset`.
 */
export function PhoneRow({
  lead,
  title,
  titleMuted,
  meta,
  trailing,
  trailingMuted,
  pill,
  action,
  className,
}: {
  /** A thumbnail or a checkbox, left of the text. */
  lead?: React.ReactNode;
  title: React.ReactNode;
  titleMuted?: boolean;
  /** One line. Use `MetaParts` to join several with a thin rule. */
  meta?: React.ReactNode;
  /** The money (or the figure the list is ranked by), right-aligned. */
  trailing?: React.ReactNode;
  trailingMuted?: boolean;
  /** A status pill, under the meta line. */
  pill?: React.ReactNode;
  /** A 40px icon button at the far right (a row menu). */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-start gap-comfortable", className)}>
      {lead && <span className="shrink-0 self-center">{lead}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-inline">
        <span className={cn("block truncate text-md font-semibold leading-6", titleMuted && "text-muted")}>{title}</span>
        {meta && <span className="flex min-w-0 items-center overflow-hidden whitespace-nowrap text-base text-muted">{meta}</span>}
        {pill && <span className="flex pt-inline">{pill}</span>}
      </span>
      {trailing != null && trailing !== false && (
        /* ds-exception: 15/600 is the spec's money size for a list row (docs/mobile.md section 8 rule 2), between text-base and text-md */
        <span className={cn("shrink-0 whitespace-nowrap text-[15px] font-semibold leading-6 tabular-nums", trailingMuted && "text-muted")}>{trailing}</span>
      )}
      {action && <span className="-mr-tight shrink-0 self-center">{action}</span>}
    </div>
  );
}

/** Meta parts on one line, joined by a thin vertical rule. Falsy parts are dropped. */
export function MetaParts({ parts }: { parts: React.ReactNode[] }) {
  const shown = parts.filter((p) => p != null && p !== false && p !== "");
  return (
    <>
      {shown.map((p, i) => (
        <span key={i} className={cn("flex items-center", i === shown.length - 1 ? "min-w-0 truncate" : "shrink-0")}>
          {i > 0 && <span aria-hidden className="mx-tight h-3 w-px shrink-0 bg-line" />}
          <span className={cn(i === shown.length - 1 && "min-w-0 truncate")}>{p}</span>
        </span>
      ))}
    </>
  );
}
