"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * The one on/off switch.
 *
 * Use it for a setting that takes effect as you flip it (or is saved with the
 * form) and has exactly two states — "Online sales: on". Use a Checkbox when
 * the choice is one of several to be submitted together, a SegmentedControl or
 * Radio when it is a choice between named options.
 *
 * A real `role="switch"` button, so it is announced as a switch with its state
 * rather than as a checkbox, and the target is the full 44px rather than the
 * 20px track. On is the pinned `ember-solid`; off is `strong`; the thumb is the
 * card colour (white when on, whatever the theme).
 *
 * Give it a `label` (and optionally a `description`) and it draws them beside
 * the track, wired up as its accessible name and description; clicking the
 * text flips it. For a switch no visible text points at — one per list row —
 * pass `aria-label` instead.
 */
export function Switch({
  checked,
  defaultChecked = false,
  onChange,
  label,
  description,
  disabled,
  id,
  className,
  "aria-label": ariaLabel,
  labelledBy,
  describedBy,
}: {
  /** Controlled. Omit it (with `defaultChecked`) for an uncontrolled switch. */
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (next: boolean) => void;
  /** Visible label, drawn after the track. */
  label?: React.ReactNode;
  /** A line under the label — what flipping it does. */
  description?: React.ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Accessible name for a switch with no visible label. */
  "aria-label"?: string;
  /** Id of an external element that names this switch. */
  labelledBy?: string;
  /** Id of an external element that describes this switch. */
  describedBy?: string;
}) {
  const auto = useId();
  const baseId = id ?? auto;
  const labelId = `${baseId}-label`;
  const descId = `${baseId}-desc`;
  const [inner, setInner] = useState(defaultChecked);
  const on = checked ?? inner;

  const flip = () => {
    const next = !on;
    if (checked === undefined) setInner(next);
    onChange?.(next);
  };

  const control = (
    <button
      type="button"
      role="switch"
      id={baseId}
      aria-checked={on}
      aria-label={label ? undefined : ariaLabel}
      aria-labelledby={label ? labelId : labelledBy}
      aria-describedby={description ? descId : describedBy}
      disabled={disabled}
      onClick={flip}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors duration-quick ease-counterfoil",
          on ? "bg-ember-solid" : "bg-strong",
        )}
      >
        {/* left-0.5 is load-bearing: a button centres its content, and an
            absolutely positioned span with no left of its own starts from that
            centre — which put the thumb outside the track. */}
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-4 w-4 rounded-full shadow-sm transition-[transform,background-color] duration-quick ease-counterfoil",
            on ? "translate-x-4 bg-on-solid" : "translate-x-0 bg-card",
          )}
        />
      </span>
    </button>
  );

  if (!label && !description) return className ? <span className={className}>{control}</span> : control;

  return (
    <div className={cn("flex items-start gap-tight", className)}>
      {control}
      <div className="min-w-0 pt-2.5">
        {label && (
          <label
            id={labelId}
            htmlFor={baseId}
            className={cn("block cursor-pointer text-base leading-6 text-fg", disabled && "cursor-not-allowed text-muted")}
          >
            {label}
          </label>
        )}
        {description && (
          <p id={descId} className="text-xs text-muted">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
