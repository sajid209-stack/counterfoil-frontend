"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

/* Both marks share one shell: ONE <label> that is the whole row — the 44px
   target with its drawn 20px mark, then the text. A native input underneath
   (so forms, autofill and the keyboard all work natively) is transparent and
   laid over the target, so a pointer, a screen reader and a test press the
   same element. The description is inside the row so tapping it toggles too,
   but it is aria-hidden and wired by aria-describedby: it describes the
   choice, it is not part of its name.

   The native input takes the focus but draws nothing — so the focus-visible
   ring is drawn on the MARK, using the same recipe as the global rule (2px of
   `ring`, 2px outside). Not a second focus system: the same one, moved onto
   the thing the eye is looking at. */
const FOCUS_ON_MARK =
  "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring";

type NativeProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "children">;

interface MarkProps extends NativeProps {
  /** Visible label. Clicking it toggles the control. */
  label?: React.ReactNode;
  /** A line under the label. */
  description?: React.ReactNode;
  /** Draws a danger edge (a Checkbox also sets aria-invalid; a Radio leaves it to its group). */
  invalid?: boolean;
}

/** The row both marks use. `input` is the native control; `mark` its drawing. */
function Shell({
  input,
  mark,
  label,
  description,
  descId,
  disabled,
  className,
}: {
  input: React.ReactNode;
  mark: React.ReactNode;
  label?: React.ReactNode;
  description?: React.ReactNode;
  descId: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("group flex items-start gap-tight", disabled ? "cursor-not-allowed" : "cursor-pointer", className)}>
      <span className="relative flex min-h-11 min-w-11 shrink-0 items-center justify-center md:min-h-9 md:min-w-9">
        {input}
        {mark}
      </span>
      {(label || description) && (
        <span className="min-w-0 flex-1 py-2.5 md:py-1.5">
          {label && <span className={cn("block text-base leading-6", disabled ? "text-muted" : "text-fg")}>{label}</span>}
          {description && (
            <span id={descId} aria-hidden className="block text-sm text-muted">
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  );
}

const INPUT_OVER = "peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed";

/**
 * A single yes/no choice that is submitted with a form, or one of several
 * independent choices ("send me: ☑ SMS ☐ e-mail"). Use a Switch for a setting
 * that applies as it flips; use Radio / SegmentedControl for one-of-many.
 *
 * Supports `indeterminate` (a "select all" over a part-selected list). Works
 * controlled (`checked` + `onCheckedChange` / `onChange`) or uncontrolled
 * (`defaultChecked`). 20px mark, 44px target through the label.
 */
export function Checkbox({
  label,
  description,
  indeterminate = false,
  invalid,
  checked,
  defaultChecked,
  onChange,
  onCheckedChange,
  disabled,
  className,
  id,
  ...rest
}: MarkProps & {
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  const ref = useRef<HTMLInputElement>(null);
  const [inner, setInner] = useState(!!defaultChecked);
  const on = checked ?? inner;

  // `indeterminate` is a DOM property with no attribute; it has to be set
  // imperatively. Assigning to a node is not a setState, so this is allowed.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const mark = indeterminate || on;
  const descId = `${inputId}-desc`;

  return (
    <Shell
      label={label}
      description={description}
      descId={descId}
      disabled={disabled}
      className={className}
      input={
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          checked={checked}
          defaultChecked={checked === undefined ? defaultChecked : undefined}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={description ? descId : undefined}
          onChange={(e) => {
            if (checked === undefined) setInner(e.target.checked);
            onChange?.(e);
            onCheckedChange?.(e.target.checked);
          }}
          className={INPUT_OVER}
          {...rest}
        />
      }
      mark={
        <span
          aria-hidden
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-xs border transition-colors duration-quick ease-counterfoil",
            mark ? "border-ember-solid bg-ember-solid text-on-solid group-hover:border-ember-hover group-hover:bg-ember-hover group-active:border-ember-active group-active:bg-ember-active" : cn("bg-card", invalid ? "border-danger" : "border-strong group-hover:border-fg"),
            disabled && "opacity-50",
            FOCUS_ON_MARK,
          )}
        >
          {indeterminate ? <Minus size={14} strokeWidth={3} /> : on ? <Check size={14} strokeWidth={3} /> : null}
        </span>
      }
    />
  );
}

/**
 * One option of a set where exactly one is chosen — use RadioGroup to wire a
 * set, or give several Radios the same `name`. For two to four short options
 * that read as modes, a SegmentedControl is usually calmer; Radio is for
 * options that need a description or sit in a form.
 *
 * Native radios underneath, so the arrow keys move and select within a `name`
 * group with no code of ours. 20px mark, 44px target through the label.
 */
export function Radio({
  label,
  description,
  invalid,
  disabled,
  className,
  id,
  ...rest
}: MarkProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const descId = `${inputId}-desc`;
  return (
    <Shell
      label={label}
      description={description}
      descId={descId}
      disabled={disabled}
      className={className}
      input={
        <input
          id={inputId}
          type="radio"
          disabled={disabled}
          aria-describedby={description ? descId : undefined}
          className={INPUT_OVER}
          {...rest}
        />
      }
      mark={
        <span
          aria-hidden
          className={cn(
            "relative h-5 w-5 rounded-full border bg-card transition-colors duration-quick ease-counterfoil",
            invalid ? "border-danger" : "border-strong group-hover:border-fg",
            // Checked: the whole disc fills, with a small white dot as the mark.
            "peer-checked:border-ember-solid peer-checked:bg-ember-solid peer-checked:group-hover:border-ember-hover peer-checked:group-hover:bg-ember-hover peer-checked:group-active:border-ember-active peer-checked:group-active:bg-ember-active",
            "after:absolute after:left-1/2 after:top-1/2 after:h-2 after:w-2 after:-translate-x-1/2 after:-translate-y-1/2 after:scale-0 after:rounded-full after:bg-on-solid after:transition-transform after:duration-quick peer-checked:after:scale-100",
            disabled && "opacity-50",
            FOCUS_ON_MARK,
          )}
        />
      }
    />
  );
}

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}

/**
 * A set of Radios sharing one name, announced as a radio group. Controlled
 * (`value` + `onChange`). Pass `aria-label` or `aria-labelledby` — a group with
 * no name is a set of unexplained dots.
 */
export function RadioGroup({
  options,
  value,
  onChange,
  name,
  orientation = "vertical",
  disabled,
  invalid,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: {
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  name?: string;
  orientation?: "vertical" | "horizontal";
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const auto = useId();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-invalid={invalid || undefined}
      className={cn(orientation === "horizontal" ? "flex flex-wrap gap-x-major" : "flex flex-col", className)}
    >
      {options.map((o) => (
        <Radio
          key={o.value}
          name={name ?? auto}
          value={o.value}
          label={o.label}
          description={o.description}
          checked={o.value === value}
          disabled={disabled || o.disabled}
          invalid={invalid}
          onChange={() => onChange(o.value)}
        />
      ))}
    </div>
  );
}
