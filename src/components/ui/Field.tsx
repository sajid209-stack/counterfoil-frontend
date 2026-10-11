"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { DEMO_TODAY } from "@/lib/schedule";
import { DateField } from "./DateField";
import { Select, type SelectOption } from "./Select";
import { Switch } from "./Switch";

export type FieldVariant =
  | "text"
  | "number"
  | "email"
  | "password"
  | "tel"
  | "url"
  | "search"
  | "select"
  | "textarea"
  | "toggle"
  | "date";

/* One option shape across the app: Select owns it, and a Field's caller gets
   its `note`, `group` and `disabled` for free. */
export type { SelectOption } from "./Select";

/* ── The one control chrome ────────────────────────────────────────────────
 *
 * Every text-like control in the product — a text field, a textarea, a
 * settings input, a field with a unit — wears this recipe, so a form never
 * mixes two looks: a 1px `line` edge, the `card` fill, the control radius
 * (6px in OS, a pill in Go), 44px tall, `strong` on hover, `ember` on focus as
 * the secondary edge cue. The PRIMARY focus indicator is the global
 * `:focus-visible` ring — nothing here draws its own. Invalid is a `danger`
 * edge, with `aria-invalid` and a message set by the caller (see FormField).
 */
const CHROME =
  "w-full min-w-0 rounded-control bg-card text-base text-fg transition-colors duration-quick ease-counterfoil placeholder:text-faint disabled:cursor-not-allowed disabled:bg-subtle disabled:text-faint";

/** The class string for a bare `<input>` / `<textarea>` / `<select>` wrapper.
 *  `multiline` swaps the fixed 44px height for vertical padding. */
export function controlClass(invalid?: boolean, multiline?: boolean): string {
  return cn(
    CHROME,
    "border",
    multiline ? "px-comfortable py-tight" : "h-11 px-comfortable",
    invalid ? "border-danger" : "border-line enabled:hover:border-strong focus:border-ember",
  );
}

/** The same chrome for a composite control — a box that CONTAINS the input
 *  plus a prefix, suffix or button. Pair with `data-focus-host` on the box so
 *  the inner input draws no square outline inside the rounded shell; the ring
 *  is drawn on the shell instead (see AffixInput). */
export function controlShellClass(invalid?: boolean, inset?: boolean): string {
  return cn(
    CHROME,
    "flex h-11",
    /* `inset` draws the edge as an inset ring rather than a border: a border
       takes two pixels out of the 44px box, and the steppers / buttons inside
       a composite control were left 42px tall on a phone. */
    inset
      ? cn("ring-1 ring-inset", invalid ? "ring-danger" : "ring-line hover:ring-strong focus-within:ring-ember")
      : cn("border", invalid ? "border-danger" : "border-line hover:border-strong focus-within:border-ember"),
    "has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
  );
}

type AffixProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix" | "size"> & {
  /** Text or a glyph fixed before the value — "৳", a search icon. */
  prefix?: React.ReactNode;
  /** Text or a glyph fixed after the value — "%", "days", a button. */
  suffix?: React.ReactNode;
  invalid?: boolean;
  /** Classes for the input itself (alignment, tabular figures…). */
  inputClassName?: string;
};

/**
 * A text input with a fixed unit or glyph at either end: "15 %", "৳ 500",
 * "🔍 Search". The chrome is the shared one; the affixes sit INSIDE it, so the
 * box reads as one control and the focus ring follows its shape.
 */
export function AffixInput({ prefix, suffix, invalid, className, inputClassName, disabled, ...input }: AffixProps) {
  return (
    <div
      data-focus-host=""
      className={cn(controlShellClass(invalid, true), "items-center", disabled && "bg-subtle", className)}
    >
      {prefix != null && <span className="shrink-0 pl-comfortable text-muted">{prefix}</span>}
      <input
        {...input}
        disabled={disabled}
        aria-invalid={invalid || input["aria-invalid"] || undefined}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-base text-fg placeholder:text-faint disabled:cursor-not-allowed disabled:text-faint",
          prefix != null ? "pl-tight" : "pl-comfortable",
          suffix != null ? "pr-tight" : "pr-comfortable",
          inputClassName,
        )}
      />
      {suffix != null && <span className="shrink-0 pr-comfortable text-muted">{suffix}</span>}
    </div>
  );
}

