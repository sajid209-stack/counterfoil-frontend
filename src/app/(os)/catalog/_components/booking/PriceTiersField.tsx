"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, FormField } from "@/components/ui";
import { cn } from "@/lib/cn";
import { TierTable } from "../TierTable";

export interface FormTier {
  id?: string;
  name: string;
  price: string; // major units as typed, e.g. "450"
  maxPerOrder: string;
  admits: string; // people this ticket admits (default 1)
  ageNote: string; // e.g. "5–12" — printed on the ticket
  donation: boolean; // pay-what-you-want: price is the minimum, buyer enters more
  active: boolean;
}

export const emptyTier = (name = ""): FormTier => ({
  name,
  price: "",
  maxPerOrder: "",
  admits: "1",
  ageNote: "",
  donation: false,
  active: true,
});

/**
 * A booking's prices, in the catalog's one tier table (`TierTable`): a row per
 * kind of ticket with its name, its price and how many people it lets in.
 * What is printed on the ticket and whether the price is a minimum fold into
 * the row, summarised when folded.
 */
export function PriceTiersField({
  tiers,
  onChange,
  errors,
  currency = "BDT",
  heading = true,
}: {
  tiers: FormTier[];
  onChange: (tiers: FormTier[]) => void;
  errors: Record<string, string>;
  currency?: string;
  /** Off where the page already asks the question — the wizard's price step
   *  is titled "What does it cost?", and a second "Prices" under it is the
   *  same heading twice. */
  heading?: boolean;
}) {
  const t = useTranslations("catalog.fields");
  const update = (i: number, patch: Partial<FormTier>) =>
    onChange(tiers.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= tiers.length) return;
    const next = tiers.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const symbol = currency === "BDT" ? "৳" : currency;

  return (
    <div className="flex flex-col gap-tight">
      <div className={cn("flex items-end gap-tight", heading ? "justify-between" : "justify-end")}>
        {heading && (
          <div>
            <p className="text-[15px] font-semibold tracking-tight">{t("tiers")}</p>
            <p className="mt-0.5 text-[13px] text-muted">{t("tiersHelp")}</p>
          </div>
        )}
        <Button size="sm" variant="secondary" icon={<Plus size={14} strokeWidth={1.5} />} onClick={() => onChange([...tiers, emptyTier()])}>
          {t("addTier")}
        </Button>
      </div>

      {errors.tiers && <p role="alert" className="text-[13px] text-danger">{errors.tiers}</p>}

      {tiers.length === 0 ? (
        <p className="rounded-sm border border-dashed border-line px-comfortable py-comfortable text-[13px] text-muted">{t("noTiers")}</p>
      ) : (
        <TierTable
          currencySymbol={symbol}
          labels={{
            name: t("tierName"),
            price: t("price", { currency: symbol }),
            qty: t("admits"),
            details: t("tierDetails"),
            moveUp: t("moveUp"),
            moveDown: t("moveDown"),
            soldOf: () => "",
          }}
          rows={tiers.map((tier, i) => ({
            key: tier.id ?? `new-${i}`,
            name: tier.name,
            onName: (v) => update(i, { name: v }),
            namePlaceholder: t("tierNamePlaceholder"),
            nameError: errors[`tiers.${i}.name`],
            price: tier.price,
            onPrice: (v) => update(i, { price: v }),
            priceError: errors[`tiers.${i}.price`],
            qty: tier.admits,
            onQty: (v) => update(i, { admits: v }),
            qtyPlaceholder: "1",
            summary: [
              tier.ageNote && t("summaryAge", { note: tier.ageNote }),
              tier.donation && t("donation"),
              tier.maxPerOrder && t("summaryMax", { count: tier.maxPerOrder }),
            ]
              .filter(Boolean)
              .join(" · "),
            details: (
              <>
                <FormField label={t("ageNote")} placeholder={t("ageNotePlaceholder")} help={t("ageNoteHelp")} value={tier.ageNote} onChange={(e) => update(i, { ageNote: e.target.value })} />
                <FormField label={t("maxPerOrder")} variant="number" help={t("maxPerOrderHelp")} value={tier.maxPerOrder} onChange={(e) => update(i, { maxPerOrder: e.target.value })} />
                <FormField
                  label={t("donation")}
                  variant="toggle"
                  help={t("donationHelp")}
                  checked={tier.donation}
                  onChange={(e) => update(i, { donation: (e.target as HTMLInputElement).checked })}
                  className="sm:col-span-2"
                />
              </>
            ),
            remove: { label: t("removeTier"), onRemove: () => onChange(tiers.filter((_, idx) => idx !== i)) },
            onUp: i > 0 ? () => move(i, -1) : undefined,
            onDown: i < tiers.length - 1 ? () => move(i, 1) : undefined,
          }))}
        />
      )}
    </div>
  );
}
