"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { applyResourceRate } from "@/lib/api/slots";
import { durationOptions, formatDurationShort, productDurationPrice } from "@/lib/duration";
import { resolveProductPrice } from "@/lib/pricing";
import { taxRateFor } from "@/lib/tax";
import { formatClock, formatMoney, formatPriceShort } from "@/lib/format";
import {
  cheapestFreeResourceId,
  nextBookableDays,
  resourceTimeOptions,
  scheduleHoursOn,
  storefrontPattern,
  timeOptionsFor,
  getDailyRemaining,
} from "@/lib/storefront/pattern";
import { draftTotals, type BasketLine, type BasketTier } from "@/lib/storefront/basket";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import type { PriceTier, Product } from "@/lib/api/types";
import { DateChips } from "./DateChips";

const FALLBACK_CAP = 10;

const addMinutes = (time: string, minutes: number): string => {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * The questions a booking page asks, in order — and the questions differ by
 * pattern rather than being one form with some rows hidden. A field/lane hire
 * (`resource`) is ONE booking: picking the time is the whole decision, so
 * there is no ticket stepper, just "how long" (where the booking allows it)
 * and which field. Everything else — open entry, a daily cap, a fixed
 * session — sells tickets by the ticket, so it keeps the stepper.
 */
export function BookingPicker({ product }: { product: Product }) {
  const flow = useStorefrontFlow();
  const pattern = storefrontPattern(product.bookingType);
  const dates = useMemo(() => nextBookableDays(product, flow.now, 10), [product, flow.now]);
  const [date, setDate] = useState<string | null>(pattern === "open" ? null : (dates[0] ?? null));

  if (pattern === "resource") return <ResourceBooking product={product} date={date} setDate={setDate} dates={dates} />;
  return <TicketBooking product={product} pattern={pattern} date={date} setDate={setDate} dates={dates} />;
}

/* ── Shared bits ─────────────────────────────────────────────────────────── */

function DateSection({
  dates,
  date,
  setDate,
}: {
  dates: string[];
  date: string | null;
  setDate: (d: string) => void;
}) {
  const t = useTranslations("storefront");
  const flow = useStorefrontFlow();
  return (
    <section>
      <h2 className="type-label text-[12px] text-muted">{t("booking.dateLabel")}</h2>
      <DateChips
        dates={dates}
        value={date ?? ""}
        onChange={setDate}
        now={flow.now}
        labels={{
          today: t("booking.today"),
          tomorrow: t("booking.tomorrow"),
          pickDate: t("booking.pickDate"),
          previousMonth: t("booking.previousMonth"),
          nextMonth: t("booking.nextMonth"),
        }}
      />
    </section>
  );
}

function ExtrasSection({
  product,
  extras,
  setExtras,
}: {
  product: Product;
  extras: Record<string, boolean>;
  setExtras: (updater: (e: Record<string, boolean>) => Record<string, boolean>) => void;
}) {
  const t = useTranslations("storefront");
  if (!(product.addOns ?? []).length) return null;
  return (
    <section>
      <h2 className="type-label text-[12px] text-muted">{t("booking.extrasLabel")}</h2>
      <ul className="mt-tight divide-y divide-hairline rounded-md border border-hairline">
        {(product.addOns ?? []).map((a) => {
          const on = !!extras[a.id];
          return (
            <li key={a.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => setExtras((e) => ({ ...e, [a.id]: !e[a.id] }))}
                className="flex w-full items-center gap-comfortable p-card text-left"
              >
                <span
                  aria-hidden
                  className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border", on ? "border-ember bg-ember-solid text-white" : "border-line")}
                >
                  {on && <Check size={14} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{a.name}</span>
                  <span className="block text-[13px] text-muted">
                    {formatPriceShort(a.price)}
                    {a.perPerson ? ` ${t("booking.perPerson")}` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Footer({ total, missing, onAdd, onBookNow }: { total: number; missing: string | null; onAdd: () => void; onBookNow: () => void }) {
  const t = useTranslations("storefront");
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-col gap-tight px-gutter py-tight">
        <div className="flex items-center justify-between gap-comfortable">
          <div className="min-w-0">
            <p className="text-[13px] text-muted">{t("booking.total")}</p>
            <p className="text-[20px] font-semibold tabular-nums">{formatMoney(total)}</p>
          </div>
          <div className="flex shrink-0 gap-tight">
            <Button variant="secondary" onClick={onAdd} disabled={!!missing}>
              {t("booking.addToBasket")}
            </Button>
            <Button variant="primary" onClick={onBookNow} disabled={!!missing}>
              {t("booking.bookNow")}
            </Button>
          </div>
        </div>
        {missing && <p className="text-[13px] text-warning">{missing}</p>}
      </div>
    </div>
  );
}

/* ── Field / lane hire — one booking, no ticket count ───────────────────────
 *
 * The time pick itself adds the hour: there is nothing here to count, so the
 * old "HOW MANY — Slot 0" stepper is gone. What is asked, in order: when,
 * how long (only where the booking allows a choice), which field (only where
 * there is more than one), then the time — and the total updates the moment
 * a time is chosen, because that is the one decision this pattern has. */
function ResourceBooking({
  product,
  date,
  setDate,
  dates,
}: {
  product: Product;
  date: string | null;
  setDate: (d: string) => void;
  dates: string[];
}) {
  const t = useTranslations("storefront");
  const flow = useStorefrontFlow();
  const taxRate = taxRateFor(product, flow.operator) / 100;
  const tier = product.tiers.find((x) => x.active) ?? product.tiers[0];
  const resourceObjs = flow.resources.filter((r) => (product.resourceIds ?? []).includes(r.id));
  const nounSingular = resourceObjs[0]?.nounSingular ?? "field";
  const nounPlural = resourceObjs[0]?.nounPlural ?? "Fields";

  const durationChoices = product.durationConfig ? durationOptions(product.durationConfig) : [];
  const fallbackMinutes = product.schedule?.sessionMinutes || product.schedule?.slotMinutes || 60;
  const [duration, setDuration] = useState<number>(durationChoices[0] ?? fallbackMinutes);
  const [resourceChoice, setResourceChoice] = useState<string | null>(null); // null = "any"
  const [time, setTime] = useState<string | null>(null);
  const [extras, setExtras] = useState<Record<string, boolean>>({});

  const timeOptions = useMemo(
    () => (date ? resourceTimeOptions(product, date, duration, resourceChoice) : []),
    [product, date, duration, resourceChoice],
  );

  const priceAt = (time2: string): number =>
    product.durationConfig
      ? productDurationPrice(product, date!, time2, duration, tier?.price ?? 0)
      : resolveProductPrice(product, date!, time2, tier?.price ?? 0);

  // The reference price this date's board opens on, so a cell is only
  // flagged when it genuinely differs — the same rule the till's own slot
  // grid follows, read off the time rather than off a particular resource
  // (an operator's per-field rate is a separate, smaller variance applied
  // once a field is actually assigned, below).
  const referencePrice = useMemo(() => {
    if (!date || !product.schedule) return tier?.price ?? 0;
    return priceAt(scheduleHoursOn(product.schedule, date).startTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, duration]);

  const chosenOption = timeOptions.find((o) => o.time === time) ?? null;
  const resolvedResourceId = chosenOption
    ? (resourceChoice ?? cheapestFreeResourceId(resourceObjs.map((r) => r.id), chosenOption.freeIds, (id) => {
        const res = resourceObjs.find((r) => r.id === id) ?? null;
        return applyResourceRate(priceAt(time!), duration, res);
      }))
    : null;
  const resolvedResource = resourceObjs.find((r) => r.id === resolvedResourceId) ?? null;
  const unitPrice = time ? applyResourceRate(priceAt(time), duration, resolvedResource) : 0;
  const cellPrice = (t2: string) => applyResourceRate(priceAt(t2), duration, null);

  const totalGuests = tier?.admits ?? 1;
  const activeExtras = (product.addOns ?? []).filter((a) => extras[a.id]);
  const extrasSubtotal = activeExtras.reduce((s, a) => s + a.price * (a.perPerson ? Math.max(1, totalGuests) : 1), 0);

  const basketTiers: BasketTier[] = time && tier ? [{ tierId: tier.id, tierName: tier.name, price: unitPrice, admits: tier.admits ?? 1, qty: 1 }] : [];
  const totals = draftTotals(basketTiers, taxRate);
  const total = totals.total + Math.round(extrasSubtotal * (1 + taxRate));

  const missing = !date ? t("booking.missingDate") : !time ? t("booking.missingTime") : null;

  const buildLine = (): Omit<BasketLine, "id"> => {
    const tierLines: BasketTier[] = time && tier ? [{ tierId: tier.id, tierName: tier.name, price: unitPrice, admits: tier.admits ?? 1, qty: 1 }] : [];
    for (const a of activeExtras) {
      tierLines.push({ tierId: `addon_${a.id}`, tierName: a.name, price: a.price, admits: 0, qty: a.perPerson ? Math.max(1, totalGuests) : 1 });
    }
    return {
      productId: product.id,
      productName: product.name,
      taxClass: product.taxClass,
      date,
      startTime: time,
      endTime: time ? addMinutes(time, duration) : null,
      resourceId: resolvedResourceId,
      resourceName: resolvedResource?.name ?? null,
      tiers: tierLines,
    };
  };
  const addToBasket = () => {
    flow.addLine(buildLine());
    flow.goVenue();
  };
  const bookNow = () => {
    flow.addLine(buildLine());
    flow.goCheckout();
  };

  return (
    <div className="flex flex-col gap-major pb-28">
      <h2 className="text-base font-semibold tracking-[-0.4px]">{t("booking.chooseTimeTitle")}</h2>

      <DateSection dates={dates} date={date} setDate={(d) => { setDate(d); setTime(null); }} />

      {resourceObjs.length > 1 && (
        <section>
          <h2 className="type-label text-[12px] text-muted">{nounPlural}</h2>
          <div className="mt-tight flex flex-wrap gap-tight">
            <button
              type="button"
              aria-pressed={resourceChoice === null}
              onClick={() => { setResourceChoice(null); setTime(null); }}
              className={cn(
                "flex min-h-11 items-center rounded-sm border px-comfortable text-[13px] font-medium transition-colors duration-quick",
                resourceChoice === null ? "border-ember bg-ember/10 text-brand-foreground" : "border-line bg-card hover:border-strong",
              )}
            >
              {/* The resource's own name stays capitalised on its chip
                  ("Outdoor Field"); mid-sentence here it reads as a common
                  noun, so it's lowercased the way "field" already was in the
                  no-resource fallback. */}
              {t("booking.anyResource", { noun: nounSingular.toLowerCase() })}
            </button>
            {resourceObjs.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={resourceChoice === r.id}
                onClick={() => { setResourceChoice(r.id); setTime(null); }}
                className={cn(
                  "flex min-h-11 items-center rounded-sm border px-comfortable text-[13px] font-medium transition-colors duration-quick",
                  resourceChoice === r.id ? "border-ember bg-ember/10 text-brand-foreground" : "border-line bg-card hover:border-strong",
                )}
              >
                {r.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {durationChoices.length > 1 && (
        <section>
          <h2 className="type-label text-[12px] text-muted">{t("booking.howLong")}</h2>
          <div className="mt-tight flex flex-wrap gap-tight">
            {durationChoices.map((mins) => {
              const on = duration === mins;
              const price = date ? priceAt(scheduleHoursOn(product.schedule!, date).startTime) : 0;
              return (
                <button
                  key={mins}
                  type="button"
                  aria-pressed={on}
                  onClick={() => { setDuration(mins); setTime(null); }}
                  className={cn(
                    "flex min-h-11 flex-col items-center justify-center rounded-sm border px-comfortable py-inline text-center transition-colors duration-quick",
                    on ? "border-ember bg-ember/10 text-brand-foreground" : "border-line bg-card hover:border-strong",
                  )}
                >
                  <span className="text-[13px] font-medium">{formatDurationShort(mins)}</span>
                  <span className={cn("text-[12px]", on ? "text-brand-foreground/80" : "text-muted")}>{formatPriceShort(price)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {date && (
        <section>
          <h2 className="type-label text-[12px] text-muted">{t("booking.timeLabel")}</h2>
          {timeOptions.length === 0 ? (
            <p className="mt-tight text-[14px] text-muted">{t("booking.noTimes")}</p>
          ) : (
            <div className="mt-tight grid grid-cols-3 gap-tight sm:grid-cols-4">
              {timeOptions.map((opt) => {
                const sold = opt.freeIds.length === 0;
                const on = time === opt.time;
                const price = cellPrice(opt.time);
                const showPrice = price !== referencePrice;
                return (
                  <button
                    key={opt.time}
                    type="button"
                    disabled={sold}
                    aria-pressed={on}
                    onClick={() => setTime(opt.time)}
                    className={cn(
                      "flex min-h-12 flex-col items-center justify-center rounded-sm border px-tight py-tight text-center transition-colors duration-quick",
                      sold
                        ? "border-line bg-subtle text-muted line-through"
                        : on
                          ? "border-ember bg-ember/10 ring-1 ring-inset ring-ember text-brand-foreground"
                          : "border-line bg-card hover:border-strong",
                    )}
                  >
                    <span className="text-[13px] font-medium">{formatClock(opt.time)}</span>
                    {!sold && showPrice && <span className="text-[12px] text-muted">{formatPriceShort(price)}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      <ExtrasSection product={product} extras={extras} setExtras={setExtras} />
      <Footer total={total} missing={missing} onAdd={addToBasket} onBookNow={bookNow} />
    </div>
  );
}

/* ── Open entry · daily cap · fixed sessions — sold by the ticket ──────────── */
function TicketBooking({
  product,
  pattern,
  date,
  setDate,
  dates,
}: {
  product: Product;
  pattern: "open" | "daily" | "sessions";
  date: string | null;
  setDate: (d: string) => void;
  dates: string[];
}) {
  const t = useTranslations("storefront");
  const flow = useStorefrontFlow();
  const needsDate = pattern !== "open";
  const needsTime = pattern === "sessions";
  const taxRate = taxRateFor(product, flow.operator) / 100;
  const tiers = product.tiers.filter((t2) => t2.active);

  const [time, setTime] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [extras, setExtras] = useState<Record<string, boolean>>({});

  const timeOptions = useMemo(() => (needsTime && date ? timeOptionsFor(product, date) : []), [needsTime, date, product]);
  const chosenTime = useMemo(() => timeOptions.find((o) => o.time === time) ?? null, [timeOptions, time]);

  const dailyRemaining = pattern === "daily" && date ? getDailyRemaining(product, date) : Infinity;
  const slotCap = needsTime ? (chosenTime?.remaining ?? 0) : dailyRemaining;
  const cap = Number.isFinite(slotCap) ? slotCap : FALLBACK_CAP;

  const totalGuests = tiers.reduce((s, tr) => s + (tr.admits ?? 1) * (qty[tr.id] ?? 0), 0);

  const basketTiers: BasketTier[] = tiers
    .filter((tr) => (qty[tr.id] ?? 0) > 0)
    .map((tr) => ({ tierId: tr.id, tierName: tr.name, price: tr.price, admits: tr.admits ?? 1, qty: qty[tr.id] ?? 0, donation: tr.donation, ageNote: tr.ageNote }));

  const activeExtras = (product.addOns ?? []).filter((a) => extras[a.id]);
  const extrasSubtotal = activeExtras.reduce((s, a) => s + a.price * (a.perPerson ? Math.max(1, totalGuests) : 1), 0);
  const totals = draftTotals(basketTiers, taxRate);
  const total = totals.total + Math.round(extrasSubtotal * (1 + taxRate));

  const setTierQty = (tr: PriceTier, next: number) => {
    const bounded = Math.max(0, Math.min(next, tr.maxPerOrder ?? cap));
    setQty((q) => ({ ...q, [tr.id]: bounded }));
  };

  const missing = !needsDate
    ? !totalGuests
      ? t("booking.missingTickets")
      : null
    : !date
      ? t("booking.missingDate")
      : needsTime && !time
        ? t("booking.missingTime")
        : !totalGuests
          ? t("booking.missingTickets")
          : null;

  const buildLine = (): Omit<BasketLine, "id"> => {
    const tierLines = basketTiers.map((bt) => ({ ...bt }));
    for (const a of activeExtras) {
      tierLines.push({ tierId: `addon_${a.id}`, tierName: a.name, price: a.price, admits: 0, qty: a.perPerson ? Math.max(1, totalGuests) : 1 });
    }
    return { productId: product.id, productName: product.name, taxClass: product.taxClass, date, startTime: time, endTime: null, resourceId: null, resourceName: null, tiers: tierLines };
  };
  const addToBasket = () => {
    flow.addLine(buildLine());
    flow.goVenue();
  };
  const bookNow = () => {
    flow.addLine(buildLine());
    flow.goCheckout();
  };

  return (
    <div className="flex flex-col gap-major pb-28">
      <h2 className="text-base font-semibold tracking-[-0.4px]">{t("booking.chooseTitle")}</h2>

      {needsDate && <DateSection dates={dates} date={date} setDate={(d) => { setDate(d); setTime(null); }} />}

      {needsTime && date && (
        <section>
          <h2 className="type-label text-[12px] text-muted">{t("booking.timeLabel")}</h2>
          {timeOptions.length === 0 ? (
            <p className="mt-tight text-[14px] text-muted">{t("booking.noTimes")}</p>
          ) : (
            <div className="mt-tight grid grid-cols-3 gap-tight sm:grid-cols-4">
              {timeOptions.map((opt) => {
                const sold = opt.remaining <= 0;
                const on = time === opt.time;
                return (
                  <button
                    key={opt.time}
                    type="button"
                    disabled={sold}
                    aria-pressed={on}
                    onClick={() => setTime(opt.time)}
                    className={cn(
                      "flex min-h-12 flex-col items-center justify-center rounded-sm border px-tight py-tight text-center transition-colors duration-quick",
                      sold
                        ? "border-line bg-subtle text-muted line-through"
                        : on
                          ? "border-ember bg-ember/10 ring-1 ring-inset ring-ember text-brand-foreground"
                          : "border-line bg-card hover:border-strong",
                    )}
                  >
                    <span className="text-[13px] font-medium">{formatClock(opt.time)}</span>
                    {!sold && <span className="text-[12px] text-muted">{t("booking.left", { count: opt.remaining })}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {pattern === "daily" && date && Number.isFinite(dailyRemaining) && (
        <p className="text-[13px] text-muted">{t("booking.dailyLeft", { count: dailyRemaining })}</p>
      )}

      <section>
        <h2 className="type-label text-[12px] text-muted">{t("booking.ticketsLabel")}</h2>
        {tiers.length === 0 ? (
          <p className="mt-tight text-[14px] text-muted">{t("askAtTheDoor")}</p>
        ) : (
          <ul className="mt-tight divide-y divide-hairline rounded-md border border-hairline">
            {tiers.map((tr) => {
              const n = qty[tr.id] ?? 0;
              const disabledAdd = needsDate && (!date || (needsTime && !time));
              return (
                <li key={tr.id} className="flex items-center gap-comfortable p-card">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{tr.name}</p>
                    {(tr.ageNote || (tr.admits ?? 1) > 1) && (
                      <p className="text-[12px] text-muted">
                        {[tr.ageNote, (tr.admits ?? 1) > 1 ? t("admits", { count: tr.admits ?? 1 }) : null].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {tr.note && <p className="mt-inline text-[13px] text-fg/80">{tr.note}</p>}
                    <p className="mt-inline text-[13px] font-semibold text-brand-foreground">
                      {tr.donation ? t("donationFrom", { price: formatMoney(tr.price) }) : tr.price === 0 ? t("free") : formatPriceShort(tr.price)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-tight">
                    <button
                      type="button"
                      aria-label={t("booking.decreaseQty", { name: tr.name })}
                      disabled={n <= 0}
                      onClick={() => setTierQty(tr, n - 1)}
                      className="flex h-11 w-11 items-center justify-center rounded-sm border border-line text-fg disabled:opacity-40"
                    >
                      <Minus size={16} strokeWidth={2} aria-hidden />
                    </button>
                    <span className="w-6 text-center text-[15px] font-semibold tabular-nums">{n}</span>
                    <button
                      type="button"
                      aria-label={t("booking.increaseQty", { name: tr.name })}
                      disabled={disabledAdd || n >= (tr.maxPerOrder ?? cap)}
                      onClick={() => setTierQty(tr, n + 1)}
                      className="flex h-11 w-11 items-center justify-center rounded-sm border border-line text-fg disabled:opacity-40"
                    >
                      <Plus size={16} strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ExtrasSection product={product} extras={extras} setExtras={setExtras} />
      <Footer total={total} missing={missing} onAdd={addToBasket} onBookNow={bookNow} />
    </div>
  );
}
