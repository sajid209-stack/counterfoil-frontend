"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button, FormField } from "@/components/ui";

export interface FormTier {
  id?: string;
  name: string;
  price: string; // major units as typed, e.g. "30.00"
  maxPerOrder: string;
  admits: string; // people this ticket admits (default 1)
  ageNote: string; // e.g. "5–12" — printed on the ticket
  active: boolean;
}

export const emptyTier = (): FormTier => ({
  name: "",
  price: "",
  maxPerOrder: "",
  admits: "1",
  ageNote: "",
  active: true,
});

export function PriceTiersField({
  tiers,
  onChange,
  errors,
  currency = "BDT",
}: {
  tiers: FormTier[];
  onChange: (tiers: FormTier[]) => void;
  errors: Record<string, string>;
  currency?: string;
}) {
  const update = (i: number, patch: Partial<FormTier>) =>
    onChange(tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const add = () => onChange([...tiers, emptyTier()]);
  const remove = (i: number) => onChange(tiers.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= tiers.length) return;
    const next = tiers.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-tight">
      <div className="flex items-center justify-between">
        <span className="type-label text-[12px] text-muted">Price tiers</span>
        <Button size="sm" variant="secondary" icon={<Plus size={14} strokeWidth={1.5} />} onClick={add}>
          Add tier
        </Button>
      </div>

      {errors.tiers && <p className="text-[12px] text-danger">{errors.tiers}</p>}

      {tiers.length === 0 && (
        <p className="rounded-sm border border-dashed border-line px-comfortable py-comfortable text-[13px] text-faint">
          No tiers yet. Add at least one (e.g. Adult, Child).
        </p>
      )}

      {tiers.map((tier, i) => (
        <div
          key={i}
          className="grid grid-cols-1 items-start gap-tight rounded-sm border border-line p-comfortable sm:grid-cols-[1fr_7rem_4.5rem_5.5rem_auto]"
        >
          <FormField
            label={i === 0 ? "Name" : undefined}
            placeholder="Adult"
            value={tier.name}
            onChange={(e) => update(i, { name: e.target.value })}
            error={errors[`tiers.${i}.name`]}
          />
          <FormField
            label={i === 0 ? `Price (${currency})` : undefined}
            variant="number"
            placeholder="0.00"
            value={tier.price}
            onChange={(e) => update(i, { price: e.target.value })}
            error={errors[`tiers.${i}.price`]}
          />
          <FormField
            label={i === 0 ? "Admits" : undefined}
            variant="number"
            placeholder="1"
            value={tier.admits}
            onChange={(e) => update(i, { admits: e.target.value })}
          />
          <FormField
            label={i === 0 ? "Age note" : undefined}
            placeholder="5–12"
            value={tier.ageNote}
            onChange={(e) => update(i, { ageNote: e.target.value })}
          />
          <div className={i === 0 ? "flex items-center gap-inline pt-6" : "flex items-center gap-inline"}>
            <button
              type="button"
              aria-label="Move up"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="flex h-9 w-9 items-center justify-center rounded-sm border border-line text-fg disabled:text-faint hover:enabled:border-inverse"
            >
              <ChevronUp size={16} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label="Move down"
              onClick={() => move(i, 1)}
              disabled={i === tiers.length - 1}
              className="flex h-9 w-9 items-center justify-center rounded-sm border border-line text-fg disabled:text-faint hover:enabled:border-inverse"
            >
              <ChevronDown size={16} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label="Remove tier"
              onClick={() => remove(i)}
              className="flex h-9 w-9 items-center justify-center rounded-sm border border-line text-danger hover:border-danger"
            >
              <Trash2 size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
