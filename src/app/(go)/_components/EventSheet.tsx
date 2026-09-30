"use client";

/**
 * Selling an event at the counter.
 *
 * An event is not a booking: it has no schedule, no resources and no tiers in
 * the catalogue sense — it has DAYS and TICKET TYPES, and a ticket type may
 * admit one day or all of them. So it gets its own sheet rather than a branch
 * inside the booking sheet, for the same reason the seat map and the lane
 * timeline are their own patterns.
 *
 * Two rules it is built on:
 *
 *  1. **The day is chosen before the ticket**, when there is more than one —
 *     the buyer decides *which day* first and *which access level* second, and
 *     a flat list of "Day 1 GA · Day 1 VIP · Day 2 GA · Both GA" is the same
 *     information arranged so nobody can read it.
 *
 *  2. **A ticket is capped by the grouped capacity of every day it admits.**
 *     A weekend pass takes a place on Saturday AND on Sunday, so it has to
 *     stop when the fuller of the two runs out. Anything else oversells the
 *     day it covers — which is the whole reason `dayFill` exists.
 */
import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { formatDay, formatMoney } from "@/lib/format";
import { dayFill, eventDays, isBundleTier, tierDays, type EventRecord, type EventTier } from "@/lib/api";
import { eventLineId } from "@/lib/api";
import { dayName } from "@/lib/events/days";
import { cn } from "@/lib/cn";
import type { CartEntry } from "./ProductSheet";

