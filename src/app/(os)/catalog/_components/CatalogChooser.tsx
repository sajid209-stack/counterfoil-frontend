"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  Compass,
  Copy,
  DoorOpen,
  GraduationCap,
  LandPlot,
  Layers,
  Package,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/useMedia";
import { useApiQuery } from "@/lib/useApi";
import { createProduct, duplicateEvent, listEvents, listProducts, type Product } from "@/lib/api";
import { CATEGORIES, categoryById, type CategoryId } from "@/lib/events/catalog";
import { templateFontVars } from "@/lib/events/fonts";
import { BOOKING_KINDS, bookingKindOf, productCopy, type BookingKind } from "@/lib/catalog";

/** Tailwind's sm. Below it the chooser is rows in one card per family; from it,
 *  a grid of cards with their examples. Branched in JS, not hidden with CSS, so
 *  there is exactly one copy of each row in the document. */
const SM = "(min-width: 40rem)";

const ICON: Record<BookingKind, LucideIcon> = {
  entry: DoorOpen,
  timed: Clock,
  tour: Compass,
  space: LandPlot,
  appointment: UserRound,
  course: GraduationCap,
  pass: Layers,
  bundle: Package,
};

/**
 * "What are you selling?"
 *
 * The first question of every new thing, asked in the operator's words. The
 * old flow asked it twice and in the wrong order: first "Bookings or Events?"
 * — a question about this software's menu, not about the business — and then,
 * for a booking, "How do visitors book this?" on the second step, after a name
 * had already been typed for a thing whose shape was not yet known.
 *
 * So the chooser is the whole of that decision, once, up front: eight kinds
 * of booking and six kinds of event, each with a line saying what it is for
 * and two examples a venue would recognise, searchable by the word the
 * operator would use ("bowling", "massage", "concert"). Picking one starts
 * the right form already answered.
 *
 * Two ways out for the unsure: answer three questions instead (the original
 * question tree, still there), or copy something already on sale — the most
 * common way anything new gets made.
 *
 * The calm pass: cards have no edge of their own (`card-surface` — a soft
 * shadow does the work), the count of what is already added is quiet text, and
 * the rule that separates the two families is one muted line under its heading.
 * On a phone each family is ONE card of two-line rows, which is the shape the
 * rest of the admin uses for a list on a small screen; the event categories
 * stay as small themed tiles, two across, because a look is chosen by seeing it.
 */
