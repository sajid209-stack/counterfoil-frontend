"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, FormField } from "@/components/ui";
import { resolveRulePrice } from "@/lib/pricing";
import { formatMoney } from "@/lib/format";
import { DAY_LABELS } from "@/lib/schedule";
import { cn } from "@/lib/cn";

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
const EXAMPLES: [string, number, string][] = [
  ["Tue 07:00", 2, "07:00"],
  ["Wed 19:00", 3, "19:00"],
  ["Sat 20:00", 6, "20:00"],
  ["Sun 14:00", 0, "14:00"],
];

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
  const ticks = Array.from({ length: 5 }, (_, i) => openMin + (span * i) / 4);
  const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-section">
      <div className="flex items-center justify-between">
        <span className="type-label text-[12px] text-muted">Prices by time of day</span>
        <Button size="sm" variant="secondary" icon={<Plus size={14} strokeWidth={1.5} />} onClick={add}>Add band</Button>
      </div>
      <p className="-mt-tight text-[12px] text-faint">The base price applies all day. Add a band to charge differently at certain times — the first band that matches wins.</p>

      {/* Visual day timeline */}
      <div className="card-surface p-comfortable">
        <div className="relative h-14 overflow-hidden rounded-xs bg-subtle">
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-[11px] text-muted">
            Base · {base > 0 ? formatMoney(base, currency) : "—"}
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
                className={cn(
                  "absolute inset-y-0 flex flex-col items-center justify-center overflow-hidden rounded-xs bg-ember/85 px-inline text-center text-paper transition-transform duration-quick active:scale-[0.98]",
                  sel === i && "ring-2 ring-inverse",
                )}
              >
                <span className="truncate font-mono text-[11px] font-medium">{r.price ? formatMoney(toMinor(r.price), currency) : "—"}</span>
                <span className="truncate text-[9px] opacity-80">{r.fromTime}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-inline flex justify-between font-mono text-[10px] text-faint">
          {ticks.map((m, i) => <span key={i}>{fmtMin(m)}</span>)}
        </div>
      </div>

      {/* Band editors — the selected band is highlighted; tap a band above to jump to it. */}
      {rules.length === 0 ? (
        <p className="rounded-sm border border-dashed border-line px-comfortable py-section text-center text-[13px] text-faint">No time bands yet — everything sells at the base price. Add a band for evenings, weekends, peak hours…</p>
      ) : (
        rules.map((rule, i) => (
          <div
            key={i}
            onClick={() => setSel(i)}
            className={cn("flex flex-col gap-tight rounded-sm border p-comfortable transition-colors duration-quick", sel === i ? "border-ember bg-ember/5" : "border-line")}
          >
            <div className="flex flex-wrap gap-inline">
              {DAY_LABELS.map((label, d) => (
                <button key={d} type="button" onClick={(e) => { e.stopPropagation(); toggleDay(i, d); }} className={cn("h-8 w-8 rounded-xs border text-[11px]", rule.days.includes(d) ? "border-inverse bg-inverse text-inverse-fg" : "border-line text-muted")}>{label}</button>
              ))}
              <span className="ml-inline self-center text-[11px] text-faint">{rule.days.length ? "" : "any day"}</span>
            </div>
            <div className="flex flex-wrap items-end gap-tight">
              <FormField label="From" value={rule.fromTime} onChange={(e) => update(i, { fromTime: e.target.value })} />
              <FormField label="To" value={rule.toTime} onChange={(e) => update(i, { toTime: e.target.value })} />
              <FormField label={`Price (${currency})`} variant="number" value={rule.price} onChange={(e) => update(i, { price: e.target.value })} />
              <div className="flex items-center gap-inline pb-inline">
                <button type="button" aria-label="Earlier in order" onClick={(e) => { e.stopPropagation(); move(i, -1); }} disabled={i === 0} className="flex h-9 w-9 items-center justify-center rounded-sm border border-line disabled:text-faint"><ChevronUp size={16} strokeWidth={1.5} /></button>
                <button type="button" aria-label="Later in order" onClick={(e) => { e.stopPropagation(); move(i, 1); }} disabled={i === rules.length - 1} className="flex h-9 w-9 items-center justify-center rounded-sm border border-line disabled:text-faint"><ChevronDown size={16} strokeWidth={1.5} /></button>
                <button type="button" aria-label="Remove band" onClick={(e) => { e.stopPropagation(); remove(i); }} className="flex h-9 w-9 items-center justify-center rounded-sm border border-line text-danger"><Trash2 size={16} strokeWidth={1.5} /></button>
              </div>
            </div>
          </div>
        ))
      )}

      {(rules.length > 0 || base > 0) && (
        <div className="rounded-sm border border-inverse bg-card p-section">
          <p className="type-label text-[11px] text-faint">Preview</p>
          <p className="mt-inline flex flex-wrap gap-section font-mono text-[12px]">
            {EXAMPLES.map(([label, dow, time]) => (
              <span key={label}>{label} → <span className="font-medium">{formatMoney(resolveRulePrice(rulesMinor, dow, time, base), currency)}</span></span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}
