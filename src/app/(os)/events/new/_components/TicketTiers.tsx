"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button, DateField, FormField } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import type { EventTier } from "@/lib/api/events";

export interface FormTier {
  id: string;
  name: string;
  /** Major units as typed, so a half-entered "12" is not read as ৳0.12. */
  price: string;
  quantity: string;
  description: string;
  salesEnd: string;
}

export const emptyTier = (name = ""): FormTier => ({
  id: `t_${Math.random().toString(36).slice(2, 9)}`,
  name,
  price: "",
  quantity: "",
  description: "",
  salesEnd: "",
});

export const toTiers = (rows: FormTier[]): EventTier[] =>
  rows.map((r) => ({
    id: r.id,
    name: r.name.trim(),
    price: Math.max(0, Math.round((parseFloat(r.price) || 0) * 100)),
    quantity: Math.max(0, Math.round(parseFloat(r.quantity) || 0)),
    sold: 0,
    description: r.description.trim() || undefined,
    salesEnd: r.salesEnd ? `${r.salesEnd}T23:59:00+06:00` : undefined,
  }));

/**
 * Ticket tiers.
 *
 * The research is consistent across Eventbrite, Luma and DICE: a real event
 * mixes a free or cheap tier with a headline one and something time-limited,
 * so the editor has to make three rows as cheap to create as one. Hence the
 * quick-add row underneath — an early-bird tier is a price AND an end date, and
 * an operator who has to discover that pairing themselves usually does not.
 *
 * Zero is a valid price, not an empty field: a free RSVP tier is a first-class
 * thing here, which is why the total line says "Free" rather than "৳0.00".
 */
export function TicketTiers({
  rows,
  onChange,
  errors,
}: {
  rows: FormTier[];
  onChange: (rows: FormTier[]) => void;
  errors: Record<string, string>;
}) {
  const t = useTranslations("events");
  const tc = useTranslations("common");

  const patch = (id: string, p: Partial<FormTier>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const remove = (id: string) => onChange(rows.filter((r) => r.id !== id));
  const add = (name = "") => onChange([...rows, emptyTier(name)]);

  const capacity = rows.reduce((s, r) => s + (parseInt(r.quantity, 10) || 0), 0);
  const potential = rows.reduce(
    (s, r) => s + (parseInt(r.quantity, 10) || 0) * Math.round((parseFloat(r.price) || 0) * 100),
    0,
  );

  return (
    <div className="flex flex-col gap-section">
      {rows.map((r, i) => (
        <div key={r.id} className="rounded-md border border-line bg-card p-major">
          <div className="mb-section flex items-center justify-between gap-tight">
            <span className="type-label text-[12px] text-muted">{t("tickets.tierN", { n: i + 1 })}</span>
            <button
              type="button"
              onClick={() => remove(r.id)}
              disabled={rows.length === 1}
              aria-label={t("tickets.remove")}
              className="flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-subtle hover:text-danger disabled:opacity-30 sm:h-9 sm:w-9"
            >
              <Trash2 size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div className="grid gap-section sm:grid-cols-2">
            <FormField
              label={t("tickets.name")}
              required
              placeholder={t("tickets.namePlaceholder")}
              value={r.name}
              onChange={(e) => patch(r.id, { name: e.target.value })}
              error={i === 0 ? errors.tierName : undefined}
            />
            <FormField
              label={t("tickets.price")}
              variant="number"
              placeholder="0"
              help={t("tickets.priceHelp")}
              value={r.price}
              onChange={(e) => patch(r.id, { price: e.target.value })}
            />
            <FormField
              label={t("tickets.quantity")}
              variant="number"
              placeholder="100"
              value={r.quantity}
              onChange={(e) => patch(r.id, { quantity: e.target.value })}
              error={i === 0 ? errors.tierQuantity : undefined}
            />
            <div className="flex flex-col gap-inline">
              <span className="type-label text-[12px] text-muted">{t("tickets.salesEnd")}</span>
              <DateField
                value={r.salesEnd || null}
                today={DEMO_TODAY}
                onChange={(v) => patch(r.id, { salesEnd: v })}
                labels={{
                  previousMonth: tc("previousMonth"),
                  nextMonth: tc("nextMonth"),
                  today: tc("today"),
                  open: tc("openCalendar"),
                }}
              />
              <span className="text-[12px] text-muted">{t("tickets.salesEndHelp")}</span>
            </div>
            <FormField
              label={t("tickets.description")}
              placeholder={t("tickets.descriptionPlaceholder")}
              value={r.description}
              onChange={(e) => patch(r.id, { description: e.target.value })}
              className="sm:col-span-2"
            />
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-tight">
        <Button variant="secondary" icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => add()}>
          {t("tickets.add")}
        </Button>
        {/* Named shortcuts, because the shape of a good ticket table is not
            obvious and this is where an operator decides it. */}
        {(["earlyBird", "vip", "free"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => add(t(`tickets.preset.${k}`))}
            className="min-h-11 rounded-sm border border-dashed border-line px-comfortable text-[13px] text-muted transition-colors duration-quick hover:border-ember hover:text-fg sm:min-h-9"
          >
            + {t(`tickets.preset.${k}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-tight rounded-md border border-line bg-subtle px-major py-comfortable">
        <span className="text-[13px] text-muted">{t("tickets.capacity", { count: capacity })}</span>
        <span className="text-sm font-medium tabular-nums">
          {t("tickets.potential", { amount: potential === 0 ? t("free") : formatMoney(potential) })}
        </span>
      </div>
    </div>
  );
}
