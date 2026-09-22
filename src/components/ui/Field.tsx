"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

export type FieldVariant =
  | "text"
  | "number"
  | "email"
  | "password"
  | "select"
  | "textarea"
  | "toggle"
  | "date";

export interface SelectOption {
  value: string;
  label: string;
}

interface FormFieldProps {
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
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

const controlBase =
  "w-full rounded-sm border bg-card px-comfortable text-sm outline-none transition-colors duration-quick placeholder:text-faint disabled:cursor-not-allowed disabled:bg-subtle disabled:text-faint";

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
        <label htmlFor={htmlFor} className="type-label text-[12px] text-muted">
          {label}
          {required && <span className="ml-inline text-danger">*</span>}
        </label>
      )}
      {children}
      {/* The id lets the control name this line as its description, so a
          screen reader reads the help — or the error — with the field rather
          than leaving it to be found by wandering. */}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-msg` : undefined} className="text-[12px] text-danger">{error}</p>
      ) : help ? (
        <p id={htmlFor ? `${htmlFor}-msg` : undefined} className="text-[12px] text-muted">{help}</p>
      ) : null}
    </div>
  );
}

/** One field to rule them all — label + control + help/error, switched by
 *  variant. No product logic; it knows nothing about any entity. */
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
  ...control
}: FormFieldProps) {
  const id = useId();
  const described = {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error || help ? `${id}-msg` : undefined,
  } as const;
  const border = error ? "border-danger focus:ring-2 focus:ring-danger/20" : "border-line focus:border-ember focus:ring-2 focus:ring-ember/20";

  // Toggle is laid out inline (control beside label), not stacked.
  if (variant === "toggle") {
    return (
      <div className={cn("flex flex-col gap-inline", className)}>
        <label className="flex cursor-pointer items-center gap-comfortable">
          <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={control.disabled}
            name={control.name}
            {...described}
            className="peer sr-only"
          />
          <span className="relative h-6 w-11 shrink-0 rounded-lg bg-line transition-colors duration-quick peer-checked:bg-ember peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-card after:transition-transform after:duration-quick peer-checked:after:translate-x-5" />
          {label && <span className="text-sm">{label}</span>}
        </label>
        {error ? (
          <p id={`${id}-msg`} className="text-[12px] text-danger">{error}</p>
        ) : help ? (
          <p id={`${id}-msg`} className="text-[12px] text-muted">{help}</p>
        ) : null}
      </div>
    );
  }

  let field: React.ReactNode;
  if (variant === "select") {
    field = (
      <select
        id={id}
        onChange={onChange}
        {...described}
        {...control}
        className={cn(controlBase, border, "h-11 pr-section")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (variant === "textarea") {
    field = (
      <textarea
        id={id}
        rows={rows}
        onChange={onChange}
        {...described}
        {...control}
        className={cn(controlBase, border, "resize-y py-tight")}
      />
    );
  } else {
    const type = variant === "text" ? "text" : variant;
    field = (
      <input
        id={id}
        type={type}
        onChange={onChange}
        {...described}
        {...control}
        className={cn(controlBase, border, "h-11")}
      />
    );
  }

  return (
    <Field label={label} help={help} error={error} required={required} htmlFor={id} className={className}>
      {field}
    </Field>
  );
}
