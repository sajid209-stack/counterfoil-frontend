"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Archive,
  Briefcase,
  CalendarOff,
  Clock,
  Copy,
  Disc3,
  Eye,
  EyeOff,
  Info,
  LayoutGrid,
  Music,
  Palette,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RotateCcw,
  Search,
  Ship,
  SlidersHorizontal,
  Trash2,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  ActionMenu,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageShell,
  ProductThumb,
  StatStrip,
  StatusPill,
  Tabs,
  useToast,
  type ActionMenuItem,
  type Column,
  type PillTone,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { MD, useMediaQuery } from "@/lib/useMedia";
import {
  archiveEvent,
  archiveProduct,
  createProduct,
  deleteEvent,
  duplicateEvent,
  eventRevenue,
  listBookings,
  listCategories,
  listEvents,
  listProducts,
  listResources,
  listStaff,
  restoreEvent,
  setEventPublished,
  updateProduct,
  type Product,
} from "@/lib/api";
import { behaviourSubtitle } from "@/lib/behaviour";
import { CATEGORIES, categoryById } from "@/lib/events/catalog";
import { templateFontVars } from "@/lib/events/fonts";
import { formatDay, formatPriceShort } from "@/lib/format";
import { DAY_LABELS, DEMO_TODAY, demoNow } from "@/lib/schedule";
import type { Blocker, SellingWarning } from "@/lib/sellable";
import {
  bookingKindOf,
  bookingUse,
  eventFill,
  eventItem,
  needsAttention,
  productCopy,
  productItem,
  type CatalogItem,
  type CatalogState,
} from "@/lib/catalog";
import { CatalogChooser } from "./_components/CatalogChooser";

/* A catalog is scanned, not paged through: fifty rows is a whole venue's
   catalog on one screen of scrolling, and paging at twelve split a list of
   twenty-six across three. */
const PAGE_SIZE = 50;

const MOVED_KEY = "cf_catalog_moved_seen";
const MOVED_EVENT = "cf-catalog-moved";
const subscribeMoved = (cb: () => void) => {
  window.addEventListener(MOVED_EVENT, cb);
  return () => window.removeEventListener(MOVED_EVENT, cb);
};
const movedUnseen = () => {
  try {
    return localStorage.getItem(MOVED_KEY) !== "1";
  } catch {
    return false;
  }
};
type Kind = "all" | "bookings" | "events";
/** The state chips, plus one facet that is not a state: needs attention cuts
 *  across them — a course on sale whose dates run out next week is on sale AND
 *  needs somebody. */
type Facet = "attention" | CatalogState;
const FACETS: Facet[] = ["attention", "onSale", "soldOut", "offSale", "ended", "archived"];
const STATE_TONE: Record<CatalogState, PillTone> = {
  onSale: "success",
  needsSetup: "warning",
  soldOut: "info",
  offSale: "neutral",
  ended: "neutral",
  archived: "neutral",
};
/** Each event category's glyph, for a row that has no cover image. */
const EVENT_ICON: Record<string, LucideIcon> = {
  entertainment: Music,
  sports: Trophy,
  business: Briefcase,
  arts: Palette,
  travel: Ship,
  nightlife: Disc3,
};

export default function CatalogPage() {
  // The tab lives in the URL (`?kind=events`), so the old /events and
  // /bookings addresses land on the view they always showed.
  return (
    <Suspense>
      <Catalog />
    </Suspense>
  );
}

/**
 * The catalog: everything the operator sells, in one list.
 *
 * Bookings and Events were two features, and "what do we sell?" had half its
 * answer in each. This is one list, read in one vocabulary (`lib/catalog`):
 * a state that means the same thing for a lane and for a concert, a type
 * column in the operator's words, and one row menu and one bulk bar that each
 * do the right thing to whichever kind they are pointed at.
 *
 * The kinds stay one click apart as views — All · Bookings · Events — because
 * the people who used each list for months should find it where their hands
 * expect it. State is a filter under the views, counted, so "what needs me?"
 * is a glance rather than a search.
 */
