"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, FormField } from "@/components/ui";
import { cn } from "@/lib/cn";
import { createInventoryItem, updateInventoryItem, type InventoryItem, type Location } from "@/lib/api";

/* The same two lines the catalogue's forms carry. A shared helper would be
   better and is a sweep of its own — three files already declare these. */
const majorToMinor = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
const minorToMajor = (n: number) => (n / 100).toFixed(2).replace(/\.00$/, "");

/**
 * What an item IS — as opposed to how many of it there are, which is the
 * ledger's business and is never edited here.
 *
 * That separation is the whole reason this form is short. A stock field on an
 * edit form is an invitation to fix a count by typing over it, which loses the
 * reason and leaves the ledger disagreeing with itself. Receiving, counting
 * and writing off are actions with their own dialog; this form is the label on
 * the shelf.
 */
export function ItemForm({
  item,
  locations,
  onSaved,
}: {
  /** Absent when this is a new item. */
  item?: InventoryItem;
  locations: Location[];
  onSaved: (id: string) => void;
}) {
  const t = useTranslations("inventory");
  const router = useRouter();
  const [name, setName] = useState(item?.name ?? "");
  const [sku, setSku] = useState(item?.sku ?? "");
  const [kind, setKind] = useState(item?.kind ?? "merch");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [price, setPrice] = useState(item ? minorToMajor(item.price) : "");
  const [cost, setCost] = useState(item?.cost ? minorToMajor(item.cost) : "");
  const [taxClass, setTaxClass] = useState(item?.taxClass ?? "standard");
  const [tracked, setTracked] = useState(item?.tracked ?? true);
  const [returnable, setReturnable] = useState(item?.returnable ?? false);
  const [lowAt, setLowAt] = useState(String(item?.lowAt ?? 5));
  const [where, setWhere] = useState<string[]>(item?.locationIds ?? locations.slice(0, 1).map((l) => l.id));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  /* The unit is what makes a count mean anything — "3" of what? — so the
     field offers the words a venue actually uses rather than leaving it blank
     and hoping. Typing over them is the point; these are a head start. */
  const UNITS = ["each", "pair", "set", "bottle", "box", "hour"];

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const payload = {
      name: name.trim(),
      sku: sku.trim() || undefined,
      kind,
      unit: unit.trim(),
      price: majorToMinor(price || "0"),
      cost: cost.trim() ? majorToMinor(cost) : undefined,
      taxClass,
      tracked,
      returnable,
      lowAt: parseInt(lowAt, 10) || 0,
      locationIds: where,
      status: item?.status ?? ("active" as const),
    };
    const res = item ? await updateInventoryItem(item.id, payload) : await createInventoryItem(payload);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.error.fieldErrors ?? { name: res.error.message });
      return;
    }
    onSaved(res.data.id);
  };

  return (
    <div className="flex flex-col gap-section">
      <section className="card-surface flex flex-col gap-section p-card">
        <h2 className="text-base font-semibold tracking-[-0.4px]">{t("form.what")}</h2>
        <div className="grid gap-section sm:grid-cols-2">
          <FormField label={t("form.name")} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder={t("form.namePlaceholder")} />
          <FormField label={t("form.sku")} value={sku} onChange={(e) => setSku(e.target.value)} help={t("form.skuHelp")} />
        </div>
        <div className="grid gap-section sm:grid-cols-2">
          <label className="flex flex-col gap-inline">
            <span className="type-label text-[12px] text-muted">{t("form.kind")}</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="h-11 rounded-sm border border-line bg-card px-comfortable text-[13px] outline-none focus:border-inverse md:h-9"
            >
              {(["merch", "food", "equipment", "service"] as const).map((k) => (
                <option key={k} value={k}>
                  {t(`kind.${k}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-inline">
            <FormField label={t("form.unit")} value={unit} onChange={(e) => setUnit(e.target.value)} error={errors.unit} placeholder={t("form.unitPlaceholder")} />
            <div className="flex flex-wrap gap-inline">
              {UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={cn(
                    "min-h-9 rounded-full border px-comfortable text-[12px] transition-colors duration-quick",
                    unit === u ? "border-inverse bg-inverse text-inverse-fg" : "border-line text-muted hover:border-strong hover:text-fg",
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card-surface flex flex-col gap-section p-card">
        <h2 className="text-base font-semibold tracking-[-0.4px]">{t("form.money")}</h2>
        <div className="grid gap-section sm:grid-cols-3">
          <FormField label={t("form.price")} variant="number" value={price} onChange={(e) => setPrice(e.target.value)} error={errors.price} help={t("form.priceHelp")} />
          <FormField label={t("form.cost")} variant="number" value={cost} onChange={(e) => setCost(e.target.value)} error={errors.cost} help={t("form.costHelp")} />
          <label className="flex flex-col gap-inline">
            <span className="type-label text-[12px] text-muted">{t("form.tax")}</span>
            <select
              value={taxClass}
              onChange={(e) => setTaxClass(e.target.value as typeof taxClass)}
              className="h-11 rounded-sm border border-line bg-card px-comfortable text-[13px] outline-none focus:border-inverse md:h-9"
            >
              {(["standard", "reduced", "exempt"] as const).map((k) => (
                <option key={k} value={k}>
                  {t(`tax.${k}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="card-surface flex flex-col gap-section p-card">
        <h2 className="text-base font-semibold tracking-[-0.4px]">{t("form.counting")}</h2>
        <label className="flex items-start gap-tight">
          <input type="checkbox" checked={tracked} onChange={(e) => setTracked(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-ember-solid)]" />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium">{t("form.tracked")}</span>
            <span className="block text-[12px] text-muted">{t("form.trackedHelp")}</span>
          </span>
        </label>
        <label className="flex items-start gap-tight">
          <input type="checkbox" checked={returnable} onChange={(e) => setReturnable(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-ember-solid)]" />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium">{t("form.returnable")}</span>
            <span className="block text-[12px] text-muted">{t("form.returnableHelp")}</span>
          </span>
        </label>
        {tracked && (
          <FormField
            label={t("form.lowAt", { unit: unit || t("form.unitFallback") })}
            variant="number"
            value={lowAt}
            onChange={(e) => setLowAt(e.target.value)}
            error={errors.lowAt}
            help={t("form.lowAtHelp")}
          />
        )}
      </section>

      <section className="card-surface flex flex-col gap-section p-card">
        <h2 className="text-base font-semibold tracking-[-0.4px]">{t("form.where")}</h2>
        <p className="-mt-tight text-[13px] text-muted">{t("form.whereHelp")}</p>
        <fieldset className="flex flex-col gap-tight">
          <legend className="sr-only">{t("form.where")}</legend>
          {locations.map((l) => (
            <label key={l.id} className="flex min-h-11 items-center gap-tight md:min-h-9">
              <input
                type="checkbox"
                checked={where.includes(l.id)}
                onChange={(e) => setWhere(e.target.checked ? [...where, l.id] : where.filter((x) => x !== l.id))}
                className="h-5 w-5 shrink-0 accent-[var(--color-ember-solid)]"
              />
              <span className="text-[13px]">{l.name}</span>
            </label>
          ))}
        </fieldset>
        {errors.locationIds && <p className="text-[13px] text-danger">{errors.locationIds}</p>}
      </section>

      <div className="flex flex-wrap items-center gap-tight">
        <Button loading={busy} onClick={() => void save()}>
          {t(item ? "form.save" : "form.create")}
        </Button>
        <Button variant="secondary" onClick={() => router.push("/inventory")}>
          {t("form.cancel")}
        </Button>
      </div>
    </div>
  );
}
