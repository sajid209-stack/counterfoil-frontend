"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Boxes, Plus, Tag, Trash2 } from "lucide-react";
import { Button, FormField, Modal, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { formatMoney } from "@/lib/format";
import { listInventory, type InventoryItemView } from "@/lib/api";

export interface FormAddOn {
  id?: string;
  name: string;
  price: string; // major
  perPerson: boolean;
  /** The inventory item this extra hands over, when it is a countable thing. */
  itemId?: string;
}

export const emptyAddOn = (): FormAddOn => ({ name: "", price: "", perPerson: false });

/**
 * What a booking offers alongside itself.
 *
 * Two kinds of extra, and the difference is whether anything leaves a shelf:
 *
 *   **From inventory** — a tote bag, a programme, a set of bibs. The name and
 *   the price come from the item, the till can only sell what is on the shelf,
 *   and the sale moves the count. This is what an extra should almost always
 *   be, so it is the offered path.
 *
 *   **A charge** — gift wrapping, a late fee, a guide's time. Nothing is
 *   counted because there is nothing to count. This is what every add-on was
 *   before inventory existed, and it is still right for these.
 *
 * The price stays editable on a linked extra: the same tote bag can be ৳450 at
 * the desk and included at ৳0 with a membership, and the item's own price is
 * the default rather than the law.
 */
export function AddOnsField({
  addOns,
  onChange,
  currency = "BDT",
  locationIds = [],
}: {
  addOns: FormAddOn[];
  onChange: (a: FormAddOn[]) => void;
  currency?: string;
  /** Where this booking is sold — an item kept nowhere near it is no use. */
  locationIds?: string[];
}) {
  const t = useTranslations("catalog.extras");
  const [picking, setPicking] = useState(false);
  const itemsQ = useApiQuery(() => listInventory({ pageSize: 200 }), []);
  const items = useMemo(() => itemsQ.data?.data ?? [], [itemsQ.data]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const update = (i: number, patch: Partial<FormAddOn>) =>
    onChange(addOns.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  /* Offered first: items kept where this booking is sold. The rest are still
     listed — a venue may be about to move stock — but they say so. */
  const offered = useMemo(() => {
    const already = new Set(addOns.map((a) => a.itemId).filter(Boolean));
    const live = items.filter((i) => i.status !== "archived" && !already.has(i.id));
    const here = (i: InventoryItemView) => locationIds.length === 0 || i.locationIds.some((l) => locationIds.includes(l));
    return [...live.filter(here), ...live.filter((i) => !here(i))];
  }, [items, addOns, locationIds]);

  const add = (item: InventoryItemView) => {
    onChange([
      ...addOns,
      { name: item.name, price: (item.price / 100).toFixed(2).replace(/\.00$/, ""), perPerson: false, itemId: item.id },
    ]);
    setPicking(false);
  };

  return (
    <div className="flex flex-col gap-tight">
      <div className="flex flex-wrap items-center justify-between gap-tight">
        <span className="type-label text-[12px] text-muted">{t("title")}</span>
        <span className="flex items-center gap-tight">
          <Button size="sm" variant="secondary" icon={<Boxes size={14} strokeWidth={1.5} />} onClick={() => setPicking(true)}>
            {t("fromInventory")}
          </Button>
          <Button size="sm" variant="secondary" icon={<Plus size={14} strokeWidth={1.5} />} onClick={() => onChange([...addOns, emptyAddOn()])}>
            {t("addCharge")}
          </Button>
        </span>
      </div>
      <p className="text-[12px] text-muted">{t("help")}</p>

      {addOns.map((a, i) => {
        const item = a.itemId ? byId.get(a.itemId) : undefined;
        return (
          <div
            key={i}
            className={cn(
              "grid grid-cols-1 items-end gap-tight rounded-sm border p-comfortable sm:grid-cols-[1fr_8rem_auto_auto]",
              item ? "border-line bg-subtle/40" : "border-line",
            )}
          >
            {item ? (
              /* A linked extra's name belongs to the item, not to this
                 booking: renaming it here would mean the shelf and the till
                 call the same thing two different things. */
              <span className="flex min-w-0 flex-col gap-inline">
                {i === 0 && <span className="type-label text-[12px] text-muted">{t("colName")}</span>}
                <span className="flex min-w-0 flex-wrap items-center gap-tight">
                  <Boxes size={14} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
                  <span className="min-w-0 truncate text-[13px] font-medium">{item.name}</span>
                  {item.tracked && (
                    <StatusPill tone={item.outOfStock ? "danger" : item.low ? "warning" : "neutral"}>
                      {t("left", { count: item.onHand, unit: item.unit })}
                    </StatusPill>
                  )}
                </span>
              </span>
            ) : (
              <FormField
                label={i === 0 ? t("colName") : undefined}
                placeholder={t("namePlaceholder")}
                value={a.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
            )}
            <FormField
              label={i === 0 ? t("colPrice", { currency }) : undefined}
              variant="number"
              value={a.price}
              onChange={(e) => update(i, { price: e.target.value })}
            />
            <label className="flex items-center gap-inline pb-tight text-[13px]">
              <input
                type="checkbox"
                checked={a.perPerson}
                onChange={(e) => update(i, { perPerson: e.target.checked })}
                className="h-4 w-4 accent-[var(--color-ember-solid)]"
              />
              {t("perPerson")}
            </label>
            <button
              type="button"
              aria-label={t("remove", { name: item?.name ?? a.name })}
              onClick={() => onChange(addOns.filter((_, idx) => idx !== i))}
              className="flex h-11 w-11 items-center justify-center rounded-sm border border-line text-danger md:h-9 md:w-9"
            >
              <Trash2 size={16} strokeWidth={1.5} />
            </button>
          </div>
        );
      })}

      {picking && (
        <Modal open onClose={() => setPicking(false)} size="sm" title={t("pickTitle")} description={t("pickHelp")}>
          {offered.length === 0 ? (
            <p className="text-[13px] text-muted">{t("pickEmpty")}</p>
          ) : (
            <ul className="flex flex-col">
              {offered.map((i) => (
                <li key={i.id} className="border-b border-hairline last:border-0">
                  <button
                    type="button"
                    onClick={() => add(i)}
                    className="flex min-h-11 w-full items-center gap-tight py-comfortable text-left transition-colors duration-quick hover:bg-muted-wash"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{i.name}</span>
                      <span className="block truncate text-[12px] text-muted">
                        {[
                          formatMoney(i.price),
                          i.tracked ? t("left", { count: i.onHand, unit: i.unit }) : t("notCounted"),
                          locationIds.length > 0 && !i.locationIds.some((l) => locationIds.includes(l)) ? t("elsewhere") : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <Tag size={14} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
