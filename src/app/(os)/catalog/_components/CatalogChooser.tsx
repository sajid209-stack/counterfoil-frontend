"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Compass,
  Copy,
  DoorOpen,
  GraduationCap,
  LandPlot,
  Layers,
  Package,
  Repeat,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { createProduct, duplicateEvent, listEvents, listProducts, type Product } from "@/lib/api";
import { CATEGORIES, categoryById, type CategoryId } from "@/lib/events/catalog";
import { templateFontVars } from "@/lib/events/fonts";
import { BOOKING_KINDS, bookingKindOf, productCopy, type BookingKind } from "@/lib/catalog";

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
 */
export function CatalogChooser({ lead = "all" }: { lead?: "all" | "bookings" | "events" }) {
  const t = useTranslations("catalog");
  const te = useTranslations("events");
  const router = useRouter();
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
      <FamilyHead id="chooser-bookings" icon={Repeat} title={t("chooser.bookingsTitle")} rule={t("chooser.bookingsRule")} />
      <ul className="grid gap-tight sm:grid-cols-2 sm:gap-comfortable xl:grid-cols-4">
        {bookingCards.map((k) => {
          const Icon = ICON[k];
          const n = bookingCount.get(k) ?? 0;
          return (
            <li key={k}>
              {/* A row on a phone — icon, name, one line — so eight kinds fit a
                  screen or two instead of eight tall cards; a card with its
                  examples from `sm`, where there is room to compare them. */}
              <Link
                href={`/catalog/new/booking?kind=${k}`}
                className="group flex h-full items-center gap-comfortable rounded-md border border-line bg-card p-comfortable transition-all duration-quick hover:border-ember/50 focus-visible:border-ember sm:flex-col sm:items-stretch sm:gap-tight sm:hover:-translate-y-0.5 sm:hover:shadow-md"
              >
                <span className="flex shrink-0 items-start justify-between gap-tight">
                  <span className="flex h-10 w-10 items-center justify-center rounded-sm border border-line bg-muted-wash text-fg">
                    <Icon size={20} strokeWidth={1.5} aria-hidden />
                  </span>
                  {n > 0 && (
                    <span className="hidden rounded-full bg-muted-wash px-tight py-0.5 text-[12px] text-muted sm:inline">{t("chooser.have", { count: n })}</span>
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:gap-tight">
                  <span className="text-[14px] font-semibold leading-snug">{t(`chooser.booking.${k}.title`)}</span>
                  <span className="text-[13px] leading-snug text-muted">{t(`chooser.booking.${k}.body`)}</span>
                  {n > 0 && <span className="text-[12px] text-muted sm:hidden">{t("chooser.have", { count: n })}</span>}
                  <span className="mt-auto hidden pt-inline text-[12px] leading-snug text-muted sm:block">
                    <span className="font-medium text-fg">{t("chooser.eg")}</span> {t(`chooser.booking.${k}.examples`)}
                  </span>
                </span>
                <ArrowRight size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted sm:hidden" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );

  const eventsSection = eventCards.length > 0 && (
    <section key="events" aria-labelledby="chooser-events">
      <FamilyHead id="chooser-events" icon={CalendarDays} title={t("chooser.eventsTitle")} rule={t("chooser.eventsRule")} />
      <ul className={cn("grid gap-tight sm:grid-cols-2 sm:gap-comfortable xl:grid-cols-3", templateFontVars)}>
        {eventCards.map((c) => {
          const n = eventCount.get(c.id) ?? 0;
          return (
            <li key={c.id}>
              <Link
                href={`/catalog/new/event?category=${c.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-md border border-line bg-card transition-all duration-quick hover:-translate-y-0.5 hover:border-strong hover:shadow-md"
              >
                {/* The swatch is the template, in its own literal colours and
                    display face: choosing a kind of event is also choosing a
                    look, and a look is chosen by seeing it. */}
                <span className="relative flex h-14 items-end p-comfortable sm:h-20" style={{ background: c.theme.bg, borderBottom: `1px solid ${c.theme.line}` }}>
                  {/* The count sits where a booking card's does, top right. */}
                  {n > 0 && (
                    <span className="absolute right-comfortable top-comfortable hidden rounded-full border border-line bg-card px-tight py-0.5 text-[12px] text-muted sm:inline">{t("chooser.have", { count: n })}</span>
                  )}
                  <span>
                    <span
                      style={{
                        display: "block",
                        font: `700 22px/1 ${c.theme.display}, var(--font-hind-siliguri), sans-serif`,
                        letterSpacing: c.theme.displayTracking,
                        color: c.theme.fg,
                        textTransform: c.theme.eyebrowCase === "upper" ? "uppercase" : "none",
                      }}
                    >
                      {te(`category.${c.key}`)}
                    </span>
                    <span style={{ marginTop: 6, display: "block", height: 3, width: 40, background: c.theme.accent, borderRadius: 999 }} />
                  </span>
                </span>
                <span className="flex flex-1 flex-col gap-inline p-comfortable">
                  <span className="text-[13px] leading-snug text-muted">{t(`chooser.event.${c.key}.body`)}</span>
                  {n > 0 && <span className="text-[12px] text-muted sm:hidden">{t("chooser.have", { count: n })}</span>}
                  <span className="mt-auto text-[12px] leading-snug text-muted">
                    <span className="font-medium text-fg">{t("chooser.eg")}</span> {t(`chooser.event.${c.key}.examples`)}
                  </span>
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
          className="h-12 w-full rounded-md border border-line bg-card pl-10 pr-comfortable text-[15px] outline-none placeholder:text-muted focus:border-inverse"
        />
      </div>

      <div className="order-3 flex flex-col gap-major">
        {both && (
          <p role="status" className="flex items-start gap-tight rounded-sm border border-line bg-card px-comfortable py-tight text-[13px]">
            <ArrowRight size={14} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-muted" />
            <span>{t("chooser.tieBreak")}</span>
          </p>
        )}
        {nothing ? (
          <div className="rounded-md border border-dashed border-line px-card py-major text-center">
            <p className="text-[14px] font-medium">{t("chooser.noMatch", { query: query.trim() })}</p>
            <p className="mt-inline text-[13px] text-muted">{t("chooser.noMatchHint")}</p>
          </div>
        ) : lead === "events" ? (
          [eventsSection, bookingsSection]
        ) : (
          [bookingsSection, eventsSection]
        )}
      </div>

      {/* Two ways in for somebody who does not see their thing — above the
          cards on a phone, where they would otherwise sit under fourteen of
          them, and after the cards where there is room to see both at once. */}
      <div className="order-2 grid gap-comfortable sm:order-4 sm:grid-cols-2 sm:border-t sm:border-hairline sm:pt-section">
        <Link
          href="/catalog/new/booking"
          className="flex items-center gap-comfortable rounded-md border border-line bg-card p-comfortable transition-colors duration-quick hover:border-strong"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium">{t("chooser.guidedTitle")}</span>
            <span className="block text-[13px] text-muted">{t("chooser.guidedBody")}</span>
          </span>
          <ArrowRight size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
        </Link>
        <div className="rounded-md border border-line bg-card p-comfortable">
          <button type="button" onClick={() => setCopyOpen((v) => !v)} aria-expanded={copyOpen} className="flex w-full items-center gap-comfortable text-left">
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium">{t("chooser.copyTitle")}</span>
              <span className="block text-[13px] text-muted">{t("chooser.copyBody")}</span>
            </span>
            <Copy size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
          </button>
          {copyOpen && (
            <div className="mt-comfortable flex flex-col gap-tight">
              <input
                value={copyQuery}
                onChange={(e) => setCopyQuery(e.target.value)}
                placeholder={t("chooser.copySearch")}
                aria-label={t("chooser.copySearch")}
                autoFocus
                className="h-11 w-full rounded-sm border border-line bg-card px-comfortable text-[13px] outline-none placeholder:text-muted focus:border-inverse md:h-9"
              />
              <ul className="flex flex-col gap-0.5">
                {copyable.map((x) => (
                  <li key={x.key}>
                    <button
                      type="button"
                      disabled={copying !== null}
                      onClick={() => copy(x)}
                      className="flex min-h-11 w-full items-center gap-comfortable rounded-sm px-tight text-left transition-colors duration-quick hover:bg-muted-wash disabled:opacity-60 md:min-h-9"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{x.name}</span>
                        <span className="block truncate text-[12px] text-muted">{x.sub}</span>
                      </span>
                      <span className="shrink-0 text-[12px] font-medium text-brand-foreground">
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
    </div>
  );
}

/** A family's heading and the rule that separates it from the other — the
 *  one sentence that settles "is a boat trip a tour or an event?". */
function FamilyHead({ id, icon: Icon, title, rule }: { id: string; icon: LucideIcon; title: string; rule: string }) {
  return (
    <div className="mb-comfortable flex flex-wrap items-center gap-x-comfortable gap-y-inline">
      <h2 id={id} className="text-[15px] font-semibold tracking-tight">{title}</h2>
      <p className="inline-flex items-center gap-inline rounded-full bg-muted-wash px-tight py-0.5 text-[12px] font-medium text-fg">
        <Icon size={13} strokeWidth={1.75} aria-hidden />
        {rule}
      </p>
    </div>
  );
}