interface FormFieldProps {
  /** The control's id; generated when omitted. */
  id?: string;
  label?: string;
  help?: string;
  error?: string;
  required?: boolean;
  variant?: FieldVariant;
  options?: SelectOption[]; // select only
  className?: string;
  // control props (native)
  name?: string;
  value?: string;
  defaultValue?: string;
  checked?: boolean; // toggle
  placeholder?: string;
  disabled?: boolean;
  rows?: number; // textarea
  /** A unit or glyph before / after the value (text-like variants). */
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  /** Bounds — a `number`'s range, or a `date`'s earliest / latest day. */
  min?: string | number;
  max?: string | number;
  step?: string | number;
  /** What the browser may fill in — a sign-in form without it makes somebody
   *  type an address their phone already knows. */
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/** The label/help/error wrapper. Wrap any control with it. */
export function Field({
  label,
  help,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label?: string;
  help?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-tight", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-muted">
          {label}
          {required && <span className="ml-inline text-danger">*</span>}
        </label>
      )}
      {children}
      {/* The id lets the control name this line as its description, so a
          screen reader reads the help — or the error — with the field rather
          than leaving it to be found by wandering. */}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-msg` : undefined} className="text-xs text-danger">{error}</p>
      ) : help ? (
        <p id={htmlFor ? `${htmlFor}-msg` : undefined} className="text-xs text-muted">{help}</p>
      ) : null}
    </div>
  );
}

/** What each text-like variant hands to the browser as `type`, and the soft
 *  keyboard it should raise on a phone. */
const TEXT_LIKE: Partial<Record<FieldVariant, { type: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] }>> = {
  text: { type: "text" },
  number: { type: "number" },
  email: { type: "email", inputMode: "email" },
  password: { type: "password" },
  tel: { type: "tel", inputMode: "tel" },
  url: { type: "url", inputMode: "url" },
  search: { type: "search", inputMode: "search" },
};

/**
 * One field to rule them all — label + control + help/error, switched by
 * variant. No product logic; it knows nothing about any entity.
 *
 * Use it for every labelled form control. Invalid state is a `danger` edge,
 * `aria-invalid`, and the message below (which replaces the help line and is
 * named as the control's description). `prefix`/`suffix` add a unit or glyph
 * inside the box; `variant="date"` is Counterfoil's own calendar, not the
 * browser's; `variant="toggle"` is the Switch.
 */
export function FormField({
  label,
  help,
  error,
  required,
  variant = "text",
  options = [],
  className,
  rows = 4,
  onChange,
  checked,
  prefix,
  suffix,
  min,
  max,
  step,
  id: idProp,
  ...control
}: FormFieldProps) {
  const auto = useId();
  /* A caller may pin the control's id (a stable hook for a label elsewhere,
     a deep link or a test); otherwise it is generated. */
  const id = idProp ?? auto;
  const t = useTranslations("common");
  // A date field with no `value` is uncontrolled, as a native one was.
  const [dateInner, setDateInner] = useState(control.defaultValue ?? "");
  const described = {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error || help ? `${id}-msg` : undefined,
  } as const;

  // Toggle is laid out inline (control beside label), not stacked. The Switch
  // owns the label, the description and the 44px target.
  if (variant === "toggle") {
    return (
      <div className={className}>
        <Switch
          id={id}
          checked={checked}
          disabled={control.disabled}
          label={
            label ? (
              <>
                {label}
                {required && <span className="ml-inline text-danger">*</span>}
              </>
            ) : undefined
          }
          aria-label={label ? undefined : control.name}
          description={error ? <span className="text-danger">{error}</span> : help}
          onChange={(next) =>
            // Callers read `e.target.checked`, as they did from the native
            // checkbox this replaces.
            onChange?.({ target: { checked: next, name: control.name, value: next ? "on" : "" } } as never)
          }
        />
      </div>
    );
  }

  let field: React.ReactNode;
  if (variant === "select") {
    /* Counterfoil's own dropdown rather than the platform's: a native list
       cannot be themed, carries no second line or group heading, and puts its
       chevron wherever the OS decides. Every `variant="select"` in the product
       converts here, and gains type-ahead above four options. */
    field = (
      <Select
        id={id}
        value={String(control.value ?? "")}
        onChange={(v) => onChange?.({ target: { value: v, name: control.name } } as never)}
        options={options}
        name={control.name}
        disabled={control.disabled}
        aria-invalid={!!error}
        aria-describedby={described["aria-describedby"]}
        aria-label={label ? undefined : control.name}
      />
    );
  } else if (variant === "date") {
    /* Counterfoil's calendar, not `<input type="date">`: the native one opens
       the operating system's grid in its own locale format, with its own
       corners, in the middle of a product that says "29 Jul 2026" everywhere
       else. The value stays an ISO `yyyy-mm-dd` string, and callers keep
       reading `e.target.value`. */
    const value = control.value ?? dateInner;
    field = (
      <DateField
        id={id}
        size="form"
        value={value || null}
        today={DEMO_TODAY}
        min={typeof min === "string" ? min : undefined}
        max={typeof max === "string" ? max : undefined}
        placeholder={control.placeholder}
        labels={{
          open: t("openCalendar"),
          previousMonth: t("previousMonth"),
          nextMonth: t("nextMonth"),
          today: t("today"),
        }}
        onChange={(iso) => {
          if (control.value === undefined) setDateInner(iso);
          onChange?.({ target: { value: iso, name: control.name } } as never);
        }}
      />
    );
  } else if (variant === "textarea") {
    field = (
      <textarea
        id={id}
        rows={rows}
        onChange={onChange}
        {...described}
        {...control}
        className={cn(controlClass(!!error, true), "resize-y")}
      />
    );
  } else {
    const kind = TEXT_LIKE[variant] ?? TEXT_LIKE.text!;
    const common = {
      id,
      type: kind.type,
      onChange,
      min,
      max,
      step,
      ...described,
      ...control,
      inputMode: control.inputMode ?? kind.inputMode,
    };
    field =
      prefix != null || suffix != null ? (
        <AffixInput {...common} prefix={prefix} suffix={suffix} invalid={!!error} />
      ) : (
        <input {...common} className={controlClass(!!error)} />
      );
  }

  return (
    <Field label={label} help={help} error={error} required={required} htmlFor={id} className={className}>
      {field}
    </Field>
  );
}