function Catalog() {
  const t = useTranslations("catalog");
  const tp = useTranslations("products");
  const te = useTranslations("events");
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const compact = !useMediaQuery(MD, true);
  const now = useMemo(() => demoNow(), []);

  const kindParam = params.get("kind");
  const kind: Kind = kindParam === "bookings" || kindParam === "events" ? kindParam : "all";
  const setKind = (k: Kind) => {
    setPage(1);
    setCategory("");
    router.replace(k === "all" ? "/catalog" : `/catalog?kind=${k}`, { scroll: false });
  };

  const [search, setSearch] = useState("");
  const [states, setStates] = useState<Facet[]>([]);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "smart", order: "asc" });
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  /* On a phone the checkboxes are a mode, not a column on every card. */
  const [selecting, setSelecting] = useState(false);
  const wantArchived = states.includes("archived");

  const productsQ = useApiQuery(
    () => listProducts({ pageSize: 500, filters: { includeArchived: wantArchived } }),
    [reloadKey, wantArchived],
  );
  const eventsQ = useApiQuery(
    () => listEvents({ pageSize: 200 }),
    [reloadKey],
  );
  const archivedEventsQ = useApiQuery(() => listEvents({ pageSize: 200, filters: { status: "archived" } }), [reloadKey]);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100 }), []);
  const teamQ = useApiQuery(() => listStaff({ pageSize: 100 }), []);
  const categoriesQ = useApiQuery(() => listCategories({ pageSize: 100 }), []);
  const bookingsQ = useApiQuery(() => listBookings({ pageSize: 1000 }), [reloadKey]);

  const resources = useMemo(() => resourcesQ.data?.data ?? [], [resourcesQ.data]);
  const team = useMemo(() => teamQ.data?.data ?? [], [teamQ.data]);
  const productCats = useMemo(() => categoriesQ.data?.data ?? [], [categoriesQ.data]);

  /* What each booking has sold ahead of today — the fallback for a booking
     with no capacity to draw a bar against. Counted by the slot's own date: a
     booking carries no date of its own sale, and the demand still to come is
     the figure a manager acts on. */
  const recent = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of bookingsQ.data?.data ?? []) {
      if (b.status !== "confirmed" || b.slotStart.slice(0, 10) < DEMO_TODAY) continue;
      m.set(b.productId, (m.get(b.productId) ?? 0) + 1);
    }
    return m;
  }, [bookingsQ.data]);

  /* How full each booking's next week is — the same bar an event's fill draws,
     so a lane and a concert can be compared down one column. */
  const use = useMemo(() => {
    const m = new Map<string, ReturnType<typeof bookingUse>>();
    for (const p of productsQ.data?.data ?? []) m.set(p.id, bookingUse(p, DEMO_TODAY));
    return m;
    // Bookings live in the mock store the helper reads; a reload is what moves them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsQ.data, bookingsQ.data]);

  const items = useMemo<CatalogItem[]>(() => {
    const events = [...(eventsQ.data?.data ?? []), ...(wantArchived ? (archivedEventsQ.data?.data ?? []) : [])];
    return [
      ...(productsQ.data?.data ?? []).map((p) => productItem(p, resources, DEMO_TODAY)),
      ...events.map((e) => eventItem(e, now)),
    ];
  }, [productsQ.data, eventsQ.data, archivedEventsQ.data, wantArchived, resources, now]);

  const loading = (productsQ.loading && !productsQ.data) || (eventsQ.loading && !eventsQ.data);

  // ── filtering ─────────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const typeLabel = (i: CatalogItem) =>
    i.product ? t(`type.${bookingKindOf(i.product.bookingType)}`) : t("type.event", { category: te(`category.${categoryById(i.event!.categoryId).key}`) });
  /** The type in one short line: a booking's kind, an event's category —
   *  the date beside it already says it happens once. */
  const typeShort = (i: CatalogItem) =>
    i.product ? t(`type.${bookingKindOf(i.product.bookingType)}`) : te(`category.${categoryById(i.event!.categoryId).key}`);
  const matchesSearch = (i: CatalogItem) =>
    !q ||
    i.name.toLowerCase().includes(q) ||
    typeLabel(i).toLowerCase().includes(q) ||
    (i.event?.venueName ?? "").toLowerCase().includes(q) ||
    (i.product?.description ?? "").toLowerCase().includes(q);
  const inFacet = (i: CatalogItem, f: Facet) => (f === "attention" ? needsAttention(i) : i.state === f);
  /** Archived is out of every view until asked for by name — the rule both
   *  lists already followed, and what makes Archive safe rather than a
   *  disappearance. */
  const visibleByState = (i: CatalogItem) => (states.length ? states.some((f) => inFacet(i, f)) : i.state !== "archived");
  const ofKind = (i: CatalogItem, k: Kind) => k === "all" || (k === "bookings" ? i.kind === "booking" : i.kind === "event");
  const matchesCategory = (i: CatalogItem) =>
    !category ||
    (category.startsWith("ev:") ? i.event?.categoryId === category.slice(3) : i.product?.categoryId === category);

  const base = items.filter(matchesSearch);
  const counts = {
    all: base.filter(visibleByState).length,
    bookings: base.filter((i) => i.kind === "booking" && visibleByState(i)).length,
    events: base.filter((i) => i.kind === "event" && visibleByState(i)).length,
  };
  const inKind = base.filter((i) => ofKind(i, kind) && matchesCategory(i));
  const facetCounts = Object.fromEntries(FACETS.map((f) => [f, inKind.filter((i) => inFacet(i, f)).length])) as Record<Facet, number>;
  const sorted = useMemo(() => {
    const list = inKind.filter(visibleByState);
    const dir = sort.order === "asc" ? 1 : -1;
    const rank: Record<CatalogState, number> = { needsSetup: 0, onSale: 1, soldOut: 2, offSale: 3, ended: 4, archived: 5 };
    /* What needs somebody leads, whatever its state — a course on sale whose
       dates run out next week is the row a manager should see first. */
    const rankOf = (i: CatalogItem) => (needsAttention(i) ? -1 : rank[i.state]);
    return [...list].sort((a, b) => {
      if (sort.key === "name") return dir * a.name.localeCompare(b.name);
      if (sort.key === "price") return dir * ((a.fromPrice ?? Infinity) - (b.fromPrice ?? Infinity));
      if (sort.key === "updated") return dir * b.updatedAt.localeCompare(a.updatedAt);
      /* The default: what needs doing, then what is on sale — upcoming events
         by date ahead of bookings, which have no date to sort by — then what
         is off, ended or archived. The order a manager reads a catalog in. */
      return (
        rankOf(a) - rankOf(b) ||
        (a.startsAt && b.startsAt ? a.startsAt.localeCompare(b.startsAt) : a.startsAt ? -1 : b.startsAt ? 1 : 0) ||
        a.name.localeCompare(b.name)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- derived from the filters above
  }, [items, kind, q, states, category, sort]);
  /* Rows hold their places through an action. The default order ranks by
     state, so taking a row off sale would otherwise move it — often to a later
     page — at the moment someone looks for it to check the change, or to press
     Undo. Changing a filter or the sort is asking for a new order, so the held
     one lapses as soon as any of them moves. */
  const sig = `${kind}|${q}|${states.join()}|${category}|${sort.key}|${sort.order}`;
  const [held, setHeld] = useState<{ sig: string; keys: string[] } | null>(null);
  const rows = useMemo(() => {
    if (!held || held.sig !== sig) return sorted;
    const at = new Map(held.keys.map((k, n) => [k, n]));
    const place = (k: string) => at.get(k) ?? Number.MAX_SAFE_INTEGER;
    return [...sorted].sort((a, b) => place(a.key) - place(b.key));
  }, [sorted, held, sig]);
  const holdOrder = () => setHeld({ sig, keys: rows.map((r) => r.key) });
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => {
    if ((page - 1) * PAGE_SIZE >= rows.length && page > 1) setPage(1);
  }, [rows.length, page]);

  const summary = useMemo(() => {
    const live = items.filter((i) => i.state !== "archived");
    const upcoming = live.filter((i) => i.event && i.state !== "ended");
    /* What the catalog is doing, not what is in it — the chips below already
       count that. One figure per question a manager opens this page with. */
    const liveBookings = live.filter((i) => i.product);
    const uses = liveBookings.map((i) => use.get(i.id)).filter((u): u is NonNullable<typeof u> => !!u);
    const used = uses.reduce((n, u) => n + u.used, 0);
    const capWeek = uses.reduce((n, u) => n + u.cap, 0);
    const next = upcoming.filter((i) => i.state !== "offSale").sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""))[0];
    return {
      attention: live.filter(needsAttention).length,
      bookedAhead: [...recent.values()].reduce((n, x) => n + x, 0),
      ticketsSold: upcoming.reduce((n, i) => n + eventFill(i.event!).sold, 0),
      ticketRevenue: upcoming.reduce((n, i) => n + eventRevenue(i.event!), 0),
      weekUse: capWeek ? Math.round((used / capWeek) * 100) : null,
      weekUsed: used,
      weekCap: capWeek,
      bookingsOnSale: liveBookings.filter((i) => i.state === "onSale").length,
      bookingsTotal: liveBookings.length,
      eventsOnSale: upcoming.filter((i) => i.state === "onSale" || i.state === "soldOut").length,
      eventsTotal: live.filter((i) => i.event).length,
      next,
    };
  }, [items, recent, use]);

  const toggleFacet = (f: Facet) => {
    setPage(1);
    setStates((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  };

  // ── acting ────────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | { kind: "archive" | "delete"; items: CatalogItem[] }>(null);
  const [busy, setBusy] = useState(false);
  const reload = () => {
    holdOrder();
    setSelected(new Set());
    setReloadKey((n) => n + 1);
  };
  const toggleOne = (key: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(r.key));
  const togglePage = () =>
    setSelected((cur) => {
      const next = new Set(cur);
      pageRows.forEach((r) => (allOnPage ? next.delete(r.key) : next.add(r.key)));
      return next;
    });
  const selectedItems = items.filter((i) => selected.has(i.key));
  const isOn = (i: CatalogItem) => (i.product ? i.product.status === "active" : !!i.event?.published);
  const actionable = (i: CatalogItem) => i.state !== "archived" && i.state !== "ended";
  /* What each bulk action would actually change. A button that would do
     nothing to anything selected says so by being unavailable, and one that
     would act on part of the selection says how many. */
  const canPutOn = selectedItems.filter((i) => actionable(i) && !isOn(i));
  const canTakeOff = selectedItems.filter((i) => actionable(i) && isOn(i));

  /**
   * On sale and off sale, for either kind: a booking is switched on or off, an
   * event is published or unpublished. One word for the operator, the right
   * call underneath. Reversible, so it offers Undo rather than asking first.
   */
  const setOnSale = async (targets: CatalogItem[], on: boolean, undoable = true) => {
    const acted = targets.filter((i) => actionable(i) && isOn(i) !== on);
    if (!acted.length) return;
    setBusy(true);
    const before = acted.map((i) => ({ i, was: isOn(i) }));
    for (const i of acted) {
      if (i.product) await updateProduct(i.id, { status: on ? "active" : "inactive" });
      else await setEventPublished(i.id, on);
    }
    setBusy(false);
    reload();
    toast.success(
      acted.length === 1 ? t(on ? "toast.onSaleOne" : "toast.offSaleOne", { name: acted[0].name }) : t(on ? "toast.onSaleMany" : "toast.offSaleMany", { count: acted.length }),
      undoable
        ? {
            label: t("undo"),
            run: async () => {
              for (const { i, was } of before) {
                if (i.product) await updateProduct(i.id, { status: was ? "active" : "inactive" });
                else await setEventPublished(i.id, was);
              }
              reload();
            },
          }
        : undefined,
    );
  };

  const doArchive = async (targets: CatalogItem[]) => {
    setBusy(true);
    for (const i of targets) {
      if (i.product) await archiveProduct(i.id);
      else await archiveEvent(i.id);
    }
    setBusy(false);
    setConfirm(null);
    reload();
    toast.success(targets.length === 1 ? t("toast.archivedOne", { name: targets[0].name }) : t("toast.archivedMany", { count: targets.length }));
  };

  const doDelete = async (target: CatalogItem) => {
    setBusy(true);
    const res = await deleteEvent(target.id);
    setBusy(false);
    setConfirm(null);
    if (!res.ok) return toast.error(res.error.fieldErrors?.event ?? res.error.message);
    reload();
    toast.success(te("toast.deleted", { title: target.name }));
  };

  /** Make the next one like the last one. Lands off sale, so a half-edited copy
   *  never reaches the till or the public page, and opens straight into it —
   *  the only reason to duplicate is to change it. */
  const duplicate = async (i: CatalogItem) => {
    setBusy(true);
    if (i.product) {
      const p: Product = i.product;
      const res = await createProduct(productCopy(p, tp("copyOf", { name: p.name })));
      setBusy(false);
      if (res.ok) {
        toast.success(t("toast.duplicated", { name: res.data.name }));
        router.push(`/catalog/bookings/${res.data.id}`);
      }
      return;
    }
    const res = await duplicateEvent(i.id, te("copyTitle", { title: i.name }));
    setBusy(false);
    if (!res.ok) return toast.error(res.error.message);
    toast.success(t("toast.duplicated", { name: res.data.title }));
    router.push(`/catalog/events/${res.data.id}`);
  };

  const actionsFor = (i: CatalogItem): ActionMenuItem[] => {
    if (i.state === "archived") {
      if (i.product) {
        return [
          { key: "restore", label: t("action.restore"), icon: <RotateCcw size={14} strokeWidth={1.5} />, onSelect: async () => { await updateProduct(i.id, { status: "inactive", archivedAt: null } as never); reload(); toast.success(t("toast.restored", { name: i.name })); } },
        ];
      }
      const sold = i.event ? eventFill(i.event).sold : 0;
      return [
        { key: "restore", label: t("action.restore"), icon: <RotateCcw size={14} strokeWidth={1.5} />, onSelect: async () => { await restoreEvent(i.id); reload(); toast.success(t("toast.restored", { name: i.name })); } },
        {
          key: "delete",
          label: te("action.delete"),
          icon: <Trash2 size={14} strokeWidth={1.5} />,
          destructive: true,
          separated: true,
          disabled: sold > 0,
          hint: sold > 0 ? te("action.deleteBlocked", { count: sold }) : undefined,
          onSelect: () => setConfirm({ kind: "delete", items: [i] }),
        },
      ];
    }
    const on = isOn(i);
    return [
      { key: "edit", label: t("action.edit"), icon: <Pencil size={14} strokeWidth={1.5} />, onSelect: () => router.push(i.event ? `${i.href}/edit` : i.href) },
      { key: "duplicate", label: t("action.duplicate"), icon: <Copy size={14} strokeWidth={1.5} />, onSelect: () => duplicate(i) },
      i.state === "ended"
        ? null
        : on
          ? { key: "offSale", label: t("action.offSale"), icon: i.event ? <EyeOff size={14} strokeWidth={1.5} /> : <PowerOff size={14} strokeWidth={1.5} />, onSelect: () => setOnSale([i], false) }
          : { key: "onSale", label: t("action.onSale"), icon: i.event ? <Eye size={14} strokeWidth={1.5} /> : <Power size={14} strokeWidth={1.5} />, onSelect: () => setOnSale([i], true) },
      { key: "archive", label: t("action.archive"), icon: <Archive size={14} strokeWidth={1.5} />, destructive: true, separated: true, onSelect: () => setConfirm({ kind: "archive", items: [i] }) },
    ].filter(Boolean) as ActionMenuItem[];
  };

  /* Archiving an event people hold tickets for is allowed — it comes off sale
     and the tickets stay good — but it is not a click to make blind, so the
     confirmation names what has been sold and for when. */
  const archiveSold = (confirm?.kind === "archive" ? confirm.items : []).filter(
    (i) => i.event && i.state !== "ended" && eventFill(i.event).sold > 0,
  );
  const archiveMessage = !confirm
    ? undefined
    : confirm.kind === "delete"
      ? te("confirm.deleteBody")
      : archiveSold.length === 0
        ? t("confirm.archiveBody")
        : archiveSold.length === 1 && confirm.items.length === 1
          ? t("confirm.archiveSoldOne", { count: eventFill(archiveSold[0].event!).sold.toLocaleString(), date: formatDay(archiveSold[0].event!.startsAt.slice(0, 10)) })
          : t("confirm.archiveSoldMany", { count: archiveSold.length });

  // ── how a row reads ───────────────────────────────────────────────────────
  const blockerLabel = (b: Blocker) =>
    tp(b === "noPrice" ? "blockerNoPrice" : b === "noSchedule" ? "blockerNoSchedule" : b === "noResource" ? "blockerNoResource" : "blockerNoChannel");
  const warningLabel = (w: SellingWarning) => t(`warning.${w.kind}`, { date: formatDay(w.date) });
  const dateOf = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  /** When a booking can be had: its days over its hours — the same two lines
   *  an event's date and time take — or how it is used when it has none. */
  const whenOf = (p: Product): [string, string | null] => {
    const s = p.schedule;
    if (s?.startTime && s.endTime) {
      const days = s.openDays?.length === 7 || !s.openDays ? t("everyDay") : [...s.openDays].sort().map((d) => DAY_LABELS[d]).join(" ");
      return [days, `${s.startTime}–${s.endTime}`];
    }
    if (p.courseDates?.length) return [t("sessions", { count: p.courseDates.length }), formatDay([...p.courseDates].sort()[0])];
    return [t(`whenKind.${bookingKindOf(p.bookingType)}`), null];
  };

  const Thumb = ({ i }: { i: CatalogItem }) => {
    if (i.product) return <ProductThumb images={i.product.images} name={i.name} bookingType={i.product.bookingType} size="chip" />;
    const cover = i.event!.customisation.coverUrl;
    if (cover) {
      return (
        <span
          aria-hidden
          className="block h-10 w-10 shrink-0 rounded-xs border border-line bg-cover bg-center"
          style={{ backgroundImage: `url("${cover}")` }}
        />
      );
    }
    /* No cover yet: the category's glyph on a wash of the event's own accent —
       the same shape a booking without a photo takes, rather than a blank tile
       that reads as an image that failed to load. The glyph is ink, not the
       accent, so a dark accent on a dark theme cannot make it vanish. */
    const cat = categoryById(i.event!.categoryId);
    const Icon = EVENT_ICON[cat.key] ?? Music;
    const accent = i.event!.customisation.accent;
    return (
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xs border"
        style={{
          background: `color-mix(in srgb, ${accent} 16%, transparent)`,
          borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`,
        }}
      >
        <Icon size={18} strokeWidth={1.5} className="text-fg" />
      </span>
    );
  };

  const Sub = ({ i }: { i: CatalogItem }) => {
    if (i.blockers.length) {
      const text = i.blockers.map(blockerLabel).join(" · ");
      return (
        <span className="flex min-w-0 items-center gap-inline text-[12px] text-warning" title={text}>
          <AlertTriangle size={12} strokeWidth={2} className="shrink-0" aria-hidden />
          <span className="truncate">{text}</span>
        </span>
      );
    }
    if (i.warnings.length) {
      const text = i.warnings.map(warningLabel).join(" · ");
      const Icon = i.warnings[0].kind === "datesRunOut" ? CalendarOff : Clock;
      return (
        <span className="flex min-w-0 items-center gap-inline text-[12px] text-warning" title={text}>
          <Icon size={12} strokeWidth={2} className="shrink-0" aria-hidden />
          <span className="truncate">{text}</span>
        </span>
      );
    }
    return (
      <span className="block truncate text-[12px] text-muted">
        {i.product ? behaviourSubtitle(i.product, { resources, team }) : i.event!.venueName}
      </span>
    );
  };

  /** One bar for both kinds: an event's tickets against its capacity, a
   *  booking's next seven days against what it could have held. */
  const Fill = ({ top, pct, bottom }: { top: string; pct: number; bottom: string }) => (
    <span className="flex w-full min-w-0 flex-col gap-inline">
      <span className="flex items-baseline justify-between gap-tight whitespace-nowrap text-[12px]">
        <span className="truncate tabular-nums">{top}</span>
        <span className="text-muted tabular-nums">{pct}%</span>
      </span>
      <span className="h-1.5 w-full overflow-hidden rounded-full bg-line">
        <span className={cn("block h-full rounded-full", pct >= 90 ? "bg-ember-solid" : "bg-success")} style={{ width: `${pct}%` }} />
      </span>
      <span className="truncate whitespace-nowrap text-[12px] text-muted tabular-nums">{bottom}</span>
    </span>
  );

  const Selling = ({ i }: { i: CatalogItem }) => {
    if (i.event) {
      const f = eventFill(i.event);
      return <Fill top={t("soldOf", { sold: f.sold.toLocaleString(), cap: f.cap.toLocaleString() })} pct={f.pct} bottom={formatPriceShort(eventRevenue(i.event))} />;
    }
    const u = use.get(i.id);
    if (u) {
      return (
        <Fill
          top={t(u.unit === "slots" ? "useSlots" : "usePlaces", { used: u.used.toLocaleString(), cap: u.cap.toLocaleString() })}
          pct={u.pct}
          bottom={t("next7")}
        />
      );
    }
    const n = recent.get(i.id) ?? 0;
    return n === 0 ? (
      <span className="text-[12px] text-muted">
        <span aria-hidden>—</span>
        <span className="sr-only">{t("noneRecent")}</span>
      </span>
    ) : (
      <span className="text-[12px] tabular-nums">{t("recent", { count: n })}</span>
    );
  };

  /** Whether a row has anything to draw in its Selling column. */
  const hasSelling = (i: CatalogItem) => !!i.event || !!use.get(i.id) || (recent.get(i.id) ?? 0) > 0;

  const StatePill = ({ i }: { i: CatalogItem }) => (
    <StatusPill tone={STATE_TONE[i.state]} shape={i.state === "offSale" || i.state === "archived" ? "record" : "transaction"} className="whitespace-nowrap">
      {t(`state.${i.state}`)}
    </StatusPill>
  );

  const checkboxCls = "h-4 w-4 accent-[var(--color-ember)]";
  const somePicked = pageRows.some((r) => selected.has(r.key)) && !allOnPage;
  const columns: Column<CatalogItem>[] = [
    {
      key: "select",
      header: <PageCheckbox checked={allOnPage} mixed={somePicked} onChange={togglePage} label={t("selectPage")} className={checkboxCls} />,
      width: "2.75rem",
      render: (i) => (
        <span onClick={(e) => e.stopPropagation()} className="flex">
          <input
            type="checkbox"
            checked={selected.has(i.key)}
            onChange={() => toggleOne(i.key)}
            aria-label={t("selectOne", { name: i.name })}
            className={checkboxCls}
          />
        </span>
      ),
    },
    {
      key: "name",
      header: t("col.item"),
      sortable: true,
      render: (i) => (
        <span className="flex min-w-0 items-center gap-comfortable">
          <Thumb i={i} />
          <span className="flex min-w-0 flex-col">
            <span className="line-clamp-2 break-words font-medium leading-snug text-fg" title={i.name}>{i.name}</span>
            <Sub i={i} />
          </span>
        </span>
      ),
    },
    {
      key: "type",
      header: t("col.type"),
      width: "11.75rem",
      render: (i) => (
        <span className="flex min-w-0 items-center gap-inline text-[13px]" title={typeLabel(i)}>
          {/* An event carries its own accent as a dot; a booking a neutral
              one — the brand colour is for what can be pressed, not for
              decorating every other row. Ringed, so a dark accent still reads
              on a dark card. */}
          <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full ring-1 ring-fg/25", i.kind === "booking" && "bg-fg/35")} style={i.event ? { background: i.event.customisation.accent } : undefined} />
          <span className="truncate">{typeShort(i)}</span>
        </span>
      ),
    },
    {
      key: "when",
      header: t("col.when"),
      width: "8rem",
      render: (i) =>
        i.event ? (
          <span className="flex flex-col whitespace-nowrap text-[13px]">
            <span>{dateOf(i.event.startsAt)}</span>
            <span className="text-[12px] text-muted">{timeOf(i.event.startsAt)}</span>
          </span>
        ) : (
          <span className="flex min-w-0 flex-col text-[13px]">
            <span className="line-clamp-2 break-words">{whenOf(i.product!)[0]}</span>
            {whenOf(i.product!)[1] && <span className="text-[12px] text-muted tabular-nums">{whenOf(i.product!)[1]}</span>}
          </span>
        ),
    },
    {
      key: "price",
      header: t("col.from"),
      align: "right",
      mono: false,
      sortable: true,
      width: "6rem",
      render: (i) => (
        <span className="whitespace-nowrap text-[13px] tabular-nums">
          {i.fromPrice === null ? <span className="text-muted">{t(i.kind === "event" ? "soldOut" : "noPrice")}</span> : i.fromPrice === 0 ? t("free") : formatPriceShort(i.fromPrice)}
        </span>
      ),
    },
    { key: "selling", header: t("col.selling"), width: "10.5rem", render: (i) => <Selling i={i} /> },
    { key: "state", header: t("col.state"), width: "7.5rem", render: (i) => <StatePill i={i} /> },
    {
      key: "actions",
      header: <span className="sr-only">{t("col.actions")}</span>,
      width: "3rem",
      render: (i) => (
        <span className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <ActionMenu items={actionsFor(i)} label={t("rowActions", { name: i.name })} />
        </span>
      ),
    },
  ];

  const selectCls = "h-11 min-w-0 flex-1 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse md:h-9 md:flex-none";
  const filtered = !!q || states.length > 0 || !!category;
  const empty = !loading && items.filter((i) => i.state !== "archived").length === 0 && !wantArchived;
  const clearAll = () => {
    setSearch("");
    setStates([]);
    setCategory("");
    setPage(1);
  };

  /* Chips that apply to this view, and among those only the ones with
     something in them — a chip that would show an empty list is a question
     the page already knows the answer to. An active chip always stays, so it
     can be switched off; Archived always stays, because its count is not
     known until it is asked for. */
  const facetChips = FACETS.filter((f) =>
    kind === "bookings" ? !["soldOut", "ended"].includes(f) : kind === "events" ? f !== "attention" : true,
  ).filter((f) => f === "archived" || states.includes(f) || facetCounts[f] > 0);

  // ── the one-time note about the move ──────────────────────────────────────
  /* Read through useSyncExternalStore: the server has no storage, so it says
     "seen" and renders no note, and the client corrects that on hydration —
     no flash of a note for people who have already dismissed it. */
  const moved = useSyncExternalStore(subscribeMoved, movedUnseen, () => false);
  const dismissMoved = () => {
    try {
      localStorage.setItem(MOVED_KEY, "1");
    } catch {
      /* private window: the note simply comes back next time */
    }
    window.dispatchEvent(new Event(MOVED_EVENT));
  };

  const chip = (on: boolean) =>
    cn(
      "flex h-11 shrink-0 items-center gap-tight whitespace-nowrap rounded-full border px-comfortable text-[13px] transition-colors duration-quick md:h-8",
      on ? "border-inverse bg-inverse text-inverse-fg" : "border-line bg-card text-fg hover:border-strong",
    );

  return (
    <PageShell
      title={t("title")}
      description={t("description")}
      actions={
        <div className="flex gap-tight">
          {!compact && (
            <Button variant="secondary" icon={<LayoutGrid size={16} strokeWidth={1.5} />} onClick={() => router.push("/catalog/layouts")}>
              {tp("seatLayouts")}
            </Button>
          )}
          <Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push(kind === "all" ? "/catalog/new" : `/catalog/new?kind=${kind}`)}>
            {t("add")}
          </Button>
        </div>
      }
    >
      {/* First run: nothing to list yet, so the page IS the way to add the
          first thing. An empty table with a lonely button teaches nothing; the
          chooser says what a catalog holds while it asks what to add. */}
      {empty ? (
        <section className="card-surface p-card sm:p-major">
          <div className="mb-major max-w-2xl">
            <p className="type-label text-[12px] text-brand-foreground">{t("firstRun.eyebrow")}</p>
            <h2 className="mt-inline text-[22px] font-semibold tracking-tight">{t("firstRun.title")}</h2>
            <p className="mt-tight text-[14px] text-muted">{t("firstRun.body")}</p>
            <ol className="mt-section grid gap-tight sm:grid-cols-3">
              {(["pick", "shape", "sell"] as const).map((k, n) => (
                <li key={k} className="flex items-start gap-tight rounded-sm bg-muted-wash px-comfortable py-tight text-[13px]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-card font-mono text-[12px] font-semibold">{n + 1}</span>
                  <span>{t(`firstRun.step.${k}`)}</span>
                </li>
              ))}
            </ol>
          </div>
          <CatalogChooser />
        </section>
      ) : (
        <div className={cn("flex flex-col gap-section", templateFontVars, selected.size > 0 && "pb-24")}>
          {/* News, not a warning: neutral ground and an information glyph. An
              ember tint and an alert mark read as "something is wrong" on the
              first screen of a feature that is working exactly as intended. */}
          {moved && (
            <div role="status" className="flex items-center gap-comfortable rounded-sm border border-line bg-card px-comfortable py-tight md:items-start">
              <Info size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-fg" aria-hidden />
              <p className="min-w-0 flex-1 text-[13px]">
                <span className="font-medium">{t("moved.title")}</span> <span className="text-muted max-md:hidden">{t("moved.body")}</span>
              </p>
              <button type="button" onClick={dismissMoved} className="-my-inline min-h-11 shrink-0 rounded-sm px-tight text-[13px] font-medium text-fg hover:bg-muted-wash md:hidden">
                {t("moved.gotIt")}
              </button>
              <button type="button" onClick={dismissMoved} aria-label={t("moved.dismiss")} className="-my-inline hidden h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-muted-wash hover:text-fg md:flex">
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>
          )}

          {/* On a phone the four figures are one line, not a row of cards that
              scrolls off the edge: the list is what the page is for, and every
              card above it pushes the first row further down. */}
          {compact ? (
            <p className="flex flex-wrap items-center gap-x-tight gap-y-inline text-[13px] text-muted">
              <button
                type="button"
                onClick={() => toggleFacet("attention")}
                aria-pressed={states.includes("attention")}
                className={cn("min-h-11 font-medium underline-offset-2 hover:underline", summary.attention > 0 ? "text-warning" : "text-fg")}
              >
                {t("stat.attentionLine", { count: summary.attention })}
              </button>
              <span aria-hidden>·</span>
              <span>{t("stat.bookedAheadLine", { count: summary.bookedAhead })}</span>
              <span aria-hidden>·</span>
              <span>{t("stat.ticketsSoldLine", { count: summary.ticketsSold })}</span>
            </p>
          ) : (
            <StatStrip
              loading={loading}
              items={[
                ...(kind !== "events"
                  ? [
                      {
                        key: "attention",
                        label: t("stat.attention"),
                        value: String(summary.attention),
                        tone: summary.attention > 0 ? ("warning" as const) : undefined,
                        note: t("stat.attentionNote"),
                        onClick: () => toggleFacet("attention"),
                        pressed: states.includes("attention"),
                      },
                      { key: "bookedAhead", label: t("stat.bookedAhead"), value: summary.bookedAhead.toLocaleString(), note: t("stat.bookedAheadNote") },
                    ]
                  : []),
                ...(kind === "bookings"
                  ? [
                      {
                        key: "weekUse",
                        label: t("stat.weekUse"),
                        value: summary.weekUse === null ? "—" : `${summary.weekUse}%`,
                        note: t("stat.weekUseNote", { used: summary.weekUsed.toLocaleString(), cap: summary.weekCap.toLocaleString() }),
                      },
                      { key: "onSale", label: t("stat.onSale"), value: `${summary.bookingsOnSale} / ${summary.bookingsTotal}`, note: t("stat.onSaleNote") },
                    ]
                  : [
                      { key: "ticketsSold", label: t("stat.ticketsSold"), value: summary.ticketsSold.toLocaleString(), note: t("stat.ticketsSoldNote") },
                      { key: "ticketRevenue", label: t("stat.ticketRevenue"), value: formatPriceShort(summary.ticketRevenue), note: t("stat.ticketRevenueNote") },
                    ]),
                ...(kind === "events"
                  ? [
                      {
                        key: "next",
                        label: t("stat.nextEvent"),
                        value: summary.next?.startsAt ? formatDay(summary.next.startsAt.slice(0, 10), { weekday: true }) : "—",
                        context: summary.next?.name ?? null,
                        note: summary.next?.name ?? null,
                      },
                      { key: "onSale", label: t("stat.onSale"), value: `${summary.eventsOnSale} / ${summary.eventsTotal}`, note: t("stat.onSaleNote") },
                    ]
                  : []),
              ]}
            />
          )}

          <Tabs
            items={[
              { value: "all", label: t("kind.all"), count: counts.all },
              { value: "bookings", label: t("kind.bookings"), count: counts.bookings },
              { value: "events", label: t("kind.events"), count: counts.events },
            ]}
            value={kind}
            onChange={(v) => setKind(v as Kind)}
          />

          <DataTable
            columns={columns}
            rows={pageRows}
            getRowId={(i) => i.key}
            loading={loading}
            layout="fixed"
            height="page"
            minWidth="60rem"
            isSelected={(i) => selected.has(i.key)}
            sort={sort.key === "smart" ? undefined : sort}
            onSortChange={(key) => {
              setPage(1);
              setSort((s) => ({ key, order: s.key === key && s.order === "asc" ? "desc" : "asc" }));
            }}
            onRowClick={(i) => router.push(i.href)}
            renderCard={(i) => (
              <span className="flex flex-col gap-tight">
                <span className="flex items-start gap-comfortable">
                  {selecting && (
                  <label onClick={(e) => e.stopPropagation()} className="-my-inline -ml-tight flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      checked={selected.has(i.key)}
                      onChange={() => toggleOne(i.key)}
                      aria-label={t("selectOne", { name: i.name })}
                      className={checkboxCls}
                    />
                  </label>
                  )}
                  <Thumb i={i} />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-medium leading-snug">{i.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-tight gap-y-inline text-[12px] text-muted">
                      <StatePill i={i} />
                      <span>
                        {typeShort(i)}
                        {i.event ? ` · ${dateOf(i.event.startsAt)}` : ""}
                      </span>
                      {!hasSelling(i) && (
                        <span className="ml-auto text-sm font-medium tabular-nums text-fg">
                          {i.fromPrice === null ? t(i.kind === "event" ? "soldOut" : "noPrice") : i.fromPrice === 0 ? t("free") : formatPriceShort(i.fromPrice)}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="-mr-tight -mt-inline shrink-0" onClick={(e) => e.stopPropagation()}>
                    <ActionMenu items={actionsFor(i)} label={t("rowActions", { name: i.name })} />
                  </span>
                </span>
                {hasSelling(i) && (
                  <span className="flex items-center justify-between gap-section">
                    <span className="min-w-0 flex-1"><Selling i={i} /></span>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {i.fromPrice === null ? t(i.kind === "event" ? "soldOut" : "noPrice") : i.fromPrice === 0 ? t("free") : formatPriceShort(i.fromPrice)}
                    </span>
                  </span>
                )}
                {(i.blockers.length > 0 || i.warnings.length > 0) && <Sub i={i} />}
              </span>
            )}
            toolbar={
                <div className="flex flex-col gap-tight">
                  <div className="flex flex-wrap items-center gap-tight">
                    {/* The page's select-all is in the table's header row on a
                        desktop; a phone has no header row, so it lives here. */}

                    <div className="relative min-w-0 flex-1 md:flex-none">
                      <Search size={16} strokeWidth={1.5} aria-hidden className="absolute left-comfortable top-1/2 -translate-y-1/2 text-muted" />
                      <input
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                        placeholder={t("searchPlaceholder")}
                        aria-label={t("searchPlaceholder")}
                        className="h-11 w-full min-w-0 rounded-sm border border-line bg-card pl-8 pr-comfortable text-sm outline-none focus:border-inverse md:h-9 md:w-72"
                      />
                    </div>
                    {/* The two selects are a second thought on a phone: behind
                        one button, so the list starts a row higher. */}
                    <button
                      type="button"
                      onClick={() => setSelecting((v) => !v)}
                      aria-pressed={selecting}
                      className="flex h-11 shrink-0 items-center rounded-sm border border-line bg-card px-comfortable text-[13px] font-medium text-fg md:hidden"
                    >
                      {selecting ? t("selectDone") : t("select")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen((v) => !v)}
                      aria-expanded={filtersOpen}
                      aria-label={t("moreFilters")}
                      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-line bg-card text-fg md:hidden"
                    >
                      <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden />
                      {(category || sort.key !== "smart") && <span aria-hidden className="absolute right-2 top-2 h-2 w-2 rounded-full bg-ember" />}
                    </button>
                    <div className={cn("w-full gap-tight md:contents", filtersOpen ? "flex" : "hidden")}>
                    {/* Two taxonomies under one select: the operator's own
                        categories for bookings, the six event categories for
                        events — grouped, so neither pretends to be the other. */}
                    <select
                      aria-label={t("allCategories")}
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        setPage(1);
                      }}
                      className={selectCls}
                    >
                      <option value="">{t("allCategories")}</option>
                      {kind !== "events" && productCats.length > 0 && (
                        <optgroup label={t("kind.bookings")}>
                          {productCats.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {kind !== "bookings" && (
                        <optgroup label={t("kind.events")}>
                          {CATEGORIES.map((c) => (
                            <option key={c.id} value={`ev:${c.id}`}>{te(`category.${c.key}`)}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <select
                      aria-label={t("sortBy")}
                      value={sort.key}
                      onChange={(e) => setSort({ key: e.target.value, order: "asc" })}
                      className={selectCls}
                    >
                      <option value="smart">{t("sort.smart")}</option>
                      <option value="name">{t("sort.name")}</option>
                      <option value="price">{t("sort.price")}</option>
                      <option value="updated">{t("sort.updated")}</option>
                    </select>
                    </div>
                  </div>
                  {/* State as counted chips — the facet under the views. "All"
                      is a chip too, pressed by default, so there is always one
                      that visibly reads as the current choice. */}
                  <div role="group" aria-label={t("stateFilter")} className="flex flex-wrap items-center gap-tight">
                    <button type="button" aria-pressed={states.length === 0} onClick={() => { setStates([]); setPage(1); }} className={chip(states.length === 0)}>
                      {t("allStates")}
                    </button>
                    {facetChips.map((s) => {
                      const on = states.includes(s);
                      return (
                        <button key={s} type="button" aria-pressed={on} onClick={() => toggleFacet(s)} className={cn(chip(on), s === "archived" && !on && !filtersOpen && "max-md:hidden")}>
                          {s === "attention" && <AlertTriangle size={13} strokeWidth={2} aria-hidden className={on ? "" : "text-warning"} />}
                          {t(s === "attention" ? "facet.attention" : `state.${s}`)}
                          {s !== "archived" && <span className={cn("text-[12px] tabular-nums", on ? "text-inverse-fg/80" : "text-muted")}>{facetCounts[s]}</span>}
                        </button>
                      );
                    })}
                    {filtered && (
                      <button
                        type="button"
                        onClick={clearAll}
                        className="h-11 rounded-sm px-tight text-[13px] font-medium text-brand-foreground hover:bg-muted-wash md:h-8"
                      >
                        {t("clearFilters")}
                      </button>
                    )}
                  </div>
                </div>
            }
            emptyState={
              <EmptyState
                title={t("emptyTitle")}
                message={filtered ? t("emptyFiltered") : t(`emptyKind.${kind}`)}
                action={
                  filtered ? (
                    <Button variant="secondary" onClick={clearAll}>{t("clearFilters")}</Button>
                  ) : (
                    <Link href={kind === "all" ? "/catalog/new" : `/catalog/new?kind=${kind}`}>
                      <Button icon={<Plus size={16} strokeWidth={1.5} />}>{t("add")}</Button>
                    </Link>
                  )
                }
              />
            }
            pagination={{ page, pageSize: PAGE_SIZE, total: rows.length, onPageChange: setPage }}
          />
        </div>
      )}

      {/* The bulk bar floats at the bottom of the screen while anything is
          selected: with fifty rows a page, a bar at the top of the table is
          off-screen by the time the eighth row is ticked. Above the phone's
          tab bar there; bottom-centre from md. */}
      {selected.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom)+0.75rem)] z-40 flex justify-center px-gutter md:bottom-section">
                <div role="region" aria-label={t("bulk.region")} className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center gap-tight rounded-md border border-line bg-card px-comfortable py-tight shadow-lg">
                  <span className="text-[13px] font-medium">{t("selectedCount", { count: selected.size })}</span>
                  {/* The whole filtered list, not only this page — "everything
                      that is off sale" is the set people mean. */}
                  {allOnPage && rows.length > selected.size && (
                    <button
                      type="button"
                      onClick={() => setSelected(new Set(rows.map((r) => r.key)))}
                      className="min-h-11 rounded-sm px-tight text-[13px] font-medium text-brand-foreground hover:underline md:min-h-8"
                    >
                      {t("selectAllMatching", { count: rows.length })}
                    </button>
                  )}
                  <span className="flex-1" />
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy || canPutOn.length === 0}
                    icon={<Power size={15} strokeWidth={1.5} />}
                    onClick={() => setOnSale(canPutOn, true)}
                  >
                    {canPutOn.length > 0 && canPutOn.length < selected.size ? t("bulk.putOn", { count: canPutOn.length }) : t("action.onSale")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy || canTakeOff.length === 0}
                    icon={<PowerOff size={15} strokeWidth={1.5} />}
                    onClick={() => setOnSale(canTakeOff, false)}
                  >
                    {canTakeOff.length > 0 && canTakeOff.length < selected.size ? t("bulk.takeOff", { count: canTakeOff.length }) : t("action.offSale")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy || selectedItems.every((i) => i.state === "archived")}
                    icon={<Archive size={15} strokeWidth={1.5} />}
                    onClick={() => setConfirm({ kind: "archive", items: selectedItems.filter((i) => i.state !== "archived") })}
                  >
                    {t("action.archive")}
                  </Button>
                  <Button variant="tertiary" size="sm" onClick={() => { setSelected(new Set()); setSelecting(false); }}>
                    {t("clearSelection")}
                  </Button>
                  {/* An unavailable action says why, in words, where the
                      buttons are — not only as a greyed-out shape. */}
                  {(canPutOn.length === 0 || canTakeOff.length === 0) && (
                    <p className="basis-full text-[12px] text-muted">
                      {canPutOn.length === 0 && canTakeOff.length === 0
                        ? t("bulk.noneToChange")
                        : canPutOn.length === 0
                          ? t("bulk.noneToPutOn")
                          : t("bulk.noneToTakeOff")}
                    </p>
                  )}
                </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && (confirm.kind === "delete" ? doDelete(confirm.items[0]) : doArchive(confirm.items))}
        loading={busy}
        title={
          confirm
            ? confirm.kind === "delete"
              ? te("confirm.deleteTitle", { title: confirm.items[0].name })
              : confirm.items.length === 1
                ? t("confirm.archiveOne", { name: confirm.items[0].name })
                : t("confirm.archiveMany", { count: confirm.items.length })
            : ""
        }
        message={archiveMessage}
        confirmLabel={confirm ? (confirm.kind === "delete" ? te("action.delete") : t("action.archive")) : ""}
      />
    </PageShell>
  );
}

/** The page's select-all box, which can also say "some of these". A native
 *  checkbox shows the partial state only through its `indeterminate`
 *  property, which has no attribute, so it is set here. */
function PageCheckbox({ checked, mixed, onChange, label, className }: { checked: boolean; mixed: boolean; onChange: () => void; label: string; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} aria-label={label} aria-checked={mixed ? "mixed" : checked} className={className} />;
}