export function EventSheet({
  event,
  currency,
  onClose,
  onAdd,
}: {
  event: EventRecord;
  currency: string;
  onClose: () => void;
  onAdd: (entry: CartEntry, pay: boolean) => void;
}) {
  const t = useTranslations("pos");
  const days = eventDays(event);
  /** The operator's name for a day, or "Day 2" — never blank, because a chip
   *  with no label is a chip nobody can choose. */
  const labelOfDay = (id: string) => {
    const i = days.findIndex((d) => d.id === id);
    return i < 0 ? "" : dayName(days[i], i, (n) => t("event.dayN", { n }));
  };
  const multi = days.length > 1;
  const [dayId, setDayId] = useState<string | null>(multi ? days[0].id : null);
  const [qty, setQty] = useState<Record<string, number>>({});

  const today = new Date().toISOString().slice(0, 10);
  /** What a tier can still take: its own stock, and every day it admits. */
  const roomFor = (tier: EventTier) => {
    const own = Math.max(0, tier.quantity - tier.sold);
    const covered = tierDays(event, tier);
    const byDay = covered.map((d) => {
      const f = dayFill(event, d.id);
      return Math.max(0, f.cap - f.sold);
    });
    return Math.min(own, ...(byDay.length ? byDay : [own]));
  };

  /* A tier is offered when it admits the chosen day and is still selling. A
     bundle is offered whichever day is showing: it admits that one too. */
  const offered = event.tiers.filter((tier) => {
    if (tier.salesEnd && tier.salesEnd < today) return false;
    if (!dayId) return true;
    const ds = tierDays(event, tier);
    return ds.some((d) => d.id === dayId);
  });

  const chosen = offered
    .map((tier) => ({ tier, n: qty[tier.id] ?? 0 }))
    .filter((x) => x.n > 0);
  const total = chosen.reduce((s, x) => s + x.n * x.tier.price, 0);
  const count = chosen.reduce((s, x) => s + x.n, 0);

  const submit = (pay: boolean) => {
    if (!count) return;
    const day = days.find((d) => d.id === dayId);
    onAdd(
      {
        id: `entry_${globalThis.crypto.randomUUID().slice(0, 8)}`,
        /* Prefixed, so a line resolves back to its event in reports and in the
           settlement — the same trick an inventory line uses. */
        productId: eventLineId(event.id),
        productName: event.title,
        items: chosen.map((x) => ({ tierId: x.tier.id, tierName: x.tier.name, unitPrice: x.tier.price, qty: x.n })),
        slotDate: day?.date ?? event.startsAt.slice(0, 10),
        eventDayLabel: multi && day ? labelOfDay(day.id) : undefined,
      },
      pay,
    );
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={event.title} className="fixed inset-0 z-50 flex flex-col justify-end">
      <button type="button" aria-label={t("sheet.close")} onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div className="go-sheet-panel relative z-10 max-h-[90vh] overflow-y-auto rounded-t-go-lg bg-sheet p-section">
        <div className="mx-auto mb-section h-1 w-10 rounded-full bg-line" aria-hidden />
        <div className="mb-section flex items-start gap-tight">
          <div className="min-w-0 flex-1">
            <h2 className="type-h2 text-[1.0625rem]">{event.title}</h2>
            <p className="text-[0.8125rem] text-muted">
              {formatDay(event.startsAt.slice(0, 10), { weekday: true })}
              {multi ? ` · ${t("event.runsDays", { count: days.length })}` : ""} · {event.venueName}
            </p>
          </div>
          <button type="button" aria-label={t("sheet.close")} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-subtle">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* WHICH DAY — only where there is a choice to make. */}
        {multi && (
          <section className="mb-section">
            <h3 className="mb-tight text-[0.875rem] font-semibold">{t("event.whichDay")}</h3>
            <div className="flex flex-wrap gap-tight">
              {days.map((d) => {
                const f = dayFill(event, d.id);
                const left = Math.max(0, f.cap - f.sold);
                const on = d.id === dayId;
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDayId(d.id)}
                    className={cn(
                      "min-h-12 rounded-go-sm border px-comfortable py-inline text-left",
                      on ? "border-ember-solid bg-ember/10" : "border-line",
                    )}
                  >
                    <span className="block text-[0.875rem] font-medium">{dayName(d, days.indexOf(d), (n) => t("event.dayN", { n }))}</span>
                    <span className="block text-[0.8125rem] text-muted">
                      {formatDay(d.date)} · {t("event.left", { count: left })}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* WHICH TICKET */}
        <section className="mb-section">
          <h3 className="mb-tight text-[0.875rem] font-semibold">{t("event.whichTicket")}</h3>
          <div className="overflow-hidden rounded-go-sm border border-line">
            {offered.map((tier, i) => {
              const room = roomFor(tier);
              const n = qty[tier.id] ?? 0;
              const bundle = multi && isBundleTier(event, tier);
              return (
                <div key={tier.id} className={cn("flex items-center gap-tight p-comfortable", i > 0 && "border-t border-line")}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.9375rem] font-medium">
                      {tier.name}
                      {bundle && <span className="ml-inline text-[0.8125rem] font-normal text-muted">· {t("event.allDays")}</span>}
                    </p>
                    <p className="text-[0.8125rem] text-brand-foreground">
                      {tier.price === 0 ? t("event.free") : formatMoney(tier.price, currency)}
                    </p>
                    {room <= 0 ? (
                      <p className="text-[0.8125rem] text-muted">{t("event.soldOut")}</p>
                    ) : room <= 10 ? (
                      <p className="text-[0.8125rem] text-warning">{t("event.left", { count: room })}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-tight">
                    <button
                      type="button"
                      aria-label={t("sheet.less")}
                      disabled={n === 0}
                      onClick={() => setQty((q) => ({ ...q, [tier.id]: Math.max(0, n - 1) }))}
                      className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-[1.125rem] disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-[1rem] font-medium tabular-nums">{n}</span>
                    <button
                      type="button"
                      aria-label={t("sheet.more")}
                      disabled={n >= room}
                      onClick={() => setQty((q) => ({ ...q, [tier.id]: n + 1 }))}
                      className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-[1.125rem] disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="sticky bottom-0 -mx-section bg-sheet px-section pt-tight">
          <div className="mb-tight flex items-center justify-between border-t border-line pt-tight text-[0.875rem]">
            <span className="text-muted">
              {count > 0 ? t("event.summary", { count }) : t("event.pickTickets")}
              {multi && dayId ? ` · ${labelOfDay(dayId)}` : ""}
            </span>
            <span className="font-semibold tabular-nums">{formatMoney(total, currency)}</span>
          </div>
          <div className="flex gap-tight pb-inline">
            <Button shape="pill" size="lg" className="flex-1" disabled={!count} onClick={() => submit(false)}>
              {count ? t("event.add", { count }) : t("event.pickTickets")}
            </Button>
            <Button shape="pill" size="lg" variant="secondary" disabled={!count} onClick={() => submit(true)}>
              {count ? t("sheet.buyNow", { amount: formatMoney(total, currency) }) : t("sheet.buyNowShort")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
