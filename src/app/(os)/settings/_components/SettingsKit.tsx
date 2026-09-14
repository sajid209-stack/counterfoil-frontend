"use client";

import { useEffect, useId } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

/*
 * The settings screens' own anatomy, built once.
 *
 * The settings products worth copying — Stripe, Linear, Vercel, GitHub,
 * Shopify — settle on the same three pieces, and this app had none of them.
 * Pages were stacks of uppercase field labels over full-width inputs, every
 * card its own shape, and a Save button that sat disabled at the foot of the
 * screen whether or not anything had changed.
 *
 *  • SettingsSection — a titled card whose rows are divided by hairlines.
 *  • SettingRow      — what the setting is and what it does on the left, the
 *                      control on the right. Reading down the left column
 *                      answers "what can I change here" without reading a
 *                      single control, which is the whole point of the shape.
 *  • SaveBar         — exists only while something has changed. A permanent
 *                      disabled button is a control that says nothing; a bar
 *                      that appears is a notice that says "you have not saved".
 */

const controlBase =
  "h-11 w-full min-w-0 rounded-sm border bg-card px-comfortable text-sm text-fg outline-none transition-colors duration-quick placeholder:text-faint disabled:cursor-not-allowed disabled:bg-subtle";

/** The field chrome every settings control shares, invalid or not. */
export function controlCls(invalid?: boolean): string {
  return cn(
    controlBase,
    invalid
      ? "border-danger focus:ring-2 focus:ring-danger/20"
      : "border-line focus:border-ember focus:ring-2 focus:ring-ember/20",
  );
}

export function SettingsSection({
  title,
  description,
  children,
  aside,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** One small affordance for the header's right edge — a count, a link. */
  aside?: React.ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="card-surface overflow-hidden">
      {/* The aside drops under the heading on a phone: beside it, a button
          squeezed "Recent sign-ins" into a column three words wide. */}
      <header className="flex flex-col gap-section px-major pb-section pt-major sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id={id} className="text-base font-semibold text-fg">
            {title}
          </h2>
          {description && <p className="mt-inline max-w-prose text-[13px] leading-relaxed text-muted">{description}</p>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </header>
      <div className="divide-y divide-hairline border-t border-hairline">{children}</div>
    </section>
  );
}

export interface SettingRowIds {
  /** Give the control this id when the row's label names it. */
  id: string;
  /** For a control group that the label names but cannot `for=` point at. */
  labelId: string;
  describedBy?: string;
}

export function SettingRow({
  label,
  description,
  error,
  layout = "inline",
  labelFor = true,
  children,
}: {
  label: string;
  description?: React.ReactNode;
  error?: string;
  /** `stack` puts the control under the label, for things wider than a field. */
  layout?: "inline" | "stack";
  /** False when the control is a group of buttons rather than one input. */
  labelFor?: boolean;
  children: (ids: SettingRowIds) => React.ReactNode;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const descId = `${id}-desc`;
  const errId = `${id}-err`;
  const describedBy = [description ? descId : "", error ? errId : ""].filter(Boolean).join(" ") || undefined;
  const inline = layout === "inline";

  return (
    <div
      className={cn(
        "grid gap-tight px-major py-section",
        inline && "sm:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] sm:items-start sm:gap-major",
      )}
    >
      {/* The label's first line sits level with the middle of a 44px control,
          so a row reads as one line rather than a caption beside a box. */}
      <div className={cn("min-w-0", inline && "sm:pt-[11px]")}>
        {labelFor ? (
          <label id={labelId} htmlFor={id} className="text-sm font-medium text-fg">
            {label}
          </label>
        ) : (
          <p id={labelId} className="text-sm font-medium text-fg">
            {label}
          </p>
        )}
        {description && (
          <p id={descId} className="mt-inline text-[13px] leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      <div className="min-w-0">
        {children({ id, labelId, describedBy })}
        {error && (
          <p id={errId} className="mt-tight text-[12px] text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/** A text field with a fixed unit at its end: "15 %", "30 days". */
export function SuffixInput({
  id,
  value,
  onChange,
  suffix,
  invalid,
  placeholder,
  describedBy,
  inputMode = "decimal",
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  suffix: string;
  invalid?: boolean;
  placeholder?: string;
  describedBy?: string;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(controlCls(invalid), "pr-16 tabular-nums")}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-comfortable flex items-center text-sm text-muted"
      >
        {suffix}
      </span>
    </div>
  );
}

/** Warn before a reload or a closed tab throws away changes nobody saved. */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const hold = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", hold);
    return () => window.removeEventListener("beforeunload", hold);
  }, [dirty]);
}

export function SaveBar({
  dirty,
  saving,
  invalid,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  invalid?: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations("settings");
  useUnsavedGuard(dirty);
  if (!dirty) return null;
  return (
    <div className="sticky bottom-section z-10 max-md:bottom-[calc(56px+env(safe-area-inset-bottom)+12px)]">
      <div
        role="region"
        aria-label={t("save.unsaved")}
        className="flex flex-wrap items-center justify-between gap-tight rounded-md border border-line bg-card px-section py-tight shadow-lg"
      >
        <p className="flex min-w-0 items-center gap-tight text-sm font-medium text-fg">
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-warning" />
          {invalid ? t("save.invalid") : t("save.unsaved")}
        </p>
        <div className="flex shrink-0 gap-tight">
          <Button variant="secondary" onClick={onDiscard} disabled={saving}>
            {t("save.discard")}
          </Button>
          <Button onClick={onSave} loading={saving} disabled={invalid}>
            {t("save.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * An on/off setting.
 *
 * A real `role="switch"` button, so it is announced as a switch with its state
 * rather than as a checkbox, and the target is the full 44px height rather than
 * the 24px track. On is the pinned solid ember with a white thumb — the house
 * rule for anything inside an ember frame.
 */
export function Switch({
  checked,
  onChange,
  labelledBy,
  describedBy,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex h-11 shrink-0 items-center rounded-full disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-11 rounded-full border transition-colors duration-quick",
          checked ? "border-ember-solid bg-ember-solid" : "border-strong bg-line",
        )}
      >
        {/* left-0 is load-bearing: a button centres its text, and an absolute
            span with no left of its own starts from that centre — which put
            the thumb on the right when off and outside the track when on. */}
        <span
          className={cn(
            "absolute left-0 top-[1px] h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-quick",
            checked ? "translate-x-[21px]" : "translate-x-[1px]",
          )}
        />
      </span>
    </button>
  );
}

export function SectionSkeleton() {
  return (
    <div aria-busy="true" className="flex max-w-3xl flex-col gap-section">
      {[0, 1].map((i) => (
        <div key={i} className="card-surface animate-pulse p-major">
          <div className="h-4 w-40 rounded-xs bg-line" />
          <div className="mt-inline h-3 w-72 max-w-full rounded-xs bg-line/70" />
          <div className="mt-major h-11 rounded-sm bg-line/50" />
          <div className="mt-tight h-11 rounded-sm bg-line/50" />
        </div>
      ))}
    </div>
  );
}
