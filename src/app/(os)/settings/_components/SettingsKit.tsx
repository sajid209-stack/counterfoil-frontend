"use client";

import { useEffect, useId } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronRight, Plus, Search, type LucideIcon } from "lucide-react";
import { AffixInput, Button, Skeleton, Switch as UiSwitch, controlClass } from "@/components/ui";
import { cn } from "@/lib/cn";
import { MD, useMediaQuery } from "@/lib/useMedia";

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

/** The field chrome every settings control shares, invalid or not. This IS the
 *  design system's one control chrome (`controlClass` in `components/ui`);
 *  the name stays so existing settings pages keep working. */
export const controlCls: (invalid?: boolean) => string = controlClass;

export function SettingsSection({
  title,
  description,
  children,
  aside,
  divided = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** One small affordance for the header's right edge — a count, a link. */
  aside?: React.ReactNode;
  /**
   * Hairlines between the rows.
   *
   * Off by default: a settings card is read down its left column, and rows of
   * fields are separated well enough by the space between them — a rule under
   * every one turns a form into a spreadsheet. Turn it on for a run of rows
   * that all look alike (a list of switches, a list of records), where a rule
   * is what lets the eye find the next one.
   */
  divided?: boolean;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="card-surface overflow-hidden">
      {/* The aside drops under the heading on a phone: beside it, a button
          squeezed "Recent sign-ins" into a column three words wide. No rule
          under the header — the heading is the card's first line, not a bar. */}
      <header className="flex flex-col gap-section px-card pb-comfortable pt-card sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id={id} className="text-md font-semibold text-fg">
            {title}
          </h2>
          {description && <p className="mt-inline max-w-prose text-sm leading-relaxed text-muted">{description}</p>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </header>
      <div className={cn(divided && "divide-y divide-hairline")}>{children}</div>
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
  trailing = false,
  icon: Icon,
  children,
}: {
  /** Phone only, and only on a `trailing` row (control at the right): a 32px tile at the left.
   *  A stacked row draws none, so label, help and field share one left edge. */
  icon?: LucideIcon;
  label: string;
  description?: React.ReactNode;
  error?: string;
  /** `stack` puts the control under the label, for things wider than a field. */
  layout?: "inline" | "stack";
  /** False when the control is a group of buttons rather than one input. */
  labelFor?: boolean;
  /**
   * A small control — a switch, a short value — that stays at the row's right
   * edge on a phone too. Without it every row stacks below `sm`, so a switch
   * list spends two lines per row on one yes/no. This is the shape a phone's
   * own settings use: the words on the left, the control on the right.
   */
  trailing?: boolean;
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
        "grid gap-tight px-card py-comfortable",
        trailing
          ? "grid-cols-[minmax(0,1fr)_auto] items-center gap-major"
          : inline && "sm:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] sm:items-start sm:gap-major",
      )}
    >
      {/* The label's first line sits level with the middle of a 44px control,
          so a row reads as one line rather than a caption beside a box. */}
      <div className={cn("min-w-0", inline && !trailing && "sm:pt-3", Icon && trailing && "max-sm:flex max-sm:items-start max-sm:gap-comfortable")}>
        {Icon && trailing && (
          <span aria-hidden className="mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-subtle text-fg-secondary sm:hidden">
            <Icon size={16} strokeWidth={1.75} />
          </span>
        )}
        <div className="min-w-0">
        {labelFor ? (
          <label id={labelId} htmlFor={id} className="text-base font-medium text-fg">
            {label}
          </label>
        ) : (
          <p id={labelId} className="text-base font-medium text-fg">
            {label}
          </p>
        )}
        {description && (
          <p id={descId} className="mt-inline text-sm leading-relaxed text-muted">
            {description}
          </p>
        )}
        </div>
      </div>
      <div className="min-w-0">
        {children({ id, labelId, describedBy })}
        {error && (
          <p id={errId} className="mt-tight text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/** A text field with a fixed unit at its end: "15 %", "30 days". A thin
 *  wrapper over the shared `AffixInput` that keeps the settings call shape
 *  (a string `onChange`, `describedBy`). */
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
    <AffixInput
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode={inputMode}
      placeholder={placeholder}
      invalid={invalid}
      aria-describedby={describedBy}
      suffix={suffix}
      inputClassName="tabular-nums"
    />
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
        className="flex flex-wrap items-center justify-between gap-tight rounded-card border border-line bg-card px-section py-tight shadow-float"
      >
        <p className="flex min-w-0 items-center gap-tight text-base font-medium text-fg">
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
 * An on/off setting — the design system's Switch (`components/ui/Switch`),
 * with the settings call shape kept: here `label` is the ACCESSIBLE NAME for a
 * switch no visible label points at (one per list row), not visible text.
 * Settings rows draw their own label and description beside it.
 */
export function Switch({
  checked,
  onChange,
  labelledBy,
  describedBy,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
  /** Accessible name, for a switch no visible label points at (one per list row). */
  label?: string;
}) {
  return (
    <UiSwitch
      checked={checked}
      onChange={onChange}
      labelledBy={labelledBy}
      describedBy={describedBy}
      disabled={disabled}
      aria-label={label}
    />
  );
}

/** The 36px icon tile that leads a settings row. */
export function IconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    // The ring is for dark, where subtle and card are the same value and a
    // fill alone leaves the glyph floating with no tile around it.
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-subtle text-muted ring-1 ring-inset ring-hairline">
      <Icon size={18} strokeWidth={1.5} aria-hidden />
    </span>
  );
}

/**
 * What a record IS, as opposed to what you can change about it.
 *
 * A settings page is label-left, control-right — the right shape for a
 * decision and the wrong one for a fact. Drawn that way, a device page could
 * only state when the tablet was last seen by burying it in the description of
 * a Turn-off button, which is a fact hiding inside a control. Facts get their
 * own block, above the things you can change, and read as a list of answers
 * rather than a form somebody has half filled in.
 */
export function RecordFacts({
  label,
  facts,
}: {
  label: string;
  facts: { key: string; label: string; value: React.ReactNode; tone?: "warn" }[];
}) {
  return (
    <dl aria-label={label} className="card-surface grid grid-cols-1 gap-x-major gap-y-section p-card sm:grid-cols-2">
      {facts.map((f) => (
        <div key={f.key} className="min-w-0">
          <dt className="text-xs font-medium text-muted">{f.label}</dt>
          {/* break-words: a counter name and a venue name run together here,
              and a fact clipped is a fact nobody has. */}
          <dd className={cn("mt-inline break-words text-base", f.tone === "warn" ? "text-warning" : "text-fg")}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A settings collection: one card, one row per record.
 *
 * Locations, counters, roles and devices were drawn with the orders table —
 * sortable headers, a status filter, a search box and "1–3 of 3 · 1 / 1"
 * pagination around three rows. That is the right tool for a ledger of
 * thousands and the wrong one for the handful of things a business sets up
 * once: it spends the page on controls and says nothing about each record. A
 * row says what the record is in words and opens it; a search appears only
 * where a list is long enough to need one.
 *
 * No overflow-hidden on the card, because a row menu opening near the last row
 * would be clipped by it; the rounded corners go to the first and last rows.
 */
export function RecordList({ label, header, children }: { label: string; header?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card-surface">
      {header}
      <ul
        aria-label={label}
        className={cn("divide-y divide-hairline [&>li:last-child>a]:rounded-b-card", !header && "[&>li:first-child>a]:rounded-t-card")}
      >
        {children}
      </ul>
    </div>
  );
}

/**
 * One record. The whole row is the link — a 16px chevron is not a target —
 * and a row menu, when there is one, sits beside the link rather than inside
 * it, so opening the menu never also opens the record.
 */
export function RecordRow({
  href,
  leading,
  title,
  badges,
  meta,
  aside,
  columns,
  control,
  menu,
}: {
  href: string;
  leading?: React.ReactNode;
  title: string;
  /** Small marks after the name: a status that is the exception, "You". */
  badges?: React.ReactNode;
  /** What the record is, in words, under its name. */
  meta?: React.ReactNode;
  /** One short value on the right; it drops under the meta on a phone. */
  aside?: React.ReactNode;
  /** Aligned values for wider screens; the page repeats them in meta below md. */
  columns?: React.ReactNode;
  /** A switch that acts on the record in place — open, on, shown. */
  control?: React.ReactNode;
  menu?: React.ReactNode;
}) {
  const trailing = (control ? 1 : 0) + (menu ? 1 : 0);
  return (
    <li className="relative">
      <Link
        href={href}
        className={cn(
          "flex min-h-16 items-center gap-section px-card py-comfortable transition-colors duration-quick hover:bg-muted-wash",
          // Room for the trailing controls: the card inset they sit at, plus
          // their width — 108px for a switch and a menu, 56 for one.
          trailing === 2 ? "pr-[calc(var(--spacing-card)_+_6.75rem)]" : trailing === 1 ? "pr-[calc(var(--spacing-card)_+_3.5rem)]" : undefined,
        )}
      >
        {leading}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-tight gap-y-inline">
            <span className="text-base font-medium text-fg">{title}</span>
            {badges}
          </span>
          {meta ? <span className="mt-inline block text-sm leading-relaxed text-muted">{meta}</span> : null}
          {aside ? <span className="mt-inline block text-sm text-muted sm:hidden">{aside}</span> : null}
        </span>
        {columns ? <span className="hidden shrink-0 items-center gap-section md:flex">{columns}</span> : null}
        {aside ? <span className="hidden max-w-[40%] shrink-0 text-right text-sm text-muted sm:block">{aside}</span> : null}
        {trailing > 0 ? null : <ChevronRight size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />}
      </Link>
      {/* Centred with inset-y-0 and flex, not top-1/2 and a translate. A
          transform makes a stacking context, which trapped an open row menu's
          z-index inside this box — so every later row, painted after it, drew
          its text and its own "···" straight through the menu. */}
      {trailing > 0 ? (
        <div className="absolute inset-y-0 right-card flex items-center gap-tight">
          {control}
          {menu}
        </div>
      ) : null}
    </li>
  );
}

/**
 * The create action of a settings list that has no tabs or filters to carry it.
 *
 * A list page has no header row for its button, so a list with nothing else on
 * its first toolbar puts it where the list begins — the first row of the card
 * (`header`), or the last tile after the cards (`tile`) — instead of on a
 * strip of its own that holds nothing but one button. A phone has the bar's
 * plus, so this draws nothing there.
 */
export function ListAddRow({ label, onClick, variant = "header" }: { label: string; onClick: () => void; variant?: "header" | "tile" }) {
  const wide = useMediaQuery(MD);
  if (!wide) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-comfortable text-left text-base font-medium text-brand-foreground transition-colors duration-quick hover:bg-muted-wash",
        variant === "header"
          ? "border-b border-hairline px-card py-comfortable"
          : "justify-center rounded-card border border-dashed border-strong px-card py-section",
      )}
    >
      <Plus size={16} strokeWidth={1.75} aria-hidden />
      {label}
    </button>
  );
}

/** Search inside a settings collection — offered only where a list is long.
 *  The shared `AffixInput` with a search glyph as its prefix. */
export function SearchField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  placeholder?: string;
}) {
  return (
    <AffixInput
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      placeholder={placeholder}
      prefix={<Search size={16} strokeWidth={1.5} aria-hidden />}
      className="sm:w-72"
    />
  );
}

/**
 * The foot of a "new" page: what happens, Cancel, and the one verb.
 *
 * A save bar that appears on change suits a record that exists. A record that
 * does not exist yet has nothing to discard back to, so this bar is always
 * there, and its button names the act — Send invite, Create role — rather than
 * a generic Save.
 */
export function CreateBar({
  dirty,
  invalid,
  saving,
  note,
  invalidNote,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  dirty: boolean;
  invalid: boolean;
  saving: boolean;
  note: string;
  invalidNote: string;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("settings");
  useUnsavedGuard(dirty);
  return (
    <div className="sticky bottom-section z-10 max-md:bottom-[calc(56px+env(safe-area-inset-bottom)+12px)]">
      <div className="flex flex-wrap items-center justify-between gap-tight rounded-card border border-line bg-card px-section py-tight shadow-float">
        <p className="min-w-0 text-sm text-muted">{invalid ? invalidNote : note}</p>
        <div className="flex shrink-0 gap-tight">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            {t("save.cancel")}
          </Button>
          <Button onClick={onSubmit} loading={saving} disabled={invalid}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SectionSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-section">
      {[0, 1].map((i) => (
        <div key={i} className="card-surface p-card">
          <Skeleton h={16} w={160} />
          <Skeleton h={12} w={288} className="mt-inline max-w-full" />
          <Skeleton h={44} className="mt-major" />
          <Skeleton h={44} className="mt-tight" />
        </div>
      ))}
    </div>
  );
}
