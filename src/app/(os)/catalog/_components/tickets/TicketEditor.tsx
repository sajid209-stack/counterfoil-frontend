"use client";

import { useTranslations } from "next-intl";
import { CalendarRange, Plus, Sparkles } from "lucide-react";
import { Button, Chip, DateField, FormField, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDay, formatPriceShort } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import type { EventDay } from "@/lib/api/events";
import { dayName } from "@/lib/events/days";
import { TierTable } from "../TierTable";
import { emptyTicket, newTicketId, type TicketRow } from "./ticketRows";

/** Which of a row's optional parts the editor shows. Everything by default; the
 *  two older editors (a record's price tab and an event's ticket tab) hold less
 *  per row and ask for less, so they switch off what they cannot keep. */
export interface TicketFields {
  includes?: boolean;
  note?: boolean;
  admits?: boolean;
  age?: boolean;
  stop?: boolean;
  max?: boolean;
  donation?: boolean;
  reorder?: boolean;
}

export interface TicketEditorProps {
  rows: TicketRow[];
  onChange: (rows: TicketRow[]) => void;
  /** Problems by key: `tiers.<i>.name`, `tiers.<i>.price`, `tiers.<i>.quantity`, `tiers`. */
  errors: Record<string, string>;
  currency?: string;
  /** The days an on-a-date booking runs. Two or more draws "Good for" chips on
   *  every row, the two day helpers and the saving line. */
  days?: EventDay[];
  /** A live booking: what each ticket has sold. A ticket that has sold cannot be removed. */
  sold?: Record<string, number>;
  /** The number beside the price: how many tickets exist (blank, no limit), or
   *  how many people one ticket lets in. */
  column?: "limit" | "admits";
  /** A blank "How many" is a problem (an event's tickets). */
  limitRequired?: boolean;
  fields?: TicketFields;
  /** Early bird, VIP and Free as one-tap rows. */
  presets?: boolean;
  /** The "N tickets in all / worth ৳X" line under the rows. */
  totals?: boolean;
  /** Draw the heading and the Add button on one line above the rows. */
  heading?: boolean;
  className?: string;
}

/**
 * The ONE ticket editor, for every booking (docs/catalog.md §10.3).
 *
 * Each row is a ticket type: a name, a price and "How many" (blank means no
 * limit). Under "More" fold the rest — what it includes, the people one ticket
 * lets in, an age note, when sales stop — and, only for an on-a-date booking
 * that runs several days, "Good for" day chips with the helpers that make a
 * pass for each day or one for all of them. Whatever is set is summarised when
 * the row is folded, so nothing is ever out of sight.
 *
 * It replaced two editors (a booking's `PriceTiersField` and an event's
 * `TicketTiers`), which are now thin adapters over this one.
 */
