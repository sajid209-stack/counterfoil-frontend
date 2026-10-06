"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Info, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { applyResourceRate } from "@/lib/api/slots";
import { durationOptions, formatDuration, productDurationPrice } from "@/lib/duration";
import { resolveProductPrice } from "@/lib/pricing";
import { taxRateFor } from "@/lib/tax";
import { formatClock, formatMoney, formatPriceShort } from "@/lib/format";
import {
  cheapestFreeResourceId,
  defaultDuration,
  firstResourceTime,
  firstSessionTime,
  firstUsableDate,
  nextBookableDays,
  resourceTimeOptions,
  scheduleHoursOn,
  storefrontPattern,
  timeOptionsFor,
  getDailyRemaining,
} from "@/lib/storefront/pattern";
import { draftTotals, type BasketLine, type BasketTier } from "@/lib/storefront/basket";
import { fromPrice } from "@/lib/storefront/facts";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import type { PriceTier, Product } from "@/lib/api/types";
import { sfBtn } from "../sf";
import { DateChips } from "./DateChips";

const FALLBACK_CAP = 10;

const addMinutes = (time: string, minutes: number): string => {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * The questions a booking page asks, in order, and the questions differ by
 * pattern rather than being one form with some rows hidden. A field/lane hire
 * (`resource`) is ONE booking: picking the time is the whole decision, so
 * there is no ticket stepper, just "how long" (where the booking allows it)
 * and which field. Everything else (open entry, a daily cap, a fixed session)
 * sells tickets by the ticket, so it keeps the stepper.
 *
 * It is drawn as the contents of the booking panel: sticky beside the page on
 * a desktop, in the page on a phone with its total and buttons fixed to the
 * bottom of the screen. One copy of the controls, never two.
 */
export function BookingPicker({ product, sheet }: { product: Product; sheet?: SheetHooks }) {
  const flow = useStorefrontFlow();
  const pattern = storefrontPattern(product.bookingType);
  const dates = useMemo(() => nextBookableDays(product, flow.now, 10), [product, flow.now]);
  /* In the quick-add sheet the picker opens on the first day that has
     something to buy (today if it is open and not full); on the full page it
     opens on the first open day and leaves the rest to the guest. */
  const [date, setDate] = useState<string | null>(
    pattern === "open" ? null : sheet ? firstUsableDate(product, dates) : (dates[0] ?? null),
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", sheet && "h-full")}>
      {pattern === "resource" ? (
        <ResourceBooking product={product} date={date} setDate={setDate} dates={dates} sheet={sheet} />
      ) : (
        <TicketBooking product={product} pattern={pattern} date={date} setDate={setDate} dates={dates} sheet={sheet} />
      )}
    </div>
  );
}

/** What the quick-add sheet hands the picker: it changes the picker's frame
 *  (no heading, a footer that sits in the sheet rather than the page) and what
 *  "Add" and "Book now" do (the sheet closes and confirms), never the
 *  questions it asks. `null` for the full booking page. */
export interface SheetHooks {
  onAdd: (line: Omit<BasketLine, "id">) => void;
  onBook: (line: Omit<BasketLine, "id">) => void;
}

/* ── Shared bits ─────────────────────────────────────────────────────────── */

/** A labelled group of controls. The label is always attached to the thing it
 *  names, so a heading can never be left alone above nothing. */
function Step({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-tight text-[15px] font-semibold">{label}</h3>
      {children}
    </section>
  );
}

const choiceCls = (on: boolean) =>
  cn(
    "flex min-h-11 items-center justify-center rounded-[12px] border px-section text-[14px] font-medium transition-colors duration-quick",
    on ? "border-[var(--sf-fill)] bg-[var(--sf-soft)] text-fg ring-1 ring-inset ring-[var(--sf-fill)]" : "border-line bg-white hover:border-strong",
  );

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
    <Step label={t("booking.dateLabel")}>
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
    </Step>
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
    <Step label={t("booking.extrasLabel")}>
      <ul className="divide-y divide-hairline rounded-[12px] border border-line">
        {(product.addOns ?? []).map((a) => {
          const on = !!extras[a.id];
          return (
            <li key={a.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => setExtras((e) => ({ ...e, [a.id]: !e[a.id] }))}
                className="flex min-h-14 w-full items-center gap-comfortable p-comfortable text-left"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border",
                    on ? "border-[var(--sf-fill)] bg-[var(--sf-fill)] text-[var(--sf-on-fill)]" : "border-strong bg-white",
                  )}
                >
                  {on && <Check size={14} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{a.name}</span>
                  <span className="tnum block text-[14px] text-muted">
                    {formatPriceShort(a.price)}
                    {a.perPerson ? ` ${t("booking.perPerson")}` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Step>
  );
}

/** The total and the two ways forward. Fixed to the bottom of a phone; on a
 *  desktop it is the foot of the sticky booking panel. Before anything is
 *  chosen it says what the booking costs from, not a total of nothing. */
function Footer({
  total,
  from,
  missing,
  onAdd,
  onBookNow,
  inSheet,
}: {
  total: number;
  from: number | null;
  missing: string | null;
  onAdd: () => void;
  onBookNow: () => void;
  inSheet?: boolean;
}) {
  const t = useTranslations("storefront");
  const chosen = total > 0;
  return (
    <div
      data-sf-bookbar
      className={
        inSheet
          ? "shrink-0 border-t border-hairline bg-white px-section pb-section pt-comfortable"
          : "fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-white/95 px-gutter pb-comfortable pt-comfortable shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur lg:static lg:mt-section lg:border-line lg:bg-transparent lg:p-0 lg:pt-section lg:shadow-none lg:backdrop-blur-none"
      }
    >
      {missing && (
        <p className="mb-tight flex items-center gap-tight text-[14px] font-medium text-warning">
          <Info size={16} strokeWidth={1.75} className="shrink-0" aria-hidden />
          {missing}
        </p>
      )}
      <div className="flex items-baseline gap-tight">
        <p className="text-[14px] text-muted">{chosen ? t("booking.total") : t("from")}</p>
        <p className="tnum text-[24px] font-semibold leading-none tracking-[-0.01em]">
          {chosen ? formatMoney(total) : from === null ? "—" : from === 0 ? t("free") : formatPriceShort(from)}
        </p>
      </div>
      {inSheet ? (
        /* In the sheet "Add to basket" is the primary: the guest chose to
           quick-add, so staying on the list is the common case. */
        <div className="mt-comfortable grid grid-cols-2 gap-tight">
          <button type="button" onClick={onBookNow} disabled={!!missing} className={cn(sfBtn.secondary, "px-section")}>
            {t("booking.bookNow")}
          </button>
          <button type="button" onClick={onAdd} disabled={!!missing} className={cn(sfBtn.primary, "px-section")}>
            {t("booking.addToBasket")}
          </button>
        </div>
      ) : (
        <div className="mt-comfortable grid grid-cols-2 gap-tight lg:grid-cols-1">
          <button type="button" onClick={onAdd} disabled={!!missing} className={sfBtn.secondary}>
            {t("booking.addToBasket")}
          </button>
          <button type="button" onClick={onBookNow} disabled={!!missing} className={cn(sfBtn.primary, "lg:order-first")}>
            {t("booking.bookNow")}
          </button>
        </div>
      )}
    </div>
  );
}

/** The panel's scrolling body. On a desktop the panel is as tall as the window
 *  at most, so this scrolls and the footer stays in view. In the sheet the
 *  sheet's own header names the booking, so there is no heading here, and the
 *  body scrolls at every width. */
function Body({ title, children, inSheet }: { title: string; children: React.ReactNode; inSheet?: boolean }) {
  if (inSheet) {
    return <div className="flex min-h-0 flex-1 flex-col gap-major overflow-y-auto px-section pb-major pt-section [mask-image:linear-gradient(to_bottom,black_calc(100%-20px),transparent)]">{children}</div>;
  }
  return (
    <div className="flex flex-col gap-major lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-1 lg:pt-1 lg:pb-6 lg:[mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]">
      <h2 className="text-[20px] font-semibold tracking-[-0.01em]">{title}</h2>
      {children}
    </div>
  );
}

/* ── Field / lane hire: one booking, no ticket count ───────────────────────
 *
 * The time pick itself adds the hour: there is nothing here to count. What is
 * asked, in order: when, how long (only where the booking allows a choice),
 * which field (only where there is more than one), then the time. The total
 * updates the moment a time is chosen, because that is the one decision this
 * pattern has. */
function ResourceBooking({
  product,
  date,
  setDate,
  dates,
  sheet,
}: {
  product: Product;
  date: string | null;
  setDate: (d: string) => void;
  dates: string[];
  sheet?: SheetHooks;
}) {
  const t = useTranslations("storefront");
  const flow = useStorefrontFlow();
  const taxRate = taxRateFor(product, flow.operator) / 100;
  const tier = product.tiers.find((x) => x.active) ?? product.tiers[0];
  const resourceObjs = flow.resources.filter((r) => (product.resourceIds ?? []).includes(r.id));
  const nounSingular = resourceObjs[0]?.nounSingular ?? "field";
  const nounPlural = resourceObjs[0]?.nounPlural ?? "Fields";

  const durationChoices = product.durationConfig ? durationOptions(product.durationConfig) : [];
  const [duration, setDuration] = useState<number>(defaultDuration(product));
  const [resourceChoice, setResourceChoice] = useState<string | null>(null); // null = "any"
  /* The sheet opens on the first start that can be bought, so one tap can add;
     the page leaves the choice to the guest. */
  const firstStart = (d: string | null, dur: number, res: string | null): string | null =>
    sheet && d ? (firstResourceTime(product, d, dur, res)?.time ?? null) : null;
  const [time, setTime] = useState<string | null>(() => firstStart(date, defaultDuration(product), null));
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
  // flagged when it genuinely differs, the same rule the till's own slot grid
  // follows, read off the time rather than off a particular resource (an
  // operator's per-field rate is a separate, smaller variance applied once a
  // field is actually assigned, below).
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
    if (sheet) return sheet.onAdd(buildLine());
    flow.addLine(buildLine());
    flow.goVenue();
  };
  const bookNow = () => {
    if (sheet) return sheet.onBook(buildLine());
    flow.addLine(buildLine());
    flow.goCheckout();
  };

  return (
    <>
      <Body title={t("booking.chooseTimeTitle")} inSheet={!!sheet}>
        <DateSection dates={dates} date={date} setDate={(d) => { setDate(d); setTime(firstStart(d, duration, resourceChoice)); }} />

        {resourceObjs.length > 1 && (
          <Step label={nounPlural}>
            <div className="flex flex-wrap gap-tight">
              <button
                type="button"
                aria-pressed={resourceChoice === null}
                onClick={() => { setResourceChoice(null); setTime(firstStart(date, duration, null)); }}
                className={choiceCls(resourceChoice === null)}
              >
                {/* The resource's own name stays capitalised on its chip
                    ("Outdoor Field"); mid-sentence here it reads as a common
                    noun, so it is lowercased the way "field" already was in
                    the no-resource fallback. */}
                {t("booking.anyResource", { noun: nounSingular.toLowerCase() })}
              </button>
              {resourceObjs.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={resourceChoice === r.id}
                  onClick={() => { setResourceChoice(r.id); setTime(firstStart(date, duration, r.id)); }}
                  className={choiceCls(resourceChoice === r.id)}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </Step>
        )}

        {durationChoices.length > 1 && (
          <Step label={t("booking.howLong")}>
            <div className="flex flex-wrap gap-tight">
              {durationChoices.map((mins) => {
                const on = duration === mins;
                const price = date ? priceAt(scheduleHoursOn(product.schedule!, date).startTime) : 0;
                return (
                  <button
                    key={mins}
                    type="button"
                    aria-pressed={on}
                    onClick={() => { setDuration(mins); setTime(firstStart(date, mins, resourceChoice)); }}
                    className={cn(choiceCls(on), "min-h-14 flex-col gap-0.5 py-inline")}
                  >
                    <span>{formatDuration(mins)}</span>
                    <span className="tnum text-[12px] font-normal text-muted">{formatPriceShort(price)}</span>
                  </button>
                );
              })}
            </div>
          </Step>
        )}

        {date && (
          <Step label={t("booking.timeLabel")}>
            {timeOptions.length === 0 ? (
              <p className="text-[14px] text-muted">{t("booking.noTimes")}</p>
            ) : (
              <div className="grid grid-cols-3 gap-tight">
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
                      className={cn(choiceCls(on), "min-h-12 flex-col px-tight py-tight", sold && "border-line bg-subtle text-muted line-through hover:border-line")}
                    >
                      <span>{formatClock(opt.time)}</span>
                      {!sold && showPrice && <span className="tnum text-[12px] font-normal text-muted">{formatPriceShort(price)}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </Step>
        )}

        <ExtrasSection product={product} extras={extras} setExtras={setExtras} />
      </Body>
      <Footer total={total} from={tier?.price ?? null} missing={missing} onAdd={addToBasket} onBookNow={bookNow} inSheet={!!sheet} />
    </>
  );
}

/* ── Open entry · daily cap · fixed sessions: sold by the ticket ──────────── */
function TicketBooking({
  product,
  pattern,
  date,
  setDate,
  dates,
  sheet,
}: {
  product: Product;
  pattern: "open" | "daily" | "sessions";
  date: string | null;
  setDate: (d: string) => void;
  dates: string[];
  sheet?: SheetHooks;
}) {
  const t = useTranslations("storefront");
  const flow = useStorefrontFlow();
  const needsDate = pattern !== "open";
  const needsTime = pattern === "sessions";
  const taxRate = taxRateFor(product, flow.operator) / 100;
  const tiers = product.tiers.filter((t2) => t2.active);

  /* The sheet opens ready: the first time with room and one ticket of the
     first type, so a guest whose defaults suit adds in one tap. Changing the
     day moves to that day's first time and keeps what the day can still hold. */
  const firstTime = (d: string | null): { time: string; remaining: number } | null =>
    sheet && needsTime && d ? firstSessionTime(product, d) : null;
  const startRoom = (d: string | null, t0: string | null): number => {
    if (needsTime) return t0 ? (timeOptionsFor(product, d ?? "").find((o) => o.time === t0)?.remaining ?? 0) : 0;
    if (pattern === "daily" && d) {
      const left = getDailyRemaining(product, d);
      return Number.isFinite(left) ? left : FALLBACK_CAP;
    }
    return FALLBACK_CAP;
  };
  const [time, setTime] = useState<string | null>(() => firstTime(date)?.time ?? null);
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const first = tiers[0];
    if (!sheet || !first) return {};
    if (needsDate && !date) return {};
    const room = startRoom(date, firstTime(date)?.time ?? null);
    return room >= 1 ? { [first.id]: 1 } : {};
  });
  const [extras, setExtras] = useState<Record<string, boolean>>({});
  const changeDate = (d: string) => {
    setDate(d);
    const t0 = firstTime(d)?.time ?? null;
    setTime(t0);
    if (sheet) {
      const room = startRoom(d, t0);
      setQty((q) => Object.fromEntries(Object.entries(q).map(([k, v]) => [k, Math.min(v, room)])));
    }
  };

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
    if (sheet) return sheet.onAdd(buildLine());
    flow.addLine(buildLine());
    flow.goVenue();
  };
  const bookNow = () => {
    if (sheet) return sheet.onBook(buildLine());
    flow.addLine(buildLine());
    flow.goCheckout();
  };

  return (
    <>
      <Body title={t("booking.chooseTitle")} inSheet={!!sheet}>
        {needsDate && <DateSection dates={dates} date={date} setDate={changeDate} />}

        {needsTime && date && (
          <Step label={t("booking.timeLabel")}>
            {timeOptions.length === 0 ? (
              <p className="text-[14px] text-muted">{t("booking.noTimes")}</p>
            ) : (
              <div className="grid grid-cols-3 gap-tight">
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
                      className={cn(choiceCls(on), "min-h-12 flex-col px-tight py-tight", sold && "border-line bg-subtle text-muted line-through hover:border-line")}
                    >
                      <span>{formatClock(opt.time)}</span>
                      {!sold && <span className="text-[12px] font-normal text-muted">{t("booking.left", { count: opt.remaining })}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </Step>
        )}

        {pattern === "daily" && date && Number.isFinite(dailyRemaining) && (
          <p className="-mt-tight text-[14px] text-muted">{t("booking.dailyLeft", { count: dailyRemaining })}</p>
        )}

        <Step label={t("booking.ticketsLabel")}>
          {tiers.length === 0 ? (
            <p className="text-[14px] text-muted">{t("askAtTheDoor")}</p>
          ) : (
            <ul className="divide-y divide-hairline rounded-[12px] border border-line">
              {tiers.map((tr) => {
                const n = qty[tr.id] ?? 0;
                const disabledAdd = needsDate && (!date || (needsTime && !time));
                return (
                  <li key={tr.id} className="flex items-center gap-comfortable p-comfortable">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold">{tr.name}</p>
                      <p className="tnum text-[15px] font-semibold text-[var(--sf-ink)]">
                        {tr.donation ? t("donationFrom", { price: formatMoney(tr.price) }) : tr.price === 0 ? t("free") : formatPriceShort(tr.price)}
                      </p>
                      {(tr.ageNote || (tr.admits ?? 1) > 1) && (
                        <p className="text-[14px] text-muted">
                          {[tr.ageNote, (tr.admits ?? 1) > 1 ? t("admits", { count: tr.admits ?? 1 }) : null].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {tr.note && <p className="mt-inline text-[14px] leading-snug text-muted">{tr.note}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-tight">
                      <button
                        type="button"
                        aria-label={t("booking.decreaseQty", { name: tr.name })}
                        disabled={n <= 0}
                        onClick={() => setTierQty(tr, n - 1)}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-strong bg-white text-fg transition-colors hover:border-fg disabled:border-line disabled:text-faint"
                      >
                        <Minus size={16} strokeWidth={2} aria-hidden />
                      </button>
                      <span className="tnum w-6 text-center text-[16px] font-semibold">{n}</span>
                      <button
                        type="button"
                        aria-label={t("booking.increaseQty", { name: tr.name })}
                        disabled={disabledAdd || n >= (tr.maxPerOrder ?? cap)}
                        onClick={() => setTierQty(tr, n + 1)}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-strong bg-white text-fg transition-colors hover:border-fg disabled:border-line disabled:text-faint"
                      >
                        <Plus size={16} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Step>

        <ExtrasSection product={product} extras={extras} setExtras={setExtras} />
      </Body>
      <Footer total={total} from={fromPrice(product.tiers)} missing={missing} onAdd={addToBasket} onBookNow={bookNow} inSheet={!!sheet} />
    </>
  );
}
