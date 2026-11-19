"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { StatusPill } from "@/components/ui";
import type { CatalogFieldChange, CatalogValue } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { STATE_TONE } from "../record/RecordFrame";

/** Lower-case the first letter, for a field label that sits inside a sentence. */
export const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/**
 * Words and formats for the typed values a change carries. One hook so the diff
 * rows and the Undo preview speak identically: money as money, hours as hours,
 * a status as the pill the catalog list draws, never a raw enum.
 */
export function useHistoryWords(currency: string) {
  const t = useTranslations("catalog.history");
  const tc = useTranslations("catalog");
  const tm = useTranslations("moneysetup");

  const has = (k: string) => (t as unknown as { has: (key: string) => boolean }).has(k);

  /** "Foreigners · Price", "Cancellation window". Never an id. */
  const fieldLabel = (c: CatalogFieldChange): string => {
    const base = has(`field.${c.field}`) ? t(`field.${c.field}` as never) : c.field;
    return c.subject ? `${c.subject.name} · ${base}` : base;
  };

  const unit = (n: number, u: string | undefined): string => (u ? (t as (k: string, v: { count: number }) => string)(`val.unit.${u}`, { count: n }) : String(n));

  /** The plain-text form of a value. A status and a long text are drawn by
   *  `Value`, which falls back to this for the rest. */
  const text = (v: CatalogValue, c: CatalogFieldChange): string => {
    if (v === null) return t("val.none");
    switch (v.type) {
      case "text":
        return c.field === "policies.cancellation" && has(`val.cancellation.${v.value}`) ? t(`val.cancellation.${v.value}` as never) : v.value;
      case "longText":
        return v.value;
      case "money":
        return formatMoney(v.value, currency);
      case "number":
        return c.field === "photos" ? t("val.unit.photos", { count: v.value }) : unit(v.value, v.unit);
      case "bool":
        return c.field === "tier.onSale" ? t(v.value ? "val.onSale" : "val.offSale") : c.field === "policies.waiver" ? t(v.value ? "val.required" : "val.notRequired") : t(v.value ? "val.yes" : "val.no");
      case "status":
        return tc(`state.${v.value === "active" ? "onSale" : v.value === "archived" ? "archived" : "offSale"}`);
      case "list": {
        if (v.value.length === 0) return t("val.none");
        return v.value.map((x) => (c.field === "channels" && has(`val.channel.${x}`) ? t(`val.channel.${x}` as never) : x)).join(", ");
      }
      case "payNow": {
        if (!v.value) return t("val.payNowDefault");
        const option = tm(`payNow.options.${v.value.options}.title` as never);
        if (v.value.options === "full") return option;
        const min = v.value.minKind === "percent" ? `${v.value.minValue}%` : formatMoney(v.value.minValue, currency);
        return t("val.payNowMin", { option, min });
      }
    }
  };

  return { fieldLabel, text };
}

/** A signed money difference: "+৳50", "−৳100". Null when it is not money. */
export function moneyDelta(c: CatalogFieldChange, currency: string): string | null {
  if (c.before?.type !== "money" || c.after?.type !== "money") return null;
  const d = c.after.value - c.before.value;
  if (d === 0) return null;
  return `${d > 0 ? "+" : "−"}${formatMoney(Math.abs(d), currency)}`;
}

/** One value, in its own form. A status is the catalog's pill. */
export function Value({ v, c, currency, strong, className }: { v: CatalogValue; c: CatalogFieldChange; currency: string; strong?: boolean; className?: string }) {
  const tc = useTranslations("catalog");
  const { text } = useHistoryWords(currency);
  if (v?.type === "status") {
    const state = v.value === "active" ? "onSale" : v.value === "archived" ? "archived" : "offSale";
    return (
      <StatusPill tone={STATE_TONE[state]} shape={state === "onSale" ? "transaction" : "record"}>
        {tc(`state.${state}`)}
      </StatusPill>
    );
  }
  return <span className={cn("min-w-0 break-words", strong ? "font-medium text-fg" : "text-muted", className)}>{text(v, c)}</span>;
}

/** `before → after` for one change. Before is muted, after is full ink, and
 *  between them an arrow (never a strikethrough: the old value was not wrong).
 *  Long text clamps to two lines with a toggle shared by both sides. */
export function Change({ c, currency }: { c: CatalogFieldChange; currency: string }) {
  const t = useTranslations("catalog.history");
  const { text } = useHistoryWords(currency);
  const [full, setFull] = useState(false);
  const delta = moneyDelta(c, currency);

  if (c.field === "tier.added") return <Value v={c.after} c={c} currency={currency} strong />;
  if (c.field === "tier.removed") return <Value v={c.before} c={c} currency={currency} />;

  /* Long text sits on the same row as everything else (before → after),
     each side clamped to one line until "Show full text". Stacked, a one-word
     edit to a description took five lines. */
  const long = c.before?.type === "longText" || c.after?.type === "longText";
  if (long) {
    const clamp = full ? "" : "line-clamp-1";
    const overflowing = (c.before?.type === "longText" && c.before.value.length > 60) || (c.after?.type === "longText" && c.after.value.length > 60);
    return (
      <span className="flex min-w-0 flex-col items-start gap-0.5 text-sm">
        <span className="flex min-w-0 max-w-full flex-wrap items-baseline gap-x-tight">
          <span className={cn("min-w-0 max-w-full text-muted", clamp)}>{text(c.before, c)}</span>
          <ArrowRight aria-hidden size={14} strokeWidth={1.5} className="shrink-0 self-center text-muted" />
          <span className={cn("min-w-0 max-w-full font-medium text-fg", clamp)}>{text(c.after, c)}</span>
        </span>
        {overflowing && (
          <button type="button" aria-expanded={full} onClick={() => setFull((x) => !x)} className="-my-tight py-tight text-xs font-medium text-brand-foreground hover:underline">
            {full ? t("showLess") : t("showFull")}
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-tight gap-y-inline text-sm">
      <Value v={c.before} c={c} currency={currency} />
      <ArrowRight aria-hidden size={14} strokeWidth={1.5} className="shrink-0 text-muted" />
      <Value v={c.after} c={c} currency={currency} strong />
      {delta && <span className="shrink-0 rounded-full bg-subtle px-tight py-px text-xs font-medium text-fg-secondary ring-1 ring-inset ring-line">{delta}</span>}
    </span>
  );
}
