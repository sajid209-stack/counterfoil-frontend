import { cn } from "@/lib/cn";

/**
 * The frame every till page sits in on a desktop or a tablet held sideways
 * (docs/pos-desktop.md §3).
 *
 * Below the `rail` variant (a phone, a tablet upright) it adds only the page's
 * own 16px gutter, which is what every Go page already had, so the phone
 * screens do not move. From `rail` up it gives the page the SaaS rhythm the
 * admin console has: a 24px gutter, a header row with the title on the left
 * and the page's actions on the right, and a content width that suits the job:
 *  - `full`   the wall, the schedule board — they use every pixel;
 *  - `wide`   lists with a side panel (check-in, my sales) — 1200px;
 *  - `narrow` one form or one task (scan, shift, settings, profile) — 880px.
 */
export function GoPage({
  width = "wide",
  className,
  children,
}: {
  width?: "full" | "wide" | "narrow";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "w-full px-section pt-tight rail:px-major rail:pt-0 rail:pb-major",
        width === "wide" && "rail:mx-auto rail:max-w-[75rem]", // ds-exception: page measure, not a spacing step
        width === "narrow" && "rail:mx-auto rail:max-w-[55rem]", // ds-exception: page measure, not a spacing step
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A till page's header: title and a quiet line under it on the left, the
 * page's actions on the right. On a phone it is the compact header the pages
 * already drew (the title at 20px); from `rail` up the title is 24px and the
 * row has room for its actions on one line.
 *
 * One primary action at most, and it goes last (rightmost) — the till's rule
 * that the orange button is always bottom-right or rightmost.
 */
export function GoPageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-section flex flex-wrap items-end justify-between gap-x-section gap-y-tight rail:min-h-16 rail:items-center rail:mb-section", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-title text-fg">{title}</h1>
        {subtitle && <p className="mt-inline text-sm text-muted rail:mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-tight">{actions}</div>}
    </header>
  );
}