export function CatalogChooser({ lead = "all" }: { lead?: "all" | "bookings" | "events" }) {
  const t = useTranslations("catalog");
  const te = useTranslations("events");
  const router = useRouter();
  const wide = useMediaQuery(SM);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const productsQ = useApiQuery(() => listProducts({ pageSize: 500 }), []);
  const eventsQ = useApiQuery(() => listEvents({ pageSize: 200 }), []);
  const products = useMemo(() => productsQ.data?.data ?? [], [productsQ.data]);
  const events = useMemo(() => eventsQ.data?.data ?? [], [eventsQ.data]);

  /* What the operator already sells of each kind — a card that says "4 in
     your catalog" tells a returning operator where they have been, and tells
     a new one nothing false. */
  const bookingCount = useMemo(() => {
    const m = new Map<BookingKind, number>();
    for (const p of products) m.set(bookingKindOf(p.bookingType), (m.get(bookingKindOf(p.bookingType)) ?? 0) + 1);
    return m;
  }, [products]);
  const eventCount = useMemo(() => {
    const m = new Map<CategoryId, number>();
    for (const e of events) m.set(e.categoryId, (m.get(e.categoryId) ?? 0) + 1);
    return m;
  }, [events]);

  const words = (key: string) => `${t(`${key}.title`)} ${t(`${key}.body`)} ${t(`${key}.examples`)} ${t(`${key}.keywords`)}`.toLowerCase();
  const matches = (key: string) => !q || q.split(/\s+/).every((w) => words(key).includes(w));
  const bookingCards = BOOKING_KINDS.filter((k) => matches(`chooser.booking.${k}`));
  /* An event card's title is its category's own name, so that is searched
     too — "tour" has to find Travel & Tours, not only "tournament". */
  const eventMatches = (key: string, title: string) => !q || q.split(/\s+/).every((w) => `${words(key)} ${title.toLowerCase()}`.includes(w));
  const eventCards = CATEGORIES.filter((c) => eventMatches(`chooser.event.${c.key}`, te(`category.${c.key}`)));

  const bookingsSection = bookingCards.length > 0 && (
    <section key="bookings" aria-labelledby="chooser-bookings">
      <FamilyHead id="chooser-bookings" title={t("chooser.bookingsTitle")} rule={t("chooser.bookingsRule")} />
      {wide ? (
        <ul className="grid gap-comfortable sm:grid-cols-2 xl:grid-cols-4">
          {bookingCards.map((k) => {
            const Icon = ICON[k];
            const n = bookingCount.get(k) ?? 0;
            return (
              <li key={k}>
                <Link
                  href={`/catalog/new/booking?kind=${k}`}
                  className="card-surface card-interactive group flex h-full flex-col gap-tight p-card"
                >
                  <span className="flex items-start justify-between gap-tight">
                    <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-muted-wash text-fg">
                      <Icon size={20} strokeWidth={1.5} aria-hidden />
                    </span>
                    {n > 0 && <span className="text-[0.75rem] text-muted">{t("chooser.have", { count: n })}</span>}
                  </span>
                  <span className="mt-tight text-[0.9375rem] font-semibold leading-snug text-fg">{t(`chooser.booking.${k}.title`)}</span>
                  <span className="text-[0.8125rem] leading-snug text-muted">{t(`chooser.booking.${k}.body`)}</span>
                  <span className="mt-auto pt-tight text-[0.75rem] leading-snug text-muted">
                    <span className="font-medium text-fg">{t("chooser.eg")}</span> {t(`chooser.booking.${k}.examples`)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        /* One card, two lines a row: the name (with what is already added, as
           quiet text), then the one line that says what it is for. */
        <ul className="card-surface divide-y divide-hairline overflow-hidden">
          {bookingCards.map((k) => {
            const Icon = ICON[k];
            const n = bookingCount.get(k) ?? 0;
            return (
              <li key={k}>
                <Link
                  href={`/catalog/new/booking?kind=${k}`}
                  data-focus-inset=""
                  className="flex min-h-14 items-center gap-comfortable px-card py-comfortable transition-colors duration-quick active:bg-muted-wash"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-muted-wash text-fg">
                    <Icon size={20} strokeWidth={1.5} aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-baseline justify-between gap-tight">
                      <span className="min-w-0 truncate text-[0.9375rem] font-semibold leading-snug text-fg">{t(`chooser.booking.${k}.title`)}</span>
                      {n > 0 && <span className="shrink-0 text-[0.75rem] text-muted">{t("chooser.haveShort", { count: n })}</span>}
                    </span>
                    <span className="line-clamp-2 text-[0.8125rem] leading-snug text-muted">{t(`chooser.booking.${k}.body`)}</span>
                  </span>
                  <ChevronRight size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const eventsSection = eventCards.length > 0 && (
    <section key="events" aria-labelledby="chooser-events">
      <FamilyHead id="chooser-events" title={t("chooser.eventsTitle")} rule={t("chooser.eventsRule")} />
      <ul className={cn("grid grid-cols-2 gap-tight sm:gap-comfortable md:grid-cols-2 xl:grid-cols-3", templateFontVars)}>
        {eventCards.map((c) => {
          const n = eventCount.get(c.id) ?? 0;
          return (
            <li key={c.id}>
              <Link
                href={`/catalog/new/event?category=${c.id}`}
                className="card-surface card-interactive group flex h-full flex-col overflow-hidden"
              >
                {/* The swatch is the template, in its own literal colours and
                    display face: choosing a kind of event is also choosing a
                    look, and a look is chosen by seeing it. */}
                <span className="flex min-h-14 items-end px-comfortable py-comfortable sm:h-20 sm:px-card" style={{ background: c.theme.bg, borderBottom: `1px solid ${c.theme.line}` }}>
                  <span className="min-w-0">
                    <span
                      className="text-[1rem] sm:text-[1.375rem]"
                      style={{
                        display: "block",
                        fontFamily: `${c.theme.display}, var(--font-hind-siliguri), sans-serif`,
                        fontWeight: 700,
                        lineHeight: 1.05,
                        letterSpacing: c.theme.displayTracking,
                        color: c.theme.fg,
                        textTransform: c.theme.eyebrowCase === "upper" ? "uppercase" : "none",
                      }}
                    >
                      {te(`category.${c.key}`)}
                    </span>
                    <span style={{ marginTop: 6, display: "block", height: 3, width: 32, background: c.theme.accent, borderRadius: 999 }} />
                  </span>
                </span>
                <span className="flex flex-1 flex-col gap-inline px-comfortable py-comfortable sm:px-card sm:py-section">
                  <span className="line-clamp-2 text-[0.8125rem] leading-snug text-muted sm:line-clamp-none">{t(`chooser.event.${c.key}.body`)}</span>
                  <span className="mt-auto hidden pt-inline text-[0.75rem] leading-snug text-muted sm:block">
                    <span className="font-medium text-fg">{t("chooser.eg")}</span> {t(`chooser.event.${c.key}.examples`)}
                  </span>
                  {n > 0 && <span className="pt-inline text-[0.75rem] text-muted">{t(wide ? "chooser.have" : "chooser.haveShort", { count: n })}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );

  // ── copy something already on sale ───────────────────────────────────────
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyQuery, setCopyQuery] = useState("");
  const [copying, setCopying] = useState<string | null>(null);
  const copyable = useMemo(() => {
    const cq = copyQuery.trim().toLowerCase();
    const all = [
      ...products.map((p) => ({ key: `b:${p.id}`, name: p.name, sub: t(`type.${bookingKindOf(p.bookingType)}`), product: p as Product | null, eventId: null as string | null })),
      ...events.map((e) => ({ key: `e:${e.id}`, name: e.title, sub: te(`category.${categoryById(e.categoryId).key}`), product: null, eventId: e.id })),
    ];
    return all.filter((x) => !cq || x.name.toLowerCase().includes(cq)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 6);
  }, [products, events, copyQuery, t, te]);
  const copy = async (x: (typeof copyable)[number]) => {
    setCopying(x.key);
    if (x.product) {
      const res = await createProduct(productCopy(x.product, t("copyName", { name: x.product.name })));
      setCopying(null);
      if (res.ok) router.push(`/catalog/bookings/${res.data.id}`);
      return;
    }
    const res = await duplicateEvent(x.eventId!, te("copyTitle", { title: x.name }));
    setCopying(null);
    if (res.ok) router.push(`/catalog/events/${res.data.id}/edit`);
  };

  const nothing = bookingCards.length === 0 && eventCards.length === 0;
  /* A word that finds both families — "show", "class", "tour" — is where a
     wrong pick starts, and a booking made as an event (or the other way) has
     no way to convert later. So when a search lands in both, the rule that
     separates them is said once, right there. */
  const both = !!q && bookingCards.length > 0 && eventCards.length > 0;

  return (
    <div className="flex flex-col gap-major">
      <div className="relative order-1 max-w-xl">
        <Search size={18} strokeWidth={1.5} aria-hidden className="pointer-events-none absolute left-comfortable top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("chooser.searchPlaceholder")}
          aria-label={t("chooser.searchLabel")}
          className="h-11 w-full rounded-sm border border-line bg-card pl-10 pr-comfortable text-[0.9375rem] outline-none placeholder:text-muted focus:border-inverse"
        />
      </div>

      <div className="order-3 flex flex-col gap-major">
        {both && (
          <p role="status" className="flex items-start gap-tight rounded-sm bg-muted-wash px-comfortable py-tight text-[0.8125rem]">
            <ArrowRight size={14} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-muted" />
            <span>{t("chooser.tieBreak")}</span>
          </p>
        )}
        {nothing ? (
          <div className="rounded-md bg-muted-wash px-card py-major text-center">
            <p className="text-[0.875rem] font-medium">{t("chooser.noMatch", { query: query.trim() })}</p>
            <p className="mt-inline text-[0.8125rem] text-muted">{t("chooser.noMatchHint")}</p>
          </div>
        ) : lead === "events" ? (
          [eventsSection, bookingsSection]
        ) : (
          [bookingsSection, eventsSection]
        )}
      </div>

      {/* Two ways in for somebody who does not see their thing — the first two
          rows on a phone, where they would otherwise sit under fourteen cards,
          and after the cards where there is room to see both at once. Quiet on
          purpose: they are the way out, not the way in. */}
      <div className="card-surface order-2 overflow-hidden sm:order-4">
        <div className="divide-y divide-hairline sm:grid sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <Link
            href="/catalog/new/booking"
            data-focus-inset=""
            className="flex min-h-14 items-center gap-comfortable px-card py-comfortable transition-colors duration-quick hover:bg-muted-wash"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[0.875rem] font-medium text-fg">{t("chooser.guidedTitle")}</span>
              <span className="block text-[0.8125rem] leading-snug text-muted">{t("chooser.guidedBody")}</span>
            </span>
            <ChevronRight size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
          </Link>
          <button
            type="button"
            onClick={() => setCopyOpen((v) => !v)}
            aria-expanded={copyOpen}
            data-focus-inset=""
            className="flex min-h-14 w-full items-center gap-comfortable px-card py-comfortable text-left transition-colors duration-quick hover:bg-muted-wash"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[0.875rem] font-medium text-fg">{t("chooser.copyTitle")}</span>
              <span className="block text-[0.8125rem] leading-snug text-muted">{t("chooser.copyBody")}</span>
            </span>
            <Copy size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
          </button>
        </div>
        {copyOpen && (
          <div className="flex flex-col gap-tight border-t border-hairline p-card">
            <input
              value={copyQuery}
              onChange={(e) => setCopyQuery(e.target.value)}
              placeholder={t("chooser.copySearch")}
              aria-label={t("chooser.copySearch")}
              autoFocus
              className="h-11 w-full rounded-sm border border-line bg-card px-comfortable text-[0.8125rem] outline-none placeholder:text-muted focus:border-inverse md:h-10"
            />
            <ul className="divide-y divide-hairline">
              {copyable.map((x) => (
                <li key={x.key}>
                  <button
                    type="button"
                    disabled={copying !== null}
                    onClick={() => copy(x)}
                    className="flex min-h-11 w-full items-center gap-comfortable px-inline py-tight text-left transition-colors duration-quick hover:bg-muted-wash disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] font-medium">{x.name}</span>
                      <span className="block truncate text-[0.75rem] text-muted">{x.sub}</span>
                    </span>
                    <span className="shrink-0 text-[0.75rem] font-medium text-brand-foreground">
                      {copying === x.key ? t("chooser.copying") : t("chooser.copyAction")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/** A family's heading and the rule that separates it from the other — the
 *  one sentence that settles "is a boat trip a tour or an event?", as one muted
 *  line under the heading rather than a pill beside it. */
function FamilyHead({ id, title, rule }: { id: string; title: string; rule: string }) {
  return (
    <div className="mb-comfortable">
      <h2 id={id} className="text-base font-semibold text-fg">{title}</h2>
      <p className="mt-0.5 text-[0.8125rem] text-muted">{rule}</p>
    </div>
  );
}
