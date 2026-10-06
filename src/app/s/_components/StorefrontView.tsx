"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, CalendarClock, Check, Clock, MapPin, MessageSquareText, Minus, Navigation, Plus, QrCode, ShieldCheck, Ticket, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Product } from "@/lib/api";
import { useBehaviourSubtitle } from "@/lib/behaviour";
import { formatClock, formatClockRange, formatPriceShort } from "@/lib/format";
import { formatDuration } from "@/lib/duration";
import { fromPrice, productMinutes } from "@/lib/storefront/facts";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import { isOneTap, nextAvailable, storefrontPattern } from "@/lib/storefront/pattern";
import { StorefrontChrome, directionsHref } from "./Chrome";
import { QuickAddSheet } from "./flow/QuickAddSheet";
import { QuickAddToast } from "./flow/QuickAddToast";
import { StickyBasketBar } from "./flow/StickyBasketBar";
import { GROUP_ORDER, HeroArt, Media, sfBtn, typeGroup, type TypeGroup } from "./sf";
import { WEEK_ORDER, useVenueHours } from "./useVenueHours";

/** Scrolls inside whichever document the click happened in. The editor's
 *  preview is an iframe, and `document` there would be the editor's. */
const scrollToId = (id: string) => (e: React.MouseEvent<HTMLElement>) => {
  e.currentTarget.ownerDocument.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

/**
 * A venue's public page, drawn from the flow's own data: the live route's
 * saved record, or the editor's draft, so a preview always shows the page being
 * typed rather than the one last saved.
 *
 * Reads everything from `useStorefrontFlow()` rather than props: live and
 * preview both provide the same shape through the one context, so this
 * component cannot drift between the two the way two copies would.
 *
 * Top to bottom: a hero (the headline, a way in, and the three facts a visitor
 * wants first), the reasons it is safe to book, what's on (large picture
 * cards, filtered by kind), then how to visit (hours with today marked, the
 * address with directions).
 */
export function StorefrontView() {
  const flow = useStorefrontFlow();
  const sf = flow.storefront;
  const location = flow.location;
  const products = flow.products;
  const t = useTranslations("storefront");
  const hours = useVenueHours(location, flow.now);
  const [group, setGroup] = useState<TypeGroup | "all">("all");
  const [quick, setQuick] = useState<{ product: Product; opener: HTMLElement } | null>(null);
  const [toast, setToast] = useState<{ name: string; key: number } | null>(null);

  /* Closing the sheet hands focus back to the button that opened it. */
  const closeQuick = () => {
    const opener = quick?.opener;
    setQuick(null);
    window.requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus();
    });
  };
  const confirmAdded = (p: Product) => setToast({ name: p.name, key: Date.now() });

  const groups = GROUP_ORDER.filter((g) => products.some((p) => typeGroup(p.bookingType) === g));
  const shown = group === "all" ? products : products.filter((p) => typeGroup(p.bookingType) === group);
  const prices = products.map((p) => fromPrice(p.tiers)).filter((x): x is number => x !== null);
  const cheapest = prices.length ? Math.min(...prices) : null;
  const todayRow = location.openingHours.find((h) => h.dayOfWeek === flow.now.getDay());

  return (
    <StorefrontChrome storefront={sf} location={location} poweredBy={t("poweredBy")} current="venue">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 items-center gap-major py-major lg:grid-cols-[1.05fr_1fr] lg:gap-hero lg:py-wide">
        <div className="min-w-0">
          <p className="inline-flex min-h-8 items-center gap-tight rounded-full bg-subtle px-comfortable text-[14px] font-medium">
            <span aria-hidden className={cn("h-2 w-2 rounded-full", hours.isOpen ? "bg-success" : "bg-[#8a8a85]")} />
            {hours.text}
          </p>
          <h1 className="mt-section break-words text-balance text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[44px] lg:text-[54px]">
            {sf.headline || location.name}
          </h1>
          {sf.intro && <p className="mt-section max-w-[56ch] text-[16px] leading-relaxed text-muted sm:text-[18px]">{sf.intro}</p>}
          <div className="mt-major flex flex-col gap-tight sm:flex-row">
            {products.length > 0 && (
              <button type="button" onClick={scrollToId("whats-on")} className={sfBtn.primary}>
                {t("hero.book")}
                <ArrowRight size={18} strokeWidth={2} aria-hidden />
              </button>
            )}
            <button type="button" onClick={scrollToId("visit")} className={sfBtn.secondary}>
              {t("hero.plan")}
            </button>
          </div>
          <ul className="mt-major flex flex-col gap-tight text-[14px] sm:flex-row sm:flex-wrap sm:gap-x-major">
            <li className="flex items-center gap-tight">
              <MapPin size={16} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
              <span>{[location.addressLine1, location.city].filter(Boolean).join(", ")}</span>
            </li>
            {todayRow && todayRow.intervals.length > 0 && (
              <li className="flex items-center gap-tight">
                <Clock size={16} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
                <span>{t("openToday", { hours: todayRow.intervals.map((i) => formatClockRange(i.opensAt, i.closesAt)).join(", ") })}</span>
              </li>
            )}
            {cheapest !== null && (
              <li className="flex items-center gap-tight">
                <Ticket size={16} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
                <span className="tnum">{cheapest === 0 ? t("free") : t("fromPrice", { price: formatPriceShort(cheapest) })}</span>
              </li>
            )}
          </ul>
        </div>
        <HeroArt
          src={sf.heroImage}
          name={location.name}
          city={location.city}
          seed={sf.id}
          stub={t("hero.stub")}
          className="order-first aspect-[16/10] rounded-[20px] lg:order-none lg:aspect-[4/3]"
        />
      </section>

      {/* ── Why it is safe to book ───────────────────────────────────────── */}
      <section aria-label={t("trust.label")} className="rounded-[16px] border border-hairline">
        <ul className="grid grid-cols-1 divide-y divide-hairline sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { Icon: ShieldCheck, title: t("trust.instantTitle"), body: t("trust.instantBody") },
            { Icon: MessageSquareText, title: t("trust.smsTitle"), body: t("trust.smsBody") },
            { Icon: Wallet, title: t("trust.payTitle"), body: t("trust.payBody") },
          ].map(({ Icon, title, body }) => (
            <li key={title} className="flex items-start gap-comfortable p-section">
              <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--sf-soft)] text-[var(--sf-ink)]">
                <Icon size={20} strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">{title}</p>
                <p className="text-[14px] text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── What's on ────────────────────────────────────────────────────── */}
      <section id="whats-on" className="pt-hero">
        <div className="flex flex-col gap-comfortable sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[26px] font-semibold tracking-[-0.02em] sm:text-[30px]">{t("whatsOn")}</h2>
            {products.length > 0 && <p className="mt-inline text-[14px] text-muted">{t("count", { count: products.length })}</p>}
          </div>
          {groups.length > 1 && (
            <div role="group" aria-label={t("filter.label")} className="-mx-gutter flex gap-tight overflow-x-auto px-gutter pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {(["all", ...groups] as const).map((g) => {
                const on = group === g;
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setGroup(g)}
                    className={cn(
                      "flex min-h-11 shrink-0 items-center rounded-full border px-section text-[14px] font-medium transition-colors duration-quick",
                      on ? "border-[var(--sf-fill)] bg-[var(--sf-fill)] text-[var(--sf-on-fill)]" : "border-line bg-white text-fg hover:border-fg",
                    )}
                  >
                    {t(`filter.${g}`)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {products.length === 0 ? (
          <p className="mt-section text-[16px] text-muted">{t("nothingOn")}</p>
        ) : (
          <ul className="mt-major grid grid-cols-1 gap-major sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} onQuickAdd={(prod, opener) => setQuick({ product: prod, opener })} onAdded={confirmAdded} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Plan your visit ──────────────────────────────────────────────── */}
      <section id="visit" className="pt-hero">
        <h2 className="text-[26px] font-semibold tracking-[-0.02em] sm:text-[30px]">{t("planVisit")}</h2>
        <div className="mt-major grid grid-cols-1 gap-major lg:grid-cols-2">
          <div className="flex flex-col rounded-[16px] border border-hairline p-major">
            <h3 className="text-[18px] font-semibold">{t("openingHours")}</h3>
            <p className="mt-inline flex items-center gap-tight text-[14px] text-muted">
              <span aria-hidden className={cn("h-2 w-2 rounded-full", hours.isOpen ? "bg-success" : "bg-[#8a8a85]")} />
              {hours.text}
            </p>
            {location.openingHours.length === 0 ? (
              <p className="mt-section text-[14px] text-muted">{t("hoursUnknown")}</p>
            ) : (
              <dl className="mt-section flex flex-col">
                {WEEK_ORDER.map((d) => {
                  const row = location.openingHours.find((h) => h.dayOfWeek === d);
                  const open = row && row.intervals.length > 0;
                  const isToday = d === flow.now.getDay();
                  return (
                    <div
                      key={d}
                      aria-current={isToday ? "date" : undefined}
                      className={cn(
                        "flex min-h-12 items-center justify-between gap-comfortable border-b border-hairline px-comfortable text-[14px] last:border-b-0",
                        isToday ? "-mx-comfortable rounded-[10px] border-transparent bg-[var(--sf-soft)] font-semibold" : "",
                      )}
                    >
                      <dt className="flex items-center gap-tight">
                        {hours.dayName(d)}
                        {isToday && <span className="rounded-full bg-white px-tight text-[12px] font-semibold text-fg">{t("today")}</span>}
                      </dt>
                      <dd className={cn("tnum text-right", !open && !isToday && "text-muted")}>
                        {open ? row!.intervals.map((i) => formatClockRange(i.opensAt, i.closesAt)).join(", ") : t("closed")}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </div>

          <div className="flex flex-col overflow-hidden rounded-[16px] border border-hairline">
            <Media bookingType="BT-04" alt="" seed={location.id} iconSize={22} className="aspect-[16/6] w-full" />
            <div className="flex flex-1 flex-col gap-section p-major">
              <div>
                <h3 className="text-[18px] font-semibold">{t("gettingHere")}</h3>
                <p className="mt-tight text-[16px]">
                  {location.addressLine1}
                  {location.addressLine2 ? <>, {location.addressLine2}</> : null}
                  <br />
                  <span className="text-muted">{[location.city, location.country].filter(Boolean).join(", ")}</span>
                </p>
              </div>
              <a href={directionsHref(location)} target="_blank" rel="noreferrer noopener" className={cn(sfBtn.secondary, "w-full sm:w-fit")}>
                <Navigation size={18} strokeWidth={1.75} aria-hidden />
                {t("directions")}
              </a>
              <ul className="flex flex-col text-[14px]">
                {sf.contactPhone && (
                  <li>
                    <a href={`tel:${sf.contactPhone}`} className="flex min-h-11 items-center gap-tight hover:underline">
                      <span className="w-20 text-muted">{t("phone")}</span>
                      <span className="tnum">{sf.contactPhone}</span>
                    </a>
                  </li>
                )}
                {sf.contactEmail && (
                  <li>
                    <a href={`mailto:${sf.contactEmail}`} className="flex min-h-11 items-center gap-tight hover:underline">
                      <span className="w-20 text-muted">{t("email")}</span>
                      <span className="break-all">{sf.contactEmail}</span>
                    </a>
                  </li>
                )}
                {sf.links.map((l) => (
                  <li key={l.id}>
                    <a href={l.url} target="_blank" rel="noreferrer noopener" className="flex min-h-11 items-center text-[var(--sf-ink)] underline-offset-4 hover:underline">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-auto flex items-start gap-tight rounded-[12px] bg-subtle p-comfortable text-[14px] text-muted">
                <QrCode size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-fg" aria-hidden />
                {t("atTheGate")}
              </p>
            </div>
          </div>
        </div>
      </section>
      {quick && (
        <QuickAddSheet
          product={quick.product}
          onClose={closeQuick}
          onAdded={(prod) => {
            closeQuick();
            confirmAdded(prod);
          }}
        />
      )}
      {toast && <QuickAddToast key={toast.key} name={toast.name} onDismiss={() => setToast(null)} />}
      <StickyBasketBar />
    </StorefrontChrome>
  );
}

/** One booking, as a card. The picture and the name open the full booking page
 *  (a real link on the live site, so it is a URL somebody can share and the
 *  back button works; a flow-navigated button in preview, where a `<Link>`
 *  would escape the iframe and navigate the EDITOR away). The foot carries the
 *  price and the two things a guest does with it: **Add** and **Details**.
 *
 *  Add is one tap for a booking that needs no choice (one kind of ticket, no
 *  day, no time, no extras), and afterwards becomes a stepper. For anything
 *  with options it opens the quick-add sheet. */
function ProductCard({
  product: p,
  onQuickAdd,
  onAdded,
}: {
  product: Product;
  onQuickAdd: (p: Product, opener: HTMLElement) => void;
  onAdded: (p: Product) => void;
}) {
  const flow = useStorefrontFlow();
  const t = useTranslations("storefront");
  const locale = useLocale();
  const subtitle = useBehaviourSubtitle();
  const from = fromPrice(p.tiers);
  const minutes = productMinutes(p);
  const tier = p.tiers.find((x) => x.active);
  const oneTap = isOneTap(p);
  const canAdd = !!tier;
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  const next = useMemo(() => nextAvailable(p, flow.now), [p, flow.now]);
  const todayRow = flow.location.openingHours.find((h) => h.dayOfWeek === flow.now.getDay());
  const dayWord = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    const today = new Date(flow.now.getFullYear(), flow.now.getMonth(), flow.now.getDate());
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return t("booking.today");
    if (diff === 1) return t("booking.tomorrow");
    return d.toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
  };
  let when: string;
  if (storefrontPattern(p.bookingType) === "open") {
    when =
      todayRow && todayRow.intervals.length > 0
        ? t("openToday", { hours: todayRow.intervals.map((i) => formatClockRange(i.opensAt, i.closesAt)).join(", ") })
        : t("closedToday");
  } else if (next) {
    when = next.time ? t("card.nextAt", { day: dayWord(next.date), time: formatClock(next.time) }) : t("card.nextDay", { day: dayWord(next.date) });
  } else {
    when = t("card.noneSoon");
  }

  /* What of this booking is already in the basket (tickets only, not extras). */
  const lines = flow.basket.filter((l) => l.productId === p.id);
  const inBasket = lines.reduce((s, l) => s + l.tiers.filter((x) => !x.tierId.startsWith("addon_")).reduce((a, x) => a + x.qty, 0), 0);
  const tierLine = oneTap && tier ? lines.find((l) => l.tiers.some((x) => x.tierId === tier.id)) : undefined;
  const tierQty = tierLine?.tiers.find((x) => x.tierId === tier?.id)?.qty ?? 0;
  const capQty = tier?.maxPerOrder ?? 10;

  const addOne = () => {
    if (!tier) return;
    flow.addLine({
      productId: p.id,
      productName: p.name,
      taxClass: p.taxClass,
      date: null,
      startTime: null,
      endTime: null,
      resourceId: null,
      resourceName: null,
      tiers: [{ tierId: tier.id, tierName: tier.name, price: tier.price, admits: tier.admits ?? 1, qty: 1, donation: tier.donation, ageNote: tier.ageNote }],
    });
    setFlash(true);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(false), 1400);
    onAdded(p);
  };
  const setQty = (n: number) => {
    if (!tierLine || !tier) return;
    if (n <= 0) flow.removeLine(tierLine.id);
    else flow.updateLine(tierLine.id, { tiers: tierLine.tiers.map((x) => (x.tierId === tier.id ? { ...x, qty: Math.min(n, capQty) } : x)) });
  };

  const openCls = "block focus-visible:outline-2 focus-visible:outline-offset-2";
  const titleCls = "-my-2.5 block py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2";
  const openWith = (children: React.ReactNode, hidden?: boolean, cls: string = openCls) =>
    flow.mode === "preview" ? (
      <button
        type="button"
        onClick={() => flow.goProduct(p.id)}
        aria-hidden={hidden || undefined}
        tabIndex={hidden ? -1 : undefined}
        className={cn(cls, "w-full text-left")}
      >
        {children}
      </button>
    ) : (
      <Link
        href={`/s/${flow.storefront.slug}/${flow.slugs[p.id]}`}
        aria-hidden={hidden || undefined}
        tabIndex={hidden ? -1 : undefined}
        className={cls}
      >
        {children}
      </Link>
    );

  const cardBtn =
    "inline-flex min-h-11 shrink-0 items-center justify-center gap-inline rounded-[12px] px-comfortable text-[14px] font-semibold leading-none transition-[filter,background-color] duration-quick focus-visible:outline-2 focus-visible:outline-offset-2";
  const fillCls = "bg-[var(--sf-fill)] text-[var(--sf-on-fill)] hover:brightness-90";
  const ghostCls = "border border-strong bg-white text-fg hover:border-fg";
  const detailsLabel = t("card.detailsAria", { name: p.name });
  const detailsBtn =
    flow.mode === "preview" ? (
      <button type="button" onClick={() => flow.goProduct(p.id)} aria-label={detailsLabel} className={cn(cardBtn, ghostCls)}>
        {t("card.details")}
      </button>
    ) : (
      <Link href={`/s/${flow.storefront.slug}/${flow.slugs[p.id]}`} aria-label={detailsLabel} className={cn(cardBtn, ghostCls)}>
        {t("card.details")}
      </Link>
    );

  let addControl: React.ReactNode = null;
  if (canAdd && oneTap && tierQty > 0 && !flash) {
    addControl = (
      <div role="group" aria-label={p.name} className="inline-flex min-h-11 shrink-0 items-center rounded-[12px] border border-[var(--sf-fill)] bg-[var(--sf-soft)]">
        <button
          type="button"
          aria-label={t("card.lessOf", { name: p.name })}
          onClick={() => setQty(tierQty - 1)}
          className="flex h-11 w-11 items-center justify-center rounded-[12px] text-fg hover:bg-white/60 focus-visible:outline-2"
        >
          <Minus size={16} strokeWidth={2} aria-hidden />
        </button>
        <span className="tnum min-w-4 text-center text-[16px] font-semibold" aria-live="polite">
          {tierQty}
        </span>
        <button
          type="button"
          aria-label={t("card.moreOf", { name: p.name })}
          disabled={tierQty >= capQty}
          onClick={() => setQty(tierQty + 1)}
          className="flex h-11 w-11 items-center justify-center rounded-[12px] text-fg hover:bg-white/60 focus-visible:outline-2 disabled:text-[#8a8a85]"
        >
          <Plus size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>
    );
  } else if (canAdd && oneTap) {
    addControl = (
      <button type="button" onClick={addOne} aria-label={flash ? t("card.added") : t("card.addAria", { name: p.name })} className={cn(cardBtn, fillCls, "min-w-[5.5rem]")}>
        {flash ? (
          <>
            <Check size={16} strokeWidth={3} aria-hidden />
            {t("card.added")}
          </>
        ) : (
          <>
            <Plus size={16} strokeWidth={2.5} aria-hidden />
            {t("card.add")}
          </>
        )}
      </button>
    );
  } else if (canAdd) {
    addControl = (
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={(e) => onQuickAdd(p, e.currentTarget)}
        aria-label={t("card.addAria", { name: p.name })}
        className={cn(cardBtn, fillCls, "min-w-[5.5rem]")}
      >
        <Plus size={16} strokeWidth={2.5} aria-hidden />
        {t("card.add")}
      </button>
    );
  }

  return (
    <article className="group flex h-full w-full flex-col overflow-hidden rounded-[16px] border border-hairline bg-white transition-[transform,box-shadow] duration-quick hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(0,0,0,0.10)]">
      {openWith(
        <div className="relative">
          <Media src={p.images?.[0]?.url} alt="" bookingType={p.bookingType} seed={p.id} className="aspect-[16/10] w-full" />
          <span className="absolute left-comfortable top-comfortable rounded-full bg-white px-comfortable py-inline text-[12px] font-semibold text-fg shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
            {t(`filter.${typeGroup(p.bookingType)}`)}
          </span>
          {inBasket > 0 && (
            <span className="tnum absolute right-comfortable top-comfortable inline-flex items-center gap-inline rounded-full bg-[var(--sf-fill)] px-comfortable py-inline text-[12px] font-semibold text-[var(--sf-on-fill)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
              <Check size={12} strokeWidth={3} aria-hidden />
              {t("card.inBasket", { count: inBasket })}
            </span>
          )}
        </div>,
        true,
      )}
      <div className="flex flex-1 flex-col gap-tight p-section">
        <h3 className="break-words text-[18px] font-semibold leading-snug tracking-[-0.01em]">
          {openWith(<span className="hover:underline">{p.name}</span>, false, titleCls)}
        </h3>
        <p className="flex flex-wrap items-center gap-x-comfortable gap-y-inline text-[14px] text-fg">
          <span className="inline-flex items-center gap-inline">
            <CalendarClock size={14} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
            {when}
          </span>
          {minutes !== null && (
            <span className="inline-flex items-center gap-inline">
              <Clock size={14} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
              {formatDuration(minutes)}
            </span>
          )}
        </p>
        <p className="text-[14px] text-muted">{subtitle(p, { resources: flow.resources, team: flow.team })}</p>
        {p.description && <p className="line-clamp-2 text-[14px] text-muted">{p.description}</p>}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-comfortable gap-y-tight pt-comfortable">
          <p className="tnum min-w-0">
            {from === null ? (
              <span className="text-[16px] font-semibold">{t("askAtTheDoor")}</span>
            ) : from === 0 ? (
              <span className="text-[20px] font-semibold">{t("free")}</span>
            ) : (
              <>
                <span className="block text-[12px] text-muted">{t("from")}</span>
                <span className="text-[22px] font-semibold leading-none tracking-[-0.01em]">{formatPriceShort(from)}</span>
              </>
            )}
          </p>
          <div className="flex items-center gap-tight">
            {detailsBtn}
            {addControl}
          </div>
        </div>
      </div>
    </article>
  );
}
