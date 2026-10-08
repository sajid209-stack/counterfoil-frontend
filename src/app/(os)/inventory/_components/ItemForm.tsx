"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import { createInventoryItem, updateInventoryItem, type InventoryItem, type Location } from "@/lib/api";
import {
  CreateBar,
  SaveBar,
  SettingRow,
  SettingsSection,
  Switch,
  controlCls,
} from "@/app/(os)/settings/_components/SettingsKit";

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
 *
 * It is drawn in the settings anatomy — a titled card of label-left,
 * control-right rows, and a save bar that exists only while something has
 * changed — because it is the same kind of screen: a record's own properties.
 * A new item gets the create bar instead, which is always there and names the
 * act.
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

  const start = {
    name: item?.name ?? "",
    sku: item?.sku ?? "",
    kind: item?.kind ?? "merch",
    unit: item?.unit ?? "",
    price: item ? minorToMajor(item.price) : "",
    cost: item?.cost ? minorToMajor(item.cost) : "",
    taxClass: item?.taxClass ?? "standard",
    tracked: item?.tracked ?? true,
    returnable: item?.returnable ?? false,
    /* Defaults follow the kind rather than asking a question the operator
       usually has no opinion about: merch and drinks are walked up to and
       bought, equipment goes out with a booking. */
    atCounter: item?.atCounter ?? true,
    lowAt: String(item?.lowAt ?? 5),
    where: item?.locationIds ?? locations.slice(0, 1).map((l) => l.id),
  };
  const [name, setName] = useState(start.name);
  const [sku, setSku] = useState(start.sku);
  const [kind, setKind] = useState(start.kind);
  const [unit, setUnit] = useState(start.unit);
  const [price, setPrice] = useState(start.price);
  const [cost, setCost] = useState(start.cost);
  const [taxClass, setTaxClass] = useState(start.taxClass);
  const [tracked, setTracked] = useState(start.tracked);
  const [returnable, setReturnable] = useState(start.returnable);
  const [atCounter, setAtCounter] = useState(start.atCounter);
  const [lowAt, setLowAt] = useState(start.lowAt);
  const [where, setWhere] = useState<string[]>(start.where);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const dirty =
    JSON.stringify({ name, sku, kind, unit, price, cost, taxClass, tracked, returnable, atCounter, lowAt, where: [...where].sort() }) !==
    JSON.stringify({ ...start, where: [...start.where].sort() });
  const discard = () => {
    setName(start.name);
    setSku(start.sku);
    setKind(start.kind);
    setUnit(start.unit);
    setPrice(start.price);
    setCost(start.cost);
    setTaxClass(start.taxClass);
    setTracked(start.tracked);
    setReturnable(start.returnable);
    setAtCounter(start.atCounter);
    setLowAt(start.lowAt);
    setWhere(start.where);
    setErrors({});
  };

  /* The unit is what makes a count mean anything — "3" of what? — so the
     field offers the words a venue actually uses rather than leaving it blank
     and hoping. Typing over them is the point; these are a head start. They
     come from the messages, so a Bangla screen offers Bangla words: the unit
     is written onto the item and read back in every count. */
  const UNITS = (["each", "pair", "set", "bottle", "box", "hour"] as const).map((k) => t(`form.units.${k}`));

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
      atCounter,
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

  const text = (
    id: string,
    value: string,
    set: (v: string) => void,
    invalid: boolean,
    describedBy?: string,
    extra?: { placeholder?: string; inputMode?: "decimal" | "numeric" },
  ) => (
    <input
      id={id}
      value={value}
      onChange={(e) => set(e.target.value)}
      placeholder={extra?.placeholder}
      inputMode={extra?.inputMode}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={controlCls(invalid)}
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-section">
      <SettingsSection title={t("form.what")}>
        <SettingRow label={t("form.name")} error={errors.name}>
          {({ id, describedBy }) => text(id, name, setName, !!errors.name, describedBy, { placeholder: t("form.namePlaceholder") })}
        </SettingRow>
        <SettingRow label={t("form.sku")} description={t("form.skuHelp")}>
          {({ id, describedBy }) => text(id, sku, setSku, false, describedBy)}
        </SettingRow>
        <SettingRow label={t("form.kind")} labelFor={false}>
          {({ labelId }) => (
            <Select
              value={kind}
              onChange={(v) => {
                const next = v as typeof kind;
                setKind(next);
                if (!item) setAtCounter(next === "merch" || next === "food");
              }}
              aria-labelledby={labelId}
              options={(["merch", "food", "equipment", "service"] as const).map((k) => ({ value: k, label: t(`kind.${k}`) }))}
            />
          )}
        </SettingRow>
        <SettingRow label={t("form.unit")} error={errors.unit}>
          {({ id, describedBy }) => (
            <div className="flex flex-col gap-tight">
              {text(id, unit, setUnit, !!errors.unit, describedBy, { placeholder: t("form.unitPlaceholder") })}
              <div className="flex flex-wrap gap-inline">
                {UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={cn(
                      "min-h-11 rounded-full px-comfortable text-[0.8125rem] transition-colors duration-quick md:min-h-8",
                      unit === u ? "bg-inverse font-medium text-inverse-fg" : "bg-muted-wash text-fg hover:bg-line",
                    )}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          )}
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t("form.money")}>
        <SettingRow label={t("form.price")} description={t("form.priceHelp")} error={errors.price}>
          {({ id, describedBy }) => text(id, price, setPrice, !!errors.price, describedBy, { inputMode: "decimal" })}
        </SettingRow>
        <SettingRow label={t("form.cost")} description={t("form.costHelp")} error={errors.cost}>
          {({ id, describedBy }) => text(id, cost, setCost, !!errors.cost, describedBy, { inputMode: "decimal" })}
        </SettingRow>
        <SettingRow label={t("form.tax")} labelFor={false}>
          {({ labelId }) => (
            <Select
              value={taxClass}
              onChange={(v) => setTaxClass(v as typeof taxClass)}
              aria-labelledby={labelId}
              options={(["standard", "reduced", "exempt"] as const).map((k) => ({ value: k, label: t(`tax.${k}`) }))}
            />
          )}
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t("form.counting")} divided>
        <SettingRow label={t("form.tracked")} description={t("form.trackedHelp")} labelFor={false} trailing>
          {({ labelId, describedBy }) => <Switch checked={tracked} onChange={setTracked} labelledBy={labelId} describedBy={describedBy} />}
        </SettingRow>
        <SettingRow label={t("form.atCounter")} description={t("form.atCounterHelp")} labelFor={false} trailing>
          {({ labelId, describedBy }) => <Switch checked={atCounter} onChange={setAtCounter} labelledBy={labelId} describedBy={describedBy} />}
        </SettingRow>
        <SettingRow label={t("form.returnable")} description={t("form.returnableHelp")} labelFor={false} trailing>
          {({ labelId, describedBy }) => <Switch checked={returnable} onChange={setReturnable} labelledBy={labelId} describedBy={describedBy} />}
        </SettingRow>
        {tracked && (
          <SettingRow label={t("form.lowAt", { unit: unit || t("form.unitFallback") })} description={t("form.lowAtHelp")} error={errors.lowAt}>
            {({ id, describedBy }) => text(id, lowAt, setLowAt, !!errors.lowAt, describedBy, { inputMode: "numeric" })}
          </SettingRow>
        )}
      </SettingsSection>

      <SettingsSection title={t("form.where")} description={t("form.whereHelp")} divided>
        {locations.map((l) => (
          <SettingRow key={l.id} label={l.name} labelFor={false} trailing>
            {({ labelId }) => (
              <Switch
                checked={where.includes(l.id)}
                onChange={(on) => setWhere(on ? [...where, l.id] : where.filter((x) => x !== l.id))}
                labelledBy={labelId}
              />
            )}
          </SettingRow>
        ))}
        {errors.locationIds && <p className="px-card pb-section text-[0.8125rem] text-danger">{errors.locationIds}</p>}
      </SettingsSection>

      {item ? (
        <SaveBar dirty={dirty} saving={busy} onSave={() => void save()} onDiscard={discard} />
      ) : (
        <CreateBar
          dirty={dirty}
          invalid={false}
          saving={busy}
          note={t("form.createNote")}
          invalidNote=""
          submitLabel={t("form.create")}
          onSubmit={() => void save()}
          onCancel={() => router.push("/inventory")}
        />
      )}
    </div>
  );
}
