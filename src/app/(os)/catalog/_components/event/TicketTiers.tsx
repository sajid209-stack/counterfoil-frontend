"use client";

import { useTranslations } from "next-intl";
import { CalendarRange, Plus, Sparkles } from "lucide-react";
import { Button, DateField, FormField } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDay, formatPriceShort } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import type { EventDay, EventTier } from "@/lib/api/events";
import { dayName } from "@/lib/events/days";
import { TierTable } from "../TierTable";

export interface FormTier {
  id: string;
  name: string;
  /** Major units as typed, so a half-entered "12" is not read as ৳0.12. */
  price: string;
  quantity: string;
  description: string;
  salesEnd: string;
  /** Which days it admits. Empty means every day, which is what every ticket
   *  on a one-day event means and what every ticket meant before days. */
  dayIds: string[];
}

export const emptyTier = (name = ""): FormTier => ({
  id: `t_${Math.random().toString(36).slice(2, 9)}`,
  name,
  price: "",
  quantity: "",
  description: "",
  salesEnd: "",
  dayIds: [],
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
    dayIds: r.dayIds.length ? r.dayIds : undefined,
  }));

/**
 * Ticket types, in the catalog's one tier table (`TierTable`) — the same rows
 * a booking's prices are edited in, with how many exist in place of how many
 * each admits, and what has sold beside it.
 *
 * The research is consistent across Eventbrite, Luma and DICE: a real event
 * mixes a free or cheap tier with a headline one and something time-limited,
 * so the editor has to make three rows as cheap to create as one. Hence the
 * quick-add row underneath — an early-bird tier is a price AND an end date, and
 * an operator who has to discover that pairing themselves usually does not.
 *
 * Zero is a valid price, not an empty field: a free RSVP tier is a first-class
 * thing here, which is why the total line says "Free" rather than "৳0".
 */
