"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, FormField } from "@/components/ui";

export interface FormAddOn {
  id?: string;
  name: string;
  price: string; // major
  perPerson: boolean;
}

export const emptyAddOn = (): FormAddOn => ({ name: "", price: "", perPerson: false });

export function AddOnsField({
  addOns,
  onChange,
  currency = "BDT",
}: {
  addOns: FormAddOn[];
  onChange: (a: FormAddOn[]) => void;
  currency?: string;
}) {
  const update = (i: number, patch: Partial<FormAddOn>) => onChange(addOns.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  return (
    <div className="flex flex-col gap-tight">
      <div className="flex items-center justify-between">
        <span className="type-label text-[12px] text-muted">Add-ons</span>
        <Button size="sm" variant="secondary" icon={<Plus size={14} strokeWidth={1.5} />} onClick={() => onChange([...addOns, emptyAddOn()])}>Add extra</Button>
      </div>
      <p className="text-[12px] text-faint">Extras offered at the counter — shoe hire, bibs, oils.</p>
      {addOns.map((a, i) => (
        <div key={i} className="grid grid-cols-1 items-end gap-tight rounded-sm border border-line p-comfortable sm:grid-cols-[1fr_8rem_auto_auto]">
          <FormField label={i === 0 ? "Name" : undefined} placeholder="Shoe hire" value={a.name} onChange={(e) => update(i, { name: e.target.value })} />
          <FormField label={i === 0 ? `Price (${currency})` : undefined} variant="number" value={a.price} onChange={(e) => update(i, { price: e.target.value })} />
          <label className="flex items-center gap-inline pb-tight text-[13px]"><input type="checkbox" checked={a.perPerson} onChange={(e) => update(i, { perPerson: e.target.checked })} className="h-4 w-4 accent-ember" />per person</label>
          <button type="button" aria-label="Remove" onClick={() => onChange(addOns.filter((_, idx) => idx !== i))} className="flex h-9 w-9 items-center justify-center rounded-sm border border-line text-danger"><Trash2 size={16} strokeWidth={1.5} /></button>
        </div>
      ))}
    </div>
  );
}
