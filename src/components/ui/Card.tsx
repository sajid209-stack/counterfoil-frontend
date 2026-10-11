import { createElement, useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Card — the one surface (`card-surface` = `rounded-card shadow-card`).
 * Use instead of hand-rolling `card-surface` strings.
 *
 * • default      → resting card; `rounded-card` / `shadow-card` come from the
 *                  theme, so Go gets its larger radius without a prop
 * • interactive  → calm hover lift + press, for clickable cards
 * • glass        → translucent blurred surface, for floating panels
 * • padding      → "card" (the `p-card` token, the default) or "none" for a
 *                  card that holds a table or a full-bleed row list
 * • title/actions → optional header row: a heading element (not the HTML
 *                  `title` attribute) with controls aligned to the right
 */
export type CardProps = Omit<React.HTMLAttributes<HTMLElement>, "title"> & {
  /** Element to render. Defaults to `div`; use `section`/`article`/`li`. */
  as?: "div" | "section" | "article" | "li" | "aside" | "form";
  interactive?: boolean;
  glass?: boolean;
  padding?: "card" | "none";
  /** Header heading. The card is labelled by it when it is a landmark-ish element. */
  title?: React.ReactNode;
  /** Controls drawn at the end of the header row. */
  actions?: React.ReactNode;
  /** Heading level for `title`. Defaults to h2. */
  headingLevel?: 2 | 3 | 4;
};

export function Card({
  as = "div",
  interactive = false,
  glass = false,
  padding = "card",
  title,
  actions,
  headingLevel = 2,
  className,
  children,
  ...props
}: CardProps) {
  const headingId = useId();
  const hasHeader = title != null || actions != null;
  const bodyPadding = padding === "card" ? "p-card" : "";

  return createElement(
    as,
    {
      ...props,
      "aria-labelledby": props["aria-labelledby"] ?? (title != null && as !== "div" ? headingId : undefined),
      className: cn(
        glass ? "glass rounded-card" : "card-surface",
        interactive && "card-interactive",
        // With a header, the padding moves onto the parts so the header row can
        // carry its own hairline edge and a "none" card keeps a padded header.
        !hasHeader && bodyPadding,
        className,
      ),
    },
    hasHeader ? (
      <>
        <div
          className={cn(
            "flex items-center justify-between gap-tight px-card py-comfortable",
            children != null && "border-b border-hairline",
          )}
        >
          {title != null &&
            createElement(
              `h${headingLevel}`,
              { id: headingId, className: "min-w-0 flex-1 text-md font-semibold text-fg" },
              title,
            )}
          {actions && <div className="flex shrink-0 items-center gap-tight">{actions}</div>}
        </div>
        {children != null && <div className={bodyPadding}>{children}</div>}
      </>
    ) : (
      children
    ),
  );
}