export function TicketTiers({
  rows,
  onChange,
  errors,
  sold = {},
  days = [],
}: {
  rows: FormTier[];
  onChange: (rows: FormTier[]) => void;
  errors: Record<string, string>;
  /** Editing a live event: what each existing tier has sold. A tier with
   *  sales says so, and cannot be removed — its orders point at it. */
  sold?: Record<string, number>;
  /** The days the event runs. One or none and no day control is drawn at all:
   *  a single-evening gig must not be asked which day its ticket admits. */
  days?: EventDay[];
}) {
  const t = useTranslations("events");
  const te = useTranslations("catalog.editEvent");
  const tf = useTranslations("catalog.fields");
  const tc = useTranslations("common");

  const patch = (id: string, p: Partial<FormTier>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const remove = (id: string) => onChange(rows.filter((r) => r.id !== id));
  const add = (name = "") => onChange([...rows, emptyTier(name)]);
  const editing = Object.keys(sold).length > 0;

  const capacity = rows.reduce((s, r) => s + (parseInt(r.quantity, 10) || 0), 0);
  const potential = rows.reduce(
    (s, r) => s + (parseInt(r.quantity, 10) || 0) * Math.round((parseFloat(r.price) || 0) * 100),
    0,
  );
  /* A row with no price yet is not a free row. Reading "Free if it all sells"
     over a table nobody has priced states the one thing an operator is most
     likely to be wrong about. */
  const unpriced = rows.some((r) => r.name.trim() !== "" && r.price.trim() === "");

  /* Days only matter when there is more than one. Everything below this line
     draws nothing at all for a single-day event. */
  const multi = days.length > 1;
  const label = (d: EventDay, i: number) => dayName(d, i, (n) => t("tickets.days.nth", { n }));
  const minor = (r: FormTier) => Math.round((parseFloat(r.price) || 0) * 100);
  const admits = (r: FormTier, id: string) => r.dayIds.length === 0 || r.dayIds.includes(id);
  const toggleDay = (r: FormTier, id: string) => {
    /* An empty scope means "every day", so the first day switched OFF has to
       start from all of them — otherwise unticking Saturday on a ticket that
       admits everything would silently widen it to Sunday only. */
    const current = r.dayIds.length ? r.dayIds : days.map((d) => d.id);
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    const ordered = days.filter((d) => next.includes(d.id)).map((d) => d.id);
    patch(r.id, { dayIds: ordered.length === days.length ? [] : ordered });
  };

  /** What a multi-day ticket saves against buying its days one at a time —
   *  the same rule the public page states, computed live as it is typed. */
  const savingOf = (r: FormTier): number | null => {
    const covers = r.dayIds.length ? r.dayIds : days.map((d) => d.id);
    if (!multi || covers.length < 2) return null;
    let sum = 0;
    for (const id of covers) {
      const singles = rows.filter((x) => x.id !== r.id && x.dayIds.length === 1 && x.dayIds[0] === id && x.price.trim() !== "");
      if (!singles.length) return null;
      sum += Math.min(...singles.map(minor));
    }
    const diff = sum - minor(r);
    return diff > 0 ? diff : null;
  };

  /** One tap for the tedious half: a pass for each day, priced at whatever is
   *  already in the first row, named with the day it admits — because a ticket
   *  whose name does not say its day cannot be read at the gate either. */
  const addPerDay = () => {
    const have = new Set(rows.filter((r) => r.dayIds.length === 1).map((r) => r.dayIds[0]));
    const want = days.filter((d) => !have.has(d.id));
    if (!want.length) return;
    /* The row already on screen becomes the FIRST day's rather than sitting
       beside it: an operator who typed a price and then asked for a pass per
       day meant that price, and leaving the original behind would quietly
       turn it into a pass admitting everything — an accidental bundle nobody
       chose, which then hides the button for the real one. Their own wording
       is kept and the day is added to it, because the day has to be readable
       on the ticket itself. */
    const spare = rows.filter((r) => r.dayIds.length === 0 && !(sold[r.id] ?? 0));
    const base = rows.find((r) => r.price.trim() !== "") ?? rows[0];
    const named = (d: EventDay, was: string) => {
      const day = label(d, days.indexOf(d));
      return was.trim() ? t("tickets.days.dayNamed", { name: was.trim(), day }) : t("tickets.days.dayTicket", { day });
    };
    const taken = new Map<string, EventDay>();
    spare.forEach((r, i) => { if (want[i]) taken.set(r.id, want[i]); });
    const next = rows.map((r) => {
      const d = taken.get(r.id);
      return d ? { ...r, dayIds: [d.id], name: named(d, r.name) } : r;
    });
    /* Minted rows take the SAME wording as the reused one, or the table ships
       "General admission — Day 1" beside "Day 2 pass" — two names for one
       thing, published to buyers. */
    const made = want.slice(taken.size).map((d, i) => ({
      ...emptyTier(named(d, base?.name ?? "")),
      price: base?.price ?? "",
      quantity: base?.quantity ?? "",
      dayIds: [d.id],
      id: `t_${Date.now().toString(36)}_${i}`,
    }));
    onChange([...next, ...made]);
  };

  /** And the other half: the pass that covers the lot, priced at the sum so
   *  the operator lowers it and watches the saving appear. */
  const addBundle = () => {
    const sum = days.reduce((n, d) => {
      const singles = rows.filter((x) => x.dayIds.length === 1 && x.dayIds[0] === d.id && x.price.trim() !== "");
      return n + (singles.length ? Math.min(...singles.map(minor)) : 0);
    }, 0);
    onChange([
      ...rows,
      {
        ...emptyTier(t("tickets.days.allTicket", { count: days.length })),
        price: sum > 0 ? String(sum / 100) : "",
        quantity: rows[0]?.quantity ?? "",
        dayIds: [],
        id: `t_${Date.now().toString(36)}_all`,
      },
    ]);
  };
  const hasBundle = rows.some((r) => r.dayIds.length === 0 || r.dayIds.length === days.length);
  const perDayDone = days.every((d) => rows.some((r) => r.dayIds.length === 1 && r.dayIds[0] === d.id));

  return (
    <div className="flex flex-col gap-section">
      <TierTable
        labels={{
          name: t("tickets.name"),
          price: t("tickets.price"),
          qty: t("tickets.quantity"),
          sold: te("soldCol"),
          details: tf("tierDetails"),
          moveUp: tf("moveUp"),
          moveDown: tf("moveDown"),
          soldOf: (n, cap) => te("soldOf", { sold: n.toLocaleString(), cap: cap.toLocaleString() }),
        }}
        rows={rows.map((r, i) => {
          const hasSold = (sold[r.id] ?? 0) > 0;
          return {
            key: r.id,
            name: r.name,
            onName: (v) => patch(r.id, { name: v }),
            namePlaceholder: t("tickets.namePlaceholder"),
            nameError: errors[`tiers.${i}.name`] ?? (i === 0 ? errors.tierName : undefined),
            price: r.price,
            onPrice: (v) => patch(r.id, { price: v }),
            priceError: errors[`tiers.${i}.price`],
            qty: r.quantity,
            onQty: (v) => patch(r.id, { quantity: v }),
            qtyError: errors[`tiers.${i}.quantity`] ?? (i === 0 ? errors.tierQuantity : undefined),
            sold: editing ? (sold[r.id] ?? 0) : undefined,
            /* Which days it admits, and what covering several of them saves.
               Always open rather than folded: on a multi-day event this is
               what separates two rows that otherwise differ by a price. */
            scope: multi ? (
              <div className="flex flex-wrap items-center gap-tight">
                <span className="flex items-center gap-inline text-[12px] font-medium text-muted">
                  <CalendarRange size={14} strokeWidth={1.5} aria-hidden />
                  {t("tickets.days.admits")}
                </span>
                <span className="flex flex-wrap items-center gap-inline">
                  {days.map((d, di) => {
                    const on = admits(r, d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleDay(r, d.id)}
                        className={cn(
                          "flex min-h-11 items-center rounded-full border px-comfortable text-[12px] font-medium transition-colors duration-quick sm:min-h-8",
                          on ? "border-ember bg-ember/10 text-brand-foreground" : "border-line text-muted hover:text-fg",
                        )}
                      >
                        {label(d, di)}
                      </button>
                    );
                  })}
                </span>
                {(() => {
                  const save = savingOf(r);
                  return save === null ? null : (
                    <span className="flex items-center gap-inline rounded-full bg-success/10 px-comfortable py-inline text-[12px] font-medium text-success">
                      <Sparkles size={13} strokeWidth={1.5} aria-hidden />
                      {t("tickets.days.saves", { amount: formatPriceShort(save) })}
                    </span>
                  );
                })()}
              </div>
            ) : undefined,
            summary: [
              r.salesEnd && t("tickets.summaryEnds", { date: formatDay(r.salesEnd) }),
              r.description.trim(),
            ]
              .filter(Boolean)
              .join(" · "),
            details: (
              <>
                <div className="flex flex-col gap-inline">
                  <span className="type-label text-[12px] text-muted">{t("tickets.salesEnd")}</span>
                  <DateField
                    size="form"
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
                />
              </>
            ),
            remove: {
              label: hasSold ? te("cantRemove", { count: sold[r.id] }) : rows.length === 1 ? t("tickets.keepOne") : t("tickets.remove"),
              disabled: rows.length === 1 || hasSold,
              onRemove: () => remove(r.id),
            },
          };
        })}
      />

      <div className="flex flex-wrap items-center gap-tight">
        <Button variant="secondary" icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => add()}>
          {t("tickets.add")}
        </Button>
        {/* Named shortcuts, because the shape of a good ticket table is not
            obvious and this is where an operator decides it. */}
        {/* The two tedious halves of a multi-day table, one tap each. Offered
            only while they would actually add something. */}
        {multi && !perDayDone && (
          <button
            type="button"
            onClick={addPerDay}
            className="min-h-11 rounded-sm border border-dashed border-line px-comfortable text-[13px] text-muted transition-colors duration-quick hover:border-ember hover:text-fg sm:min-h-9"
          >
            + {t("tickets.days.addPerDay")}
          </button>
        )}
        {multi && !hasBundle && (
          <button
            type="button"
            onClick={addBundle}
            className="min-h-11 rounded-sm border border-dashed border-line px-comfortable text-[13px] text-muted transition-colors duration-quick hover:border-ember hover:text-fg sm:min-h-9"
          >
            + {t("tickets.days.addBundle", { count: days.length })}
          </button>
        )}
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

      <div className="flex flex-wrap items-baseline justify-between gap-tight rounded-sm border border-line bg-subtle px-card py-comfortable">
        <span className="text-[13px] text-muted">{t("tickets.capacity", { count: capacity })}</span>
        <span className={cn("text-sm font-medium", !unpriced && "tabular-nums")}>
          {/* Three honest answers, and "Free" is only one of them. A table with
              prices in it and no quantities is not a free event — it is an
              unfinished one, and saying "Free" there states the thing an
              operator is most likely to be wrong about. */}
          {unpriced
            ? t("tickets.potentialUnpriced")
            : capacity === 0
              ? t("tickets.potentialNoCapacity")
              : potential === 0
                ? t("tickets.potentialFree")
                : t("tickets.potential", { amount: formatPriceShort(potential) })}
        </span>
      </div>
    </div>
  );
}
