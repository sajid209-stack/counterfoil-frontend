"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
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
import { AffixInput, Notice } from "@/components/ui";
import { useMediaQuery } from "@/lib/useMedia";
import { useApiQuery } from "@/lib/useApi";
import { createProduct, duplicateEvent, listEvents, listProducts, type Product } from "@/lib/api";
import { CATEGORIES, categoryById, type CategoryDef, type CategoryId } from "@/lib/events/catalog";
import { templateFontVars } from "@/lib/events/fonts";
import { BOOKING_KINDS, bookingKindOf, productCopy, type BookingKind } from "@/lib/catalog";

/** Tailwind's sm. Below it the chooser is rows in one card per group; from it,
 *  a grid of cards with their examples. Branched in JS, not hidden with CSS, so
 *  there is exactly one copy of each row in the document. */
const SM = "(min-width: 40rem)";

const ICON: Record<Exclude<BookingKind, "event">, LucideIcon> = {
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
 * The first question of every new thing, asked in the operator's words, on one
 * page with two groups and ONE card style: what repeats on a schedule (the
 * eight kinds of booking) and what happens on a date (the six kinds of event).
 * The groups are told apart by the sentence under their heading, not by a
 * different look — the dark poster cards the events used to have read as a
 * different product.
 *
 * A booking's card carries its glyph in a small tile. An event's card carries,
 * in the same tile, a swatch of the page look that kind publishes in — its own
 * colours and display face — because choosing a kind of event is also choosing
 * a look, and nothing more than that: the swatch is a hint, not a poster.
 *
 * Search runs across both groups ("bowling", "massage", "concert"). Two ways
 * out for the unsure: answer a few questions instead, or copy something already
 * on sale — the most common way anything new gets made. A card goes to
 * `/catalog/new/<kind>`, or `/catalog/new/event?type=<id>`.
 *
 * On a phone each group is ONE card of two-line rows, the shape the rest of the
 * admin uses for a list on a small screen.
 */
export function CatalogChooser() {
  const t = useTranslations("catalog");
  const te = useTranslations("events");
  const router = useRouter();
  const wide = useMediaQuery(SM);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const productsQ = useApiQuery(() => listProducts({ pageSize: 500 }), []);
  const eventsQ = useApiQuery(() => listEvents({ pageSize: 200 }), []);
  /* Events are catalogue items too (BT-15), but they have cards of their own
     below; counted or copied as bookings they would appear twice. */
  const products = useMemo(() => (productsQ.data?.data ?? []).filter((p) => p.bookingType !== "BT-15"), [productsQ.data]);
  const events = useMemo(() => eventsQ.data?.data ?? [], [eventsQ.data]);

  /* What the operator already sells of each kind — a card that says "4 added"
     tells a returning operator where they have been, and tells a new one
     nothing false. */
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
  /* An event card's title is its own friendly name, so the category's name is
     searched too — "business" has to find Conference or talk. */
  const eventMatches = (key: string, category: string) => !q || q.split(/\s+/).every((w) => `${words(key)} ${category.toLowerCase()}`.includes(w));
  const eventCards = CATEGORIES.filter((c) => eventMatches(`chooser.event.${c.key}`, te(`category.${c.key}`)));

  const bookingsSection = bookingCards.length > 0 && (
    <Group wide={wide} key="bookings" id="chooser-bookings" title={t("chooser.bookingsTitle")} rule={t("chooser.bookingsRule")}>
      {bookingCards.map((k) => {
        const Icon = ICON[k];
        return (
          <KindCard
            wide={wide}
            key={k}
            href={`/catalog/new/${k}`}
            mark={
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-inner bg-muted-wash text-fg">
                <Icon size={20} strokeWidth={1.5} aria-hidden />
              </span>
            }
            title={t(`chooser.booking.${k}.title`)}
            body={t(`chooser.booking.${k}.body`)}
            examples={t(`chooser.booking.${k}.examples`)}
            count={bookingCount.get(k) ?? 0}
          />
        );
      })}
    </Group>
  );

  const eventsSection = eventCards.length > 0 && (
    <div key="events" className={templateFontVars}>
      <Group wide={wide} id="chooser-events" title={t("chooser.eventsTitle")} rule={t("chooser.eventsRule")}>
        {eventCards.map((c) => (
          <KindCard
            wide={wide}
            key={c.id}
            href={`/catalog/new/event?type=${c.id}`}
            mark={<LookSwatch c={c} />}
            title={t(`chooser.event.${c.key}.title`)}
            body={t(`chooser.event.${c.key}.body`)}
            examples={t(`chooser.event.${c.key}.examples`)}
            count={eventCount.get(c.id) ?? 0}
          />
        ))}
      </Group>
    </div>
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
      if (res.ok) router.push(`/catalog/${res.data.id}`);
      return;
    }
    const res = await duplicateEvent(x.eventId!, te("copyTitle", { title: x.name }));
    setCopying(null);
    if (res.ok) router.push(`/catalog/${res.data.id}`);
  };

  const nothing = bookingCards.length === 0 && eventCards.length === 0;
  /* A word that finds both groups — "show", "class", "tour" — is where a wrong
     pick starts, and a booking made as an event (or the other way) has no way
     to convert later. So when a search lands in both, the rule that separates
     them is said once, right there. */
  const both = !!q && bookingCards.length > 0 && eventCards.length > 0;

  return (
    <div className="flex flex-col gap-major">
      <AffixInput
        type="search"
        prefix={<Search size={18} strokeWidth={1.5} aria-hidden />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("chooser.searchPlaceholder")}
        aria-label={t("chooser.searchLabel")}
        className="order-1 max-w-xl"
      />

      <div className="order-3 flex flex-col gap-major">
        {both && <Notice tone="neutral" size="sm">{t("chooser.tieBreak")}</Notice>}
        {nothing ? (
          <div className="rounded-card bg-muted-wash px-card py-major text-center">
            <p className="text-base font-medium">{t("chooser.noMatch", { query: query.trim() })}</p>
            <p className="mt-inline text-sm text-muted">{t("chooser.noMatchHint")}</p>
          </div>
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
              <span className="block text-base font-medium text-fg">{t("chooser.guidedTitle")}</span>
              <span className="block text-sm leading-snug text-muted">{t("chooser.guidedBody")}</span>
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
              <span className="block text-base font-medium text-fg">{t("chooser.copyTitle")}</span>
              <span className="block text-sm leading-snug text-muted">{t("chooser.copyBody")}</span>
            </span>
            <Copy size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
          </button>
        </div>
        {copyOpen && (
          <div className="flex flex-col gap-tight border-t border-hairline p-card">
            <AffixInput
              type="search"
              prefix={<Search size={16} strokeWidth={1.5} aria-hidden />}
              value={copyQuery}
              onChange={(e) => setCopyQuery(e.target.value)}
              placeholder={t("chooser.copySearch")}
              aria-label={t("chooser.copySearch")}
              autoFocus
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
                      <span className="block truncate text-sm font-medium">{x.name}</span>
                      <span className="block truncate text-xs text-muted">{x.sub}</span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-brand-foreground">
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

/** One card, in either group. Wide: a card with a tile, the title, what it is
 *  for and an example. Narrow: a two-line row inside the group's one card. */
function KindCard({ wide, href, mark, title, body, examples, count }: { wide: boolean; href: string; mark: ReactNode; title: string; body: string; examples: string; count: number }) {
  const t = useTranslations("catalog");
  return wide ? (
    <li>
      <Link href={href} className="card-surface card-interactive group flex h-full flex-col gap-tight p-card">
        <span className="flex items-start justify-between gap-tight">
          {mark}
          {count > 0 && <span className="text-xs text-muted">{t("chooser.have", { count })}</span>}
        </span>
        <span className="mt-tight text-md font-semibold leading-snug text-fg">{title}</span>
        <span className="text-sm leading-snug text-muted">{body}</span>
        <span className="mt-auto pt-tight text-xs leading-snug text-muted">
          <span className="font-medium text-fg">{t("chooser.eg")}</span> {examples}
        </span>
      </Link>
    </li>
  ) : (
    <li>
      <Link
        href={href}
        data-focus-inset=""
        className="flex min-h-14 items-center gap-comfortable px-card py-comfortable transition-colors duration-quick active:bg-muted-wash"
      >
        {mark}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline justify-between gap-tight">
            <span className="min-w-0 truncate text-md font-semibold leading-snug text-fg">{title}</span>
            {count > 0 && <span className="shrink-0 text-xs text-muted">{t("chooser.haveShort", { count })}</span>}
          </span>
          <span className="line-clamp-2 text-sm leading-snug text-muted">{body}</span>
        </span>
        <ChevronRight size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}

/** The cards of a group: a grid from sm, one card of rows below. */
function Group({ wide, id, title, rule, children }: { wide: boolean; id: string; title: string; rule: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <FamilyHead id={id} title={title} rule={rule} />
      {wide ? (
        <ul className="grid gap-section sm:grid-cols-2 xl:grid-cols-4">{children}</ul>
      ) : (
        <ul className="card-surface divide-y divide-hairline overflow-hidden">{children}</ul>
      )}
    </section>
  );
}

/**
 * A kind of event's page look, as a 40px swatch where a booking has its glyph:
 * the look's own ground and line, "Aa" in its display face and ink, and a bar of
 * its accent. Literal colours on purpose — a published page does not follow the
 * operator's theme, so neither does the hint of it.
 */
function LookSwatch({ c }: { c: CategoryDef }) {
  return (
    <span
      aria-hidden
      className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-inner"
      style={{ background: c.theme.bg, border: `1px solid ${c.theme.line}` }}
    >
      <span
        style={{
          fontFamily: `${c.theme.display}, var(--font-hind-siliguri), sans-serif`,
          fontWeight: 700,
          fontSize: 17,
          lineHeight: 1,
          letterSpacing: c.theme.displayTracking,
          color: c.theme.fg,
        }}
      >
        Aa
      </span>
      <span style={{ position: "absolute", left: 7, right: 7, bottom: 5, height: 3, borderRadius: 999, background: c.theme.accent }} />
    </span>
  );
}

/** A group's heading and the rule that separates it from the other — the
 *  one sentence that settles "is a boat trip a tour or an event?", as one muted
 *  line under the heading rather than a pill beside it. */
function FamilyHead({ id, title, rule }: { id: string; title: string; rule: string }) {
  return (
    <div className="mb-comfortable">
      <h2 id={id} className="text-lg font-semibold tracking-title text-fg">{title}</h2>
      <p className="mt-0.5 text-sm text-muted">{rule}</p>
    </div>
  );
}
