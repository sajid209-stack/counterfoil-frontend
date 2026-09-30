"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, FormField } from "@/components/ui";
import { resolveRulePrice } from "@/lib/pricing";
import { formatPriceShort } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useCatalogFormat } from "../../_lib/useCatalogFormat";

export interface FormPricingRule {
  id?: string;
  days: number[];
  fromTime: string;
  toTime: string;
  price: string; // major units
}

export const emptyPricingRule = (): FormPricingRule => ({ days: [], fromTime: "18:00", toTime: "23:00", price: "" });

const toMinor = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
const hm = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };

// Four concrete preview examples — the operator checks these before saving.
const EXAMPLES: [number, string][] = [
  [2, "07:00"],
  [3, "19:00"],
  [6, "20:00"],
  [0, "14:00"],
];
const WEEK = [0, 1, 2, 3, 4, 5, 6];

// One flow for "different prices at different times": a visual day timeline
// (base track + priced bands) sitting directly above the band editors. The
// timeline shows the day at a glance; tap a band to edit it below.
export function PricingRulesField({
  rules,
  onChange,
  currency = "BDT",
  basePriceMajor,
  dayStart = "08:00",
  dayEnd = "22:00",
}: {
  rules: FormPricingRule[];
  onChange: (rules: FormPricingRule[]) => void;
  currency?: string;
  basePriceMajor: string;
  dayStart?: string;
  dayEnd?: string;
}) {
  const t = useTranslations("catalog.fields");
  const { dayShort, dayLong } = useCatalogFormat();
  const [sel, setSel] = useState<number | null>(null);

  const update = (i: number, patch: Partial<FormPricingRule>) => onChange(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = () => { onChange([...rules, emptyPricingRule()]); setSel(rules.length); };
  const remove = (i: number) => { onChange(rules.filter((_, idx) => idx !== i)); setSel(null); };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rules.length) return;
    const next = rules.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setSel(j);
  };
  const toggleDay = (i: number, d: number) => {
    const days = rules[i].days.includes(d) ? rules[i].days.filter((x) => x !== d) : [...rules[i].days, d].sort();
    update(i, { days });
  };

  const base = toMinor(basePriceMajor);
  const rulesMinor = rules.map((r) => ({ id: "", days: r.days, fromTime: r.fromTime, toTime: r.toTime, price: toMinor(r.price) }));

  // Timeline geometry — clamp everything to the open→close window.
  const openMin = hm(dayStart);
  const span = Math.max(60, hm(dayEnd) - openMin);
  const pct = (t: string) => Math.min(100, Math.max(0, ((hm(t) - openMin) / span) * 100));
  const pctMin = (m: number) => ((m - openMin) / span) * 100;
  /* Ticks on the hour, never on a fraction of the day: a band is set in
     clock times, so the ruler under it has to read in clock times too.
     Quartering the day put ticks at 10:00, 11:45, 13:30 — numbers nobody
     sets a price at. The step widens with the day so the labels never touch. */
  const firstHour = Math.ceil(openMin / 60) * 60;
  const step = span / 60 <= 8 ? 60 : span / 60 <= 16 ? 120 : 180;
  const ticks: number[] = [];
  for (let m = firstHour; m <= openMin + span; m += step) ticks.push(m);
  /* Every other tick and always the last — and when the last is odd, the
     one before it goes so the final two never touch. */
  const phoneTick = (i: number, n: number) => i === n - 1 || (i % 2 === 0 && !(i === n - 2 && (n - 1) % 2 === 1));
  const fmtMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-section">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-semibold tracking-tight">{t("bands")}</span>
        <Button size="sm" variant="secondary" icon={<Plus size={14} strokeWidth={1.5} aria-hidden />} onClick={add}>{t("addBand")}</Button>
      </div>
      <p className="-mt-tight text-[12px] text-muted">{t("bandsHelp")}</p>

      {/* Visual day timeline */}
      <div className="card-surface p-comfortable">
        <div className="relative h-14 overflow-hidden rounded-xs bg-subtle">
          {/* The one empty message: with no time prices the track itself says
              the whole day sells at one price. With no price typed yet it says
              so in words — it used to print a dash where the price goes, which
              read "Same price all day · — —". */}
          <span className="pointer-events-none absolute inset-0 grid place-items-center px-comfortable text-center text-[12px] text-muted">
            {base > 0
              ? t(rules.length === 0 ? "allDay" : "base", { price: formatPriceShort(base, currency) })
              : t(rules.length === 0 ? "allDayEmpty" : "baseEmpty")}
          </span>
          {rules.map((r, i) => {
            const left = pct(r.fromTime);
            const width = pct(r.toTime) - left;
            if (width <= 0) return null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSel(sel === i ? null : i)}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${r.fromTime}–${r.toTime}`}
                aria-label={`${r.fromTime}–${r.toTime} · ${r.price ? formatPriceShort(toMinor(r.price), currency) : t("bandNoPrice")}`}
                aria-pressed={sel === i}
                className={cn(
                  "absolute inset-y-0 flex flex-col items-center justify-center overflow-hidden rounded-xs bg-ember/85 px-inline text-center text-paper transition-transform duration-quick active:scale-[0.98]",
                  sel === i && "ring-2 ring-inverse",
                )}
              >
                <span className="truncate text-[12px] font-medium tabular-nums">{r.price ? formatPriceShort(toMinor(r.price), currency) : t("bandNoPrice")}</span>
                <span className="truncate text-[12px] opacity-80">{r.fromTime}</span>
              </button>
            );
          })}
        </div>
        <div aria-hidden className="relative mt-inline h-4 text-[12px] tabular-nums text-muted">
          {/* On a phone every other hour is dropped, or the labels run into
              each other ("10:0011:00"). The two ends always stay. */}
          {ticks.map((m, i) => (
            <span
              key={m}
              className={cn(
                "absolute top-0 -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full",
                ticks.length > 5 && !phoneTick(i, ticks.length) && "max-sm:hidden",
              )}
              style={{ left: `${pctMin(m)}%` }}
            >
              {fmtMin(m)}
            </span>
          ))}
        </div>
      </div>

      {/* Time price editors — the selected one is highlighted; tap one above to jump to it. */}
      {rules.map((rule, i) => {
        const span = `${rule.fromTime}–${rule.toTime}`;
        return (
          <div
            key={i}
            onClick={() => setSel(i)}
            className={cn("flex flex-col gap-tight rounded-sm border p-comfortable transition-colors duration-quick", sel === i ? "border-ember bg-ember/5" : "border-line")}
          >
            <div className="flex flex-wrap gap-inline">
              {WEEK.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={rule.days.includes(d)}
                  aria-label={dayLong(d)}
                  title={dayLong(d)}
                  onClick={(e) => { e.stopPropagation(); toggleDay(i, d); }}
                  className={cn("h-11 min-w-11 rounded-xs border px-inline text-[12px] md:h-8 md:min-w-10", rule.days.includes(d) ? "border-inverse bg-inverse text-inverse-fg" : "border-line text-muted")}
                >
                  {dayShort(d)}
                </button>
              ))}
              {rule.days.length === 0 && <span className="ml-inline self-center text-[12px] text-muted">{t("anyDay")}</span>}
            </div>
            <div className="flex flex-wrap items-end gap-tight">
              <FormField label={t("from")} value={rule.fromTime} onChange={(e) => update(i, { fromTime: e.target.value })} />
              <FormField label={t("to")} value={rule.toTime} onChange={(e) => update(i, { toTime: e.target.value })} />
              <FormField label={`${t("price")} (${currency === "BDT" ? "৳" : currency})`} variant="number" placeholder={t("bandPricePlaceholder")} value={rule.price} onChange={(e) => update(i, { price: e.target.value })} />
              <div className="flex items-center gap-inline pb-inline">
                <button type="button" aria-label={t("earlier", { time: span })} title={t("earlier", { time: span })} onClick={(e) => { e.stopPropagation(); move(i, -1); }} disabled={i === 0} className="flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-sm border border-line disabled:text-faint"><ChevronUp size={16} strokeWidth={1.5} aria-hidden /></button>
                <button type="button" aria-label={t("later", { time: span })} title={t("later", { time: span })} onClick={(e) => { e.stopPropagation(); move(i, 1); }} disabled={i === rules.length - 1} className="flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-sm border border-line disabled:text-faint"><ChevronDown size={16} strokeWidth={1.5} aria-hidden /></button>
                <button type="button" aria-label={t("removeBand", { time: span })} title={t("removeBand", { time: span })} onClick={(e) => { e.stopPropagation(); remove(i); }} className="flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-sm border border-line text-danger"><Trash2 size={16} strokeWidth={1.5} aria-hidden /></button>
              </div>
            </div>
          </div>
        );
      })}

      {rules.length > 0 && base > 0 && (
        <div className="rounded-sm border border-inverse bg-card p-section">
          <p className="type-label text-[12px] text-muted">{t("preview")}</p>
          <p className="mt-inline flex flex-wrap gap-section text-[13px] tabular-nums">
            {EXAMPLES.map(([dow, time]) => (
              <span key={`${dow}-${time}`}>{dayShort(dow)} {time} → <span className="font-medium">{formatPriceShort(resolveRulePrice(rulesMinor, dow, time, base), currency)}</span></span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}