export function TicketEditor({
  rows,
  onChange,
  errors,
  currency = "BDT",
  days = [],
  sold = {},
  column = "limit",
  limitRequired = false,
  fields = {},
  presets = false,
  totals = false,
  heading = false,
  className,
}: TicketEditorProps) {
  const t = useTranslations("catalog.tickets");
  const te = useTranslations("events");
  const tf = useTranslations("catalog.fields");
  const tc = useTranslations("common");
  const tev = useTranslations("catalog.editEvent");
  const f = { includes: true, note: true, admits: true, age: true, stop: true, max: true, donation: true, reorder: true, ...fields };
  const symbol = currency === "BDT" ? "৳" : currency;
  const editing = Object.keys(sold).length > 0;

  const patch = (id: string, p: Partial<TicketRow>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const remove = (id: string) => onChange(rows.filter((r) => r.id !== id));
  const add = (name = "") => onChange([...rows, emptyTicket(name)]);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  /* Day controls exist only when there is more than one day. A single evening
     must never be asked which day its ticket is good for. */
  const multi = days.length > 1;
  const dayLabel = (d: EventDay, i: number) => dayName(d, i, (n) => te("tickets.days.nth", { n }));
  const minor = (r: TicketRow) => Math.round((parseFloat(r.price) || 0) * 100);
  const admitsDay = (r: TicketRow, id: string) => r.dayIds.length === 0 || r.dayIds.includes(id);
  const toggleDay = (r: TicketRow, id: string) => {
    /* An empty scope means "every day", so the first day switched OFF has to
       start from all of them — otherwise unticking Saturday on a ticket that is
       good for everything would silently widen it to Sunday only. */
    const current = r.dayIds.length ? r.dayIds : days.map((d) => d.id);
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    const ordered = days.filter((d) => next.includes(d.id)).map((d) => d.id);
    patch(r.id, { dayIds: ordered.length === days.length ? [] : ordered });
  };

  /** What a multi-day ticket saves against buying its days one at a time —
   *  the same rule the public page states, worked out live as it is typed. */
  const savingOf = (r: TicketRow): number | null => {
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

  /** A ticket for each day, priced at what is in the first row and named with
   *  the day it is good for — a ticket whose name does not say its day cannot be
   *  read at the gate either. The row already on screen becomes the first day's
   *  rather than sitting beside it. */
  const addPerDay = () => {
    const have = new Set(rows.filter((r) => r.dayIds.length === 1).map((r) => r.dayIds[0]));
    const want = days.filter((d) => !have.has(d.id));
    if (!want.length) return;
    const spare = rows.filter((r) => r.dayIds.length === 0 && !(sold[r.id] ?? 0));
    const base = rows.find((r) => r.price.trim() !== "") ?? rows[0];
    const named = (d: EventDay, was: string) => {
      const day = dayLabel(d, days.indexOf(d));
      return was.trim() ? te("tickets.days.dayNamed", { name: was.trim(), day }) : te("tickets.days.dayTicket", { day });
    };
    const taken = new Map<string, EventDay>();
    spare.forEach((r, i) => {
      if (want[i]) taken.set(r.id, want[i]);
    });
    const next = rows.map((r) => {
      const d = taken.get(r.id);
      return d ? { ...r, dayIds: [d.id], name: named(d, r.name) } : r;
    });
    const made = want.slice(taken.size).map((d) => ({
      ...emptyTicket(named(d, base?.name ?? "")),
      price: base?.price ?? "",
      quantity: base?.quantity ?? "",
      id: newTicketId(),
      dayIds: [d.id],
    }));
    onChange([...next, ...made]);
  };

  /** The ticket that covers the lot, priced at the sum so lowering it makes the
   *  saving appear. */
  const addBundle = () => {
    const sum = days.reduce((n, d) => {
      const singles = rows.filter((x) => x.dayIds.length === 1 && x.dayIds[0] === d.id && x.price.trim() !== "");
      return n + (singles.length ? Math.min(...singles.map(minor)) : 0);
    }, 0);
    onChange([
      ...rows,
      { ...emptyTicket(te("tickets.days.allTicket", { count: days.length })), price: sum > 0 ? String(sum / 100) : "", quantity: rows[0]?.quantity ?? "", dayIds: [] },
    ]);
  };
  const hasBundle = rows.some((r) => r.dayIds.length === 0 || r.dayIds.length === days.length);
  const perDayDone = days.every((d) => rows.some((r) => r.dayIds.length === 1 && r.dayIds[0] === d.id));

  const capacity = rows.reduce((s, r) => s + (parseInt(r.quantity, 10) || 0), 0);
  const potential = rows.reduce((s, r) => s + (parseInt(r.quantity, 10) || 0) * minor(r), 0);
  const unpriced = rows.some((r) => r.name.trim() !== "" && r.price.trim() === "");
  const everyHasLimit = rows.length > 0 && rows.every((r) => (parseInt(r.quantity, 10) || 0) > 0);

  const asLimit = column === "limit";

  return (
    <div className={cn("flex flex-col gap-section", className)}>
      {heading && (
        <div className="flex items-end justify-between gap-tight">
          <div>
            <p className="text-md font-semibold text-fg">{tf("tiers")}</p>
            <p className="mt-0.5 text-sm text-muted">{tf("tiersHelp")}</p>
          </div>
        </div>
      )}
      {errors.tiers && (
        <p role="alert" className="text-sm text-danger">
          {errors.tiers}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-control bg-muted-wash px-comfortable py-comfortable text-sm text-muted">{tf("noTiers")}</p>
      ) : (
        <TierTable
          currencySymbol={symbol}
          labels={{
            name: tf("tierName"),
            price: tf("price", { currency: symbol }),
            qty: asLimit ? t("howMany") : tf("admits"),
            sold: tev("soldCol"),
            details: (name) => tf("moreFor", { name }),
            detailsShort: tf("moreShort"),
            moveUp: (name) => tf("moveUp", { name }),
            moveDown: (name) => tf("moveDown", { name }),
            unnamed: tf("unnamedTier"),
            soldOf: (n, cap) => (cap > 0 ? tev("soldOf", { sold: n.toLocaleString(), cap: cap.toLocaleString() }) : t("soldOnly", { count: n })),
          }}
          rows={rows.map((r, i) => {
            const hasSold = (sold[r.id] ?? 0) > 0;
            const people = parseInt(r.admits, 10) || 1;
            const includes = r.perks.split(/\r?\n/).filter((x) => x.trim()).length;
            const save = savingOf(r);
            return {
              key: r.id,
              name: r.name,
              onName: (v) => patch(r.id, { name: v }),
              namePlaceholder: tf("tierNamePlaceholder"),
              nameError: errors[`tiers.${i}.name`] ?? (i === 0 ? errors.tierName : undefined),
              price: r.price,
              onPrice: (v) => patch(r.id, { price: v }),
              priceError: errors[`tiers.${i}.price`],
              pricePlaceholder: tf("pricePlaceholder"),
              qty: asLimit ? r.quantity : r.admits,
              onQty: (v) => patch(r.id, asLimit ? { quantity: v } : { admits: v }),
              qtyPlaceholder: asLimit ? t("noLimit") : "1",
              qtyOptional: asLimit && !limitRequired,
              qtyError: asLimit ? (errors[`tiers.${i}.quantity`] ?? (i === 0 ? errors.tierQuantity : undefined)) : undefined,
              sold: editing ? (sold[r.id] ?? 0) : undefined,
              /* Which days it is good for, and what covering several of them
                 saves. Always open rather than folded: on a multi-day booking
                 this is what separates two rows that otherwise differ by a
                 price. */
              scope: multi ? (
                <div className="flex flex-wrap items-center gap-tight">
                  <span className="flex items-center gap-inline text-sm font-medium text-muted">
                    <CalendarRange size={14} strokeWidth={1.5} aria-hidden />
                    {te("tickets.days.admits")}
                  </span>
                  <span className="flex flex-wrap items-center gap-inline">
                    {days.map((d, di) => (
                      <Chip key={d.id} selected={admitsDay(r, d.id)} onClick={() => toggleDay(r, d.id)}>
                        {dayLabel(d, di)}
                      </Chip>
                    ))}
                  </span>
                  {save !== null && (
                    <StatusPill tone="success" className="gap-inline px-comfortable py-inline">
                      <Sparkles size={13} strokeWidth={1.5} aria-hidden />
                      {te("tickets.days.saves", { amount: formatPriceShort(save) })}
                    </StatusPill>
                  )}
                </div>
              ) : undefined,
              summary: [
                f.stop && r.salesEnd && te("tickets.summaryEnds", { date: formatDay(r.salesEnd) }),
                f.admits && asLimit && people > 1 && t("summaryPeople", { count: people }),
                f.age && r.ageNote.trim() && tf("summaryAge", { note: r.ageNote.trim() }),
                f.includes && includes > 0 && t("summaryIncludes", { count: includes }),
                f.max && r.maxPerOrder && tf("summaryMax", { count: r.maxPerOrder }),
                f.donation && r.donation && tf("donation"),
                f.note && r.description.trim(),
              ]
                .filter(Boolean)
                .join(" · "),
              details: (
                <>
                  {f.includes && (
                    <FormField
                      label={te("tickets.perks")}
                      variant="textarea"
                      placeholder={t("includesPlaceholder")}
                      help={te("tickets.perksHelp")}
                      value={r.perks}
                      onChange={(e) => patch(r.id, { perks: e.target.value })}
                      className="sm:col-span-2"
                    />
                  )}
                  {f.admits && asLimit && (
                    <FormField
                      label={tf("admits")}
                      variant="number"
                      placeholder="1"
                      help={t("admitsHelp")}
                      value={r.admits}
                      onChange={(e) => patch(r.id, { admits: e.target.value })}
                    />
                  )}
                  {f.age && (
                    <FormField label={tf("ageNote")} placeholder={tf("ageNotePlaceholder")} help={tf("ageNoteHelp")} value={r.ageNote} onChange={(e) => patch(r.id, { ageNote: e.target.value })} />
                  )}
                  {f.stop && (
                    <div className="flex flex-col gap-inline">
                      <span className="text-sm font-medium text-muted">{te("tickets.salesEnd")}</span>
                      <DateField
                        size="form"
                        value={r.salesEnd || null}
                        today={DEMO_TODAY}
                        onChange={(v) => patch(r.id, { salesEnd: v })}
                        labels={{ previousMonth: tc("previousMonth"), nextMonth: tc("nextMonth"), today: tc("today"), open: tc("openCalendar") }}
                      />
                      <span className="text-sm text-muted">{te("tickets.salesEndHelp")}</span>
                    </div>
                  )}
                  {f.note && (
                    <FormField
                      label={t("note")}
                      placeholder={te("tickets.descriptionPlaceholder")}
                      value={r.description}
                      onChange={(e) => patch(r.id, { description: e.target.value })}
                    />
                  )}
                  {f.max && (
                    <FormField label={tf("maxPerOrder")} variant="number" help={tf("maxPerOrderHelp")} value={r.maxPerOrder} onChange={(e) => patch(r.id, { maxPerOrder: e.target.value })} />
                  )}
                  {f.donation && (
                    <FormField
                      label={tf("donation")}
                      variant="toggle"
                      help={tf("donationHelp")}
                      checked={r.donation}
                      onChange={(e) => patch(r.id, { donation: (e.target as HTMLInputElement).checked })}
                      className="sm:col-span-2"
                    />
                  )}
                </>
              ),
              remove: {
                label: hasSold
                  ? tev("cantRemove", { count: sold[r.id] })
                  : rows.length === 1
                    ? t("keepOne")
                    : tf("removeTier", { name: r.name.trim() || tf("unnamedTier") }),
                disabled: rows.length === 1 || hasSold,
                onRemove: () => remove(r.id),
              },
              onUp: f.reorder && i > 0 ? () => move(i, -1) : undefined,
              onDown: f.reorder && i < rows.length - 1 ? () => move(i, 1) : undefined,
            };
          })}
        />
      )}

      <div className="flex flex-wrap items-center gap-tight">
        <Button variant="secondary" icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => add()}>
          {tf("addTier")}
        </Button>
        {multi && !perDayDone && (
          <Button variant="tertiary" size="sm" onClick={addPerDay} icon={<Plus size={14} strokeWidth={1.5} aria-hidden />} className="text-muted">
            {te("tickets.days.addPerDay")}
          </Button>
        )}
        {multi && !hasBundle && (
          <Button variant="tertiary" size="sm" onClick={addBundle} icon={<Plus size={14} strokeWidth={1.5} aria-hidden />} className="text-muted">
            {te("tickets.days.addBundle", { count: days.length })}
          </Button>
        )}
        {presets &&
          (["earlyBird", "vip", "free"] as const).map((k) => (
            <Button key={k} variant="tertiary" size="sm" onClick={() => add(te(`tickets.preset.${k}`))} icon={<Plus size={14} strokeWidth={1.5} aria-hidden />} className="text-muted">
              {te(`tickets.preset.${k}`)}
            </Button>
          ))}
      </div>

      {totals && asLimit && (limitRequired || everyHasLimit) && (
        <div className="flex flex-wrap items-baseline justify-between gap-tight rounded-control bg-muted-wash px-card py-comfortable">
          <span className="text-sm text-muted">{te("tickets.capacity", { count: capacity })}</span>
          <span className={cn("text-base font-medium", !unpriced && "tabular-nums")}>
            {unpriced
              ? te("tickets.potentialUnpriced")
              : capacity === 0
                ? te("tickets.potentialNoCapacity")
                : potential === 0
                  ? te("tickets.potentialFree")
                  : te("tickets.potential", { amount: formatPriceShort(potential) })}
          </span>
        </div>
      )}
    </div>
  );
}
