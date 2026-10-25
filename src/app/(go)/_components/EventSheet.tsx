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
import { useTranslations } from "next-intl";
import { ChevronLeft, Plus, X } from "lucide-react";
import { ProductThumb } from "@/components/ui";
import { formatDay, formatMoney } from "@/lib/format";
import { dayFill, eventDays, isBundleTier, tierDays, type EventRecord, type EventTier } from "@/lib/api";
import { dayName } from "@/lib/events/days";
import type { CartEntry } from "./ProductSheet";
import { ActionBar } from "./ActionBar";
import { SheetShell } from "./SheetShell";
import { Stepper } from "./Stepper";
import { Tile, TileGrid, TileLabel } from "./Tiles";
import { FooterSummary, StickyFoot, TileText, summaryLead } from "./SheetParts";

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
        /* An ordinary product line: the product's own id, with the ticket as its
           tier. An event is a catalogue item (BT-15), so reports and the
           settlement tell its lines apart by the product, not by a prefix. */
        productId: event.id,
        productName: event.title,
        items: chosen.map((x) => ({ tierId: x.tier.id, tierName: x.tier.name, unitPrice: x.tier.price, qty: x.n })),
        slotDate: day?.date ?? event.startsAt.slice(0, 10),
        eventDayLabel: multi && day ? labelOfDay(day.id) : undefined,
      },
      pay,
    );
  };

  const dayTitle = multi && dayId ? labelOfDay(dayId) : "";
  const total$ = formatMoney(total, currency);

  /* The same sheet as every booking sheet: a paper ground, each choice its own
     tile or card, and the till's one pair at the foot — back on the left, the
     orange Add on the right. */
  return (
    <SheetShell label={event.title} labelledBy="sheet-title" onClose={onClose} desktop="drawer" frameClassName="inset-y-0 left-0 right-0 lg:right-96" className="max-h-[88vh] overflow-y-auto bg-surface p-section pb-0">
      <div className="mx-auto w-full max-w-[680px] rail:flex rail:min-h-full rail:max-w-none rail:flex-col">
        <div className="mx-auto mb-tight h-1 w-10 rounded-full bg-line rail:hidden" aria-hidden />
        <div className="mb-section flex items-center gap-comfortable">
          <ProductThumb name={event.title} bookingType="BT-15" size="thumb" />
          <div className="min-w-0 flex-1">
            <h2 id="sheet-title" className="break-words text-lg font-semibold leading-snug text-fg sm:text-xl">{event.title}</h2>
            <p className="mt-inline text-sm text-muted">
              {formatDay(event.startsAt.slice(0, 10), { weekday: true })}
              {multi ? ` · ${t("event.runsDays", { count: days.length })}` : ""} · {event.venueName}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("sheet.close")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-subtle text-muted transition-colors duration-quick hover:text-fg active:bg-muted-wash"><X size={20} strokeWidth={1.75} /></button>
        </div>

        {/* WHICH DAY — only where there is a choice to make. */}
        {multi && (
          <section className="mb-section flex flex-col gap-tight">
            <TileLabel>{t("event.whichDay")}</TileLabel>
            <TileGrid cols={days.length >= 3 ? 3 : 2}>
              {days.map((d) => {
                const f = dayFill(event, d.id);
                const left = Math.max(0, f.cap - f.sold);
                const on = d.id === dayId;
                return (
                  <Tile key={d.id} selected={on} className="min-h-16" onClick={() => setDayId(d.id)}>
                    <TileText label={dayName(d, days.indexOf(d), (n) => t("event.dayN", { n }))} sub={formatDay(d.date)} extra={t("event.left", { count: left })} selected={on} />
                  </Tile>
                );
              })}
            </TileGrid>
          </section>
        )}

        {/* WHICH TICKET — each its own card with the round stepper. */}
        <section className="mb-section flex flex-col gap-tight">
          <TileLabel>{t("event.whichTicket")}</TileLabel>
          {offered.map((tier) => {
            const room = roomFor(tier);
            const n = qty[tier.id] ?? 0;
            const bundle = multi && isBundleTier(event, tier);
            return (
              <div key={tier.id} className="card-surface flex items-center justify-between gap-comfortable p-comfortable">
                <div className="min-w-0 flex-1">
                  <p className="text-md font-semibold leading-snug">
                    {tier.name}
                    {bundle && <span className="ml-inline text-sm font-normal text-muted">· {t("event.allDays")}</span>}
                  </p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums text-fg">
                    {tier.price === 0 ? t("event.free") : formatMoney(tier.price, currency)}
                  </p>
                  {room <= 0 ? (
                    <p className="text-sm text-muted">{t("event.soldOut")}</p>
                  ) : room <= 10 ? (
                    <p className="text-sm text-warning">{t("event.left", { count: room })}</p>
                  ) : null}
                </div>
                <Stepper variant="round" value={n} min={0} max={room} onChange={(v) => setQty((q) => ({ ...q, [tier.id]: v }))} lessLabel={t("sheet.less")} moreLabel={t("sheet.more")} />
              </div>
            );
          })}
        </section>

        <StickyFoot>
          <ActionBar
            docked="panel"
            tone="ground"
            summary={<FooterSummary lead={summaryLead([dayTitle, count > 0 ? t("event.summary", { count }) : t("event.pickTickets")])} price={total$} />}
            secondary={{ label: t("sheet.back"), icon: <ChevronLeft size={20} strokeWidth={2} aria-hidden />, onClick: onClose }}
            primary={{
              label: count ? t("event.add", { count }) : t("event.pickTickets"),
              icon: count ? <Plus size={20} strokeWidth={2.5} aria-hidden /> : undefined,
              onClick: () => submit(false),
              disabled: !count,
            }}
          />
        </StickyFoot>
      </div>
    </SheetShell>
  );
}
