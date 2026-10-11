"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * A filter or a choice that toggles — "Paid", "Outdoor", "This week".
 *
 * Use it for a SET of independent on/off filters or tags (each chip is its own
 * yes/no) and for showing an applied filter you can clear. One-of-many views
 * are a SegmentedControl; page-level navigation is Tabs.
 *
 * Unselected is a quiet outlined pill; selected is the solid ember fill with a
 * check, so selection never depends on colour alone. `aria-pressed` carries it
 * to assistive tech. Pass `onRemove` for an applied-filter chip ("Status: Paid
 * ×"): the label stays a button (clicking it can still re-open the filter) and
 * the × is its own 44px-on-phone target with a spoken name.
 */
export function Chip({
  children,
  selected = false,
  onClick,
  onRemove,
  removeLabel,
  count,
  icon,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  selected?: boolean;
  /** Toggle handler. Omit it for a read-only chip (usually with `onRemove`). */
  onClick?: () => void;
  /** Adds a × button that removes the filter. */
  onRemove?: () => void;
  /** Spoken name of the × — "Remove Status: Paid". Defaults to "Remove". */
  removeLabel?: string;
  /** A trailing figure — how many things the filter matches. */
  count?: number;
  /** A glyph before the label; replaced by a check when selected. */
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  /** A spoken name when the visible label is not enough (an icon, a swatch). */
  "aria-label"?: string;
}) {
  const t = useTranslations("common");

  const tone = selected
    ? "border-transparent bg-ember-solid text-on-solid"
    : "border-line bg-card text-fg enabled:hover:bg-muted-wash";

  const body = (
    <>
      {selected ? <Check size={14} strokeWidth={3} aria-hidden className="shrink-0" /> : icon}
      <span className="min-w-0 truncate">{children}</span>
      {count != null && (
        <span className={cn("text-xs tabular-nums", selected ? "text-on-solid" : "text-muted")}>{count}</span>
      )}
    </>
  );

  const shell =
    "inline-flex h-11 max-w-full items-center gap-inline rounded-full border text-sm font-medium transition-colors duration-quick ease-counterfoil md:h-8";

  // A removable chip is a pill holding two buttons: the label and the ×.
  if (onRemove) {
    return (
      <span className={cn(shell, tone, "pl-comfortable", className)}>
        {onClick ? (
          <button
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            aria-label={ariaLabel}
            onClick={onClick}
            className="inline-flex min-w-0 items-center gap-inline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {body}
          </button>
        ) : (
          <span className="inline-flex min-w-0 items-center gap-inline">{body}</span>
        )}
        <button
          type="button"
          disabled={disabled}
          aria-label={removeLabel ?? t("remove")}
          onClick={onRemove}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity duration-quick hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 md:h-8 md:w-8"
        >
          <X size={14} strokeWidth={2} aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
            aria-label={ariaLabel}
      onClick={onClick}
      className={cn(shell, tone, "px-comfortable active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50", className)}
    >
      {body}
    </button>
  );
}
