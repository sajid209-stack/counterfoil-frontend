"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button, FormField } from "@/components/ui";
import { resolveRulePrice } from "@/lib/pricing";
import { formatMoney } from "@/lib/format";
import { DAY_LABELS } from "@/lib/schedule";

export interface FormPricingRule {
  id?: string;
  days: number[];
  fromTime: string;
  toTime: string;
  price: string; // major units
}

export const emptyPricingRule = (): FormPricingRule => ({ days: [], fromTime: "18:00", toTime: "23:00", price: "" });

const toMinor = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? Math.round(n * 100) : 0; };

// Four concrete preview examples — the operator checks these before saving.
const EXAMPLES: [string, number, string][] = [
  ["Tue 07:00", 2, "07:00"],
  ["Wed 19:00", 3, "19:00"],
  ["Sat 20:00", 6, "20:00"],
  ["Sun 14:00", 0, "14:00"],
];

export function PricingRulesField({
  rules,
  onChange,
  currency = "BDT",
  basePriceMajor,
}: {
  rules: FormPricingRule[];
  onChange: (rules: FormPricingRule[]) => void;
  currency?: string;
  basePriceMajor: string;
}) {
  const update = (i: number, patch: Partial<FormPricingRule>) => onChange(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = () => onChange([...rules, emptyPricingRule()]);
  const remove = (i: number) => onChange(rules.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rules.length) return;
    const next = rules.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const toggleDay = (i: number, d: number) => {
    const days = rules[i].days.includes(d) ? rules[i].days.filter((x) => x !== d) : [...rules[i].days, d].sort();
    update(i, { days });
  };

  const base = toMinor(basePriceMajor);
  const rulesMinor = rules.map((r) => ({ id: "", days: r.days, fromTime: r.fromTime, toTime: r.toTime, price: toMinor(r.price) }));

  return (
    <div className="flex flex-col gap-tight">
      <div className="flex items-center justify-between">
        <span className="type-label text-[12px] text-muted">Pricing rules</span>
        <Button size="sm" variant="secondary" icon={<Plus size={14} strokeWidth={1.5} />} onClick={add}>Add rule</Button>
      </div>
      <p className="text-[12px] text-faint">Checked top to bottom — the first match sets the price. Base applies when nothing matches.</p>

      {rules.map((rule, i) => (
        <div key={i} className="flex flex-col gap-tight rounded-sm border border-line p-comfortable">
          <div className="flex gap-inline">
            {DAY_LABELS.map((label, d) => (
              <button key={d} type="button" onClick={() => toggleDay(i, d)} className={`h-8 w-8 rounded-xs border text-[11px] ${rule.days.includes(d) ? "border-inverse bg-inverse text-inverse-fg" : "border-line text-muted"}`}>{label}</button>
            ))}
            <span className="ml-inline self-center text-[11px] text-faint">{rule.days.length ? "" : "any day"}</span>
          </div>
          <div className="flex flex-wrap items-end gap-tight">
            <FormField label="From" value={rule.fromTime} onChange={(e) => update(i, { fromTime: e.target.value })} />
            <FormField label="To" value={rule.toTime} onChange={(e) => update(i, { toTime: e.target.value })} />
            <FormField label={`Price (${currency})`} variant="number" value={rule.price} onChange={(e) => update(i, { price: e.target.value })} />
            <div className="flex items-center gap-inline pb-inline">
              <button type="button" aria-label="Up" onClick={() => move(i, -1)} disabled={i === 0} className="flex h-9 w-9 items-center justify-center rounded-sm border border-line disabled:text-faint"><ChevronUp size={16} strokeWidth={1.5} /></button>
              <button type="button" aria-label="Down" onClick={() => move(i, 1)} disabled={i === rules.length - 1} className="flex h-9 w-9 items-center justify-center rounded-sm border border-line disabled:text-faint"><ChevronDown size={16} strokeWidth={1.5} /></button>
              <button type="button" aria-label="Remove" onClick={() => remove(i)} className="flex h-9 w-9 items-center justify-center rounded-sm border border-line text-danger"><Trash2 size={16} strokeWidth={1.5} /></button>
            </div>
          </div>
        </div>
      ))}

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
