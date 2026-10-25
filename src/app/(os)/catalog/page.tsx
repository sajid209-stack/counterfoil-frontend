"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Archive,
  CalendarOff,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Globe,
  LayoutGrid,
  Link2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RotateCcw,
  Store,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  ActionMenu,
  Button,
  Card,
  Checkbox,
  Chip,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ProductThumb,
  FilterBar,
  FilterSearch,
  Select,
  StatusPill,
  useToast,
  type ActionMenuItem,
  type Column,
  type PillTone,
} from "@/components/ui";
import { PageAction, PagePrimaryButton, PageShell, type PagePrimary } from "@/components/ui/PageShell";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { MD, useMediaQuery } from "@/lib/useMedia";
import {
  archiveEvent,
  archiveProduct,
  createProduct,
  deleteEvent,
  duplicateEvent,
  listProducts,
  listResources,
  listStaff,
  restoreEvent,
  setEventPublished,
  updateProduct,
  type Product,
} from "@/lib/api";
import { useBehaviourSubtitle } from "@/lib/behaviour";
import { formatDay } from "@/lib/format";
import { DEMO_TODAY, demoNow } from "@/lib/schedule";
import { slugOf } from "@/lib/api/products";
import type { Blocker, SellingWarning } from "@/lib/sellable";
import {
  eventFill,
  needsAttention,
  productCopy,
  productItem,
  type CatalogItem,
  type CatalogState,
} from "@/lib/catalog";
import { copyText, itemUrl, useOrigin } from "./_components/record/parts";

/* A catalog is scanned, not paged through: fifty rows is a whole venue's
   catalog on one screen of scrolling, and paging at twelve split a list of
   twenty-six across three. */
const PAGE_SIZE = 50;

/** Where it's sold, as the filter names it. "none" is Not online. */
type WhereFilter = "storefront" | "link" | "counter" | "none";
const WHERE_FILTERS: WhereFilter[] = ["storefront", "link", "counter", "none"];
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

export default function CatalogPage() {
  return <Catalog />;
}

/**
 * The catalog: everything the operator sells, in one list.
 *
 * There is one thing in the Catalog: a booking (docs/catalog.md §10.1). It is
 * read in one vocabulary (`lib/catalog`) — a status that means the same for a
 * lane and for a concert, a When in words, a Price from — and nothing in it
 * shows, filters or groups by type. Columns: select · Name · When · Price from ·
 * Where it's sold · Status · row menu (§10.2). Sales live on each booking's
 * Overview, not here.
 *
 * Filters are status and where it's sold, behind the one Filters button;
 * "what needs me?" is a status facet, so it is a glance rather than a search.
 */
function Catalog() {
  const t = useTranslations("catalog");
  const subtitle = useBehaviourSubtitle();
  const tp = useTranslations("products");
  const te = useTranslations("events");
  const router = useRouter();
  const toast = useToast();
  const compact = !useMediaQuery(MD, true);
  const now = useMemo(() => demoNow(), []);

  const origin = useOrigin();

  const [search, setSearch] = useState("");
  const [states, setStates] = useState<Facet[]>([]);
  const [wheres, setWheres] = useState<WhereFilter[]>([]);
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "smart", order: "asc" });
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  /* On a phone the checkboxes are a mode, not a column on every card. */
  const [selecting, setSelecting] = useState(false);
  const wantArchived = states.includes("archived");

  const productsQ = useApiQuery(
    () => listProducts({ pageSize: 500, filters: { includeArchived: wantArchived } }),
    [reloadKey, wantArchived],
  );
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100 }), []);
  const teamQ = useApiQuery(() => listStaff({ pageSize: 100 }), []);

  const resources = useMemo(() => resourcesQ.data?.data ?? [], [resourcesQ.data]);
  const team = useMemo(() => teamQ.data?.data ?? [], [teamQ.data]);

  /* One list, one record: an event is a BT-15 product, so it arrives with the
     rest and `productItem` reads it as an event row. Fetching events apart and
     adding them here would list every event twice. */
  const items = useMemo<CatalogItem[]>(
    () => (productsQ.data?.data ?? []).map((p) => productItem(p, resources, DEMO_TODAY, now)),
    [productsQ.data, resources, now],
  );

  const loading = productsQ.loading && !productsQ.data;

  // ── filtering ─────────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const matchesSearch = (i: CatalogItem) =>
    !q ||
    i.name.toLowerCase().includes(q) ||
    (i.event?.venueName ?? "").toLowerCase().includes(q) ||
    (i.product?.description ?? "").toLowerCase().includes(q);
  const inFacet = (i: CatalogItem, f: Facet) => (f === "attention" ? needsAttention(i) : i.state === f);
  /** Archived is out of every view until asked for by name — the rule both
   *  lists already followed, and what makes Archive safe rather than a
   *  disappearance. */
  const visibleByState = (i: CatalogItem) => (states.length ? states.some((f) => inFacet(i, f)) : i.state !== "archived");
  /** Where it's sold: any of the chosen answers. Not online means neither the
   *  storefront nor its link — an item sold only at the counter, or nowhere. */
  const inWhere = (i: CatalogItem, w: WhereFilter) =>
    w === "storefront" ? i.where.storefront : w === "link" ? i.where.link : w === "counter" ? i.where.counter : !i.where.storefront && !i.where.link;
  const wheresOk = (i: CatalogItem) => wheres.length === 0 || wheres.some((w) => inWhere(i, w));

  const base = items.filter(matchesSearch).filter(wheresOk);
  const facetCounts = Object.fromEntries(FACETS.map((f) => [f, base.filter((i) => inFacet(i, f)).length])) as Record<Facet, number>;
  const sorted = useMemo(() => {
    const list = base.filter(visibleByState);
    const dir = sort.order === "asc" ? 1 : -1;
    const rank: Record<CatalogState, number> = { needsSetup: 0, onSale: 1, soldOut: 2, offSale: 3, ended: 4, archived: 5 };
    /* What needs somebody leads, whatever its state — a course on sale whose
       dates run out next week is the row a manager should see first. */
    const rankOf = (i: CatalogItem) => (needsAttention(i) ? -1 : rank[i.state]);
    return [...list].sort((a, b) => {
      if (sort.key === "name") return dir * a.name.localeCompare(b.name);
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
  }, [items, q, states, wheres, sort]);
  /* Rows hold their places through an action. The default order ranks by
     state, so taking a row off sale would otherwise move it — often to a later
     page — at the moment someone looks for it to check the change, or to press
     Undo. Changing a filter or the sort is asking for a new order, so the held
     one lapses as soon as any of them moves. */
  const sig = `${q}|${states.join()}|${wheres.join()}|${sort.key}|${sort.order}`;
  const [held, setHeld] = useState<{ sig: string; keys: string[] } | null>(null);
  const rows = useMemo(() => {
    if (!held || held.sig !== sig) return sorted;
    const at = new Map(held.keys.map((k, n) => [k, n]));
    const place = (k: string) => at.get(k) ?? Number.MAX_SAFE_INTEGER;
    return [...sorted].sort((a, b) => place(a.key) - place(b.key));
  }, [sorted, held, sig]);
  const holdOrder = () => setHeld({ sig, keys: rows.map((r) => r.key) });
  /* A page past the end (a filter just shortened the list) shows the last one. */
  const curPage = Math.min(page, Math.max(1, Math.ceil(rows.length / PAGE_SIZE)));
  const pageRows = rows.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

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
  const isOn = (i: CatalogItem) => (i.product ? i.product.status === "active" : i.event?.status === "active");
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
        router.push(`/catalog/${res.data.id}`);
      }
      return;
    }
    const res = await duplicateEvent(i.id, te("copyTitle", { title: i.name }));
    setBusy(false);
    if (!res.ok) return toast.error(res.error.message);
    toast.success(t("toast.duplicated", { name: res.data.title }));
    router.push(`/catalog/${res.data.id}`);
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
    const online = i.where.storefront || i.where.link;
    const slug = i.slug ?? (i.product ? slugOf(i.product) : "");
    return [
      { key: "edit", label: t("action.edit"), icon: <Pencil size={14} strokeWidth={1.5} />, onSelect: () => router.push(`${i.href}?tab=details`) },
      online
        ? { key: "copy", label: t("action.copyLink"), icon: <Link2 size={14} strokeWidth={1.5} />, onSelect: async () => ((await copyText(itemUrl(origin, slug))) ? toast.success(t("toast.linkCopied")) : toast.error(t("toast.linkCopyFailed"))) }
        : null,
      online
        ? { key: "view", label: t("action.viewPage"), icon: <Globe size={14} strokeWidth={1.5} />, onSelect: () => window.open(`/b/${slug}`, "_blank", "noopener,noreferrer") }
        : null,
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
    tp(
      b === "noPrice" ? "blockerNoPrice"
        : b === "noSchedule" ? "blockerNoSchedule"
        : b === "noResource" ? "blockerNoResource"
        : b === "noDate" ? "blockerNoDate"
        : b === "noVenue" ? "blockerNoVenue"
        : b === "noTicket" ? "blockerNoTicket"
        : "blockerNoChannel",
    );
  const warningLabel = (w: SellingWarning) => t(`warning.${w.kind}`, { date: formatDay(w.date) });

  /** One thumbnail for everything: its first photo (an event's cover, when it has
   *  no photo), else the glyph for how it is booked. */
  const Thumb = ({ i }: { i: CatalogItem }) => {
    const cover = i.event?.customisation.coverUrl;
    const images = i.product?.images ?? (cover ? [{ id: "cover", url: cover, alt: i.name }] : []);
    return <ProductThumb images={images} name={i.name} bookingType={i.product?.bookingType ?? "BT-15"} size="chip" />;
  };

  const Sub = ({ i }: { i: CatalogItem }) => {
    if (i.blockers.length) {
      const text = i.blockers.map(blockerLabel).join(" · ");
      return (
        <span className="flex min-w-0 items-center gap-inline text-xs text-warning" title={text}>
          <AlertTriangle size={12} strokeWidth={2} className="shrink-0" aria-hidden />
          <span className="truncate">{text}</span>
        </span>
      );
    }
    if (i.warnings.length) {
      const text = i.warnings.map(warningLabel).join(" · ");
      const Icon = i.warnings[0].kind === "datesRunOut" ? CalendarOff : Clock;
      return (
        <span className="flex min-w-0 items-center gap-inline text-xs text-warning" title={text}>
          <Icon size={12} strokeWidth={2} className="shrink-0" aria-hidden />
          <span className="truncate">{text}</span>
        </span>
      );
    }
    const own = i.product ? subtitle(i.product, { resources, team }) : i.event!.venueName;
    return <span className="block truncate text-xs text-muted">{own}</span>;
  };

  const StatePill = ({ i }: { i: CatalogItem }) => (
    <StatusPill tone={STATE_TONE[i.state]} shape={i.state === "offSale" || i.state === "archived" ? "record" : "transaction"} className="whitespace-nowrap">
      {t(`state.${i.state}`)}
    </StatusPill>
  );

  /** The three marks of "where it's sold", in a fixed order so the column lines
   *  up: storefront, link, counter. An absent one is empty space of the same
   *  size; each present one carries its word as tooltip and accessible name. */
  const Marks = ({ w, size = 16 }: { w: CatalogItem["where"]; size?: number }) => {
    const marks: { on: boolean; key: string; Icon: LucideIcon }[] = [
      { on: w.storefront, key: "storefront", Icon: Globe },
      { on: w.link, key: "link", Icon: Link2 },
      { on: w.counter, key: "counter", Icon: Store },
    ];
    const none = !w.storefront && !w.link && !w.counter;
    return (
      <span className="inline-flex items-center gap-tight">
        {marks.map(({ on, key, Icon }) =>
          on ? (
            <span key={key} role="img" title={t(`where.${key}`)} aria-label={t(`where.${key}`)} className="inline-flex shrink-0 items-center justify-center text-fg-secondary" style={{ width: size, height: size }}>
              <Icon size={size} strokeWidth={1.5} aria-hidden />
            </span>
          ) : (
            <span key={key} aria-hidden className="inline-block shrink-0" style={{ width: size, height: size }} />
          ),
        )}
        {none && <span className="sr-only">{t("where.nowhere")}</span>}
      </span>
    );
  };

  /** The phone's version of the marks: words, not two tiny glyphs. The usual
   *  case (storefront and counter) is silent; only an exception gets a line. */
  const WhereWords = ({ w }: { w: CatalogItem["where"] }) => {
    if (w.storefront && w.counter && !w.link) return null;
    const words = [w.storefront && t("where.storefront"), w.link && t("where.link"), w.counter && t("where.counter")].filter(Boolean);
    return <span className="truncate text-xs text-muted">{words.length ? words.join(" · ") : t("where.nowhere")}</span>;
  };

  const somePicked = pageRows.some((r) => selected.has(r.key)) && !allOnPage;
  const allColumns: Column<CatalogItem>[] = [
    {
      key: "select",
      /* The kit's checkbox is a 36px target on a desktop with its 20px mark
         inset; the negative margin puts the mark on the card's own inset, so it
         lines up with the heading above. */
      header: (
        <span className="-ml-tight flex">
          <Checkbox checked={allOnPage} indeterminate={somePicked} onCheckedChange={togglePage} aria-label={t("selectPage")} />
        </span>
      ),
      width: "3.5rem",
      render: (i) => (
        <span onClick={(e) => e.stopPropagation()} className="-ml-tight flex">
          <Checkbox checked={selected.has(i.key)} onCheckedChange={() => toggleOne(i.key)} aria-label={t("selectOne", { name: i.name })} />
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
    { key: "where", header: t("col.where"), width: "8rem", render: (i) => <Marks w={i.where} /> },
    { key: "state", header: t("col.state"), width: "9rem", render: (i) => <StatePill i={i} /> },
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

  const columns = allColumns;

  const filtered = !!q || states.length > 0 || wheres.length > 0;
  const empty = !loading && items.filter((i) => i.state !== "archived").length === 0 && !wantArchived;
  const clearAll = () => {
    setSearch("");
    setStates([]);
    setWheres([]);
    setPage(1);
  };

  /* Chips that apply to this view, and among those only the ones with
     something in them — a chip that would show an empty list is a question
     the page already knows the answer to. An active chip always stays, so it
     can be switched off; Archived always stays, because its count is not
     known until it is asked for. */
  const facetChips = FACETS.filter((f) => f === "archived" || states.includes(f) || facetCounts[f] > 0);
  const primary: PagePrimary = { label: t("add"), href: "/catalog/new" };

  return (
    <PageShell title={t("title")} description={t("description")} primary={primary}>
      {/* First run: nothing to list yet, so the page IS the way to add the
          first thing. An empty table with a lonely button teaches nothing; the
          chooser says what a catalog holds while it asks what to add. */}
      {empty ? (
        <Card as="section">
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold tracking-title">{t("firstRun.title")}</h2>
            <p className="mt-tight text-base text-muted">{t("firstRun.body")}</p>
            <ol className="mt-section grid gap-tight sm:grid-cols-3">
              {(["pick", "shape", "sell"] as const).map((k, n) => (
                <li key={k} className="flex items-start gap-tight rounded-inner bg-muted-wash px-comfortable py-tight text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-card text-xs font-semibold">{n + 1}</span>
                  <span>{t(`firstRun.step.${k}`)}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-major">
            <Link href="/catalog/new">
              <Button icon={<Plus size={16} strokeWidth={1.5} />}>{t("add")}</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className={cn("flex flex-col gap-section", selected.size > 0 && "pb-24")}>
          <DataTable
            columns={columns}
            rows={pageRows}
            getRowId={(i) => i.key}
            loading={loading}
            layout="fixed"
            height="page"
            minWidth="40rem"
            isSelected={(i) => selected.has(i.key)}
            sort={sort.key === "smart" ? undefined : sort}
            onSortChange={(key) => {
              setPage(1);
              setSort((s) => ({ key, order: s.key === key && s.order === "asc" ? "desc" : "asc" }));
            }}
            onRowClick={(i) => router.push(i.href)}
            cardVariant="list"
            renderCard={(i) => (
              /* Two lines, the way a phone reads a long index: who it is, then
                 what it is and where it is sold. A warning replaces the meta
                 line, because that is the one thing on the row somebody has to
                 act on. The status chip marks the exception only (docs/mobile.md
                 O3): a published row carries none, and the others say why they
                 are not selling. The name wraps to two lines before it clips. */
              <span className="flex items-center gap-comfortable">
                {selecting && (
                  <span onClick={(e) => e.stopPropagation()} className="-my-inline -ml-tight flex shrink-0">
                    <Checkbox checked={selected.has(i.key)} onCheckedChange={() => toggleOne(i.key)} aria-label={t("selectOne", { name: i.name })} />
                  </span>
                )}
                <Thumb i={i} />
                <span className="flex min-w-0 flex-1 flex-col gap-inline">
                  <span className="flex items-start gap-tight">
                    <span className="line-clamp-2 min-w-0 flex-1 break-words text-base font-medium leading-snug" title={i.name}>{i.name}</span>
                    {i.state !== "onSale" && <StatePill i={i} />}
                  </span>
                  <span className="flex min-w-0 items-center gap-tight text-sm text-muted">
                    <span className="min-w-0 flex-1"><Sub i={i} /></span>
                  </span>
                  <WhereWords w={i.where} />
                </span>
                <span className="-mr-tight shrink-0" onClick={(e) => e.stopPropagation()}>
                  <ActionMenu items={actionsFor(i)} label={t("rowActions", { name: i.name })} />
                </span>
              </span>
            )}
            toolbar={
              /* The shared list-filter row: search, one Filters button that
                 counts what is set, and chips for anything that is. The state
                 facets and the sort live in the panel; nothing else is drawn
                 until it is chosen. */
              <FilterBar
                search={
                  <FilterSearch
                    value={search}
                    onChange={(v) => {
                      setSearch(v);
                      setPage(1);
                    }}
                    placeholder={t("searchPlaceholder")}
                    aria-label={t("searchPlaceholder")}
                    className="flex-1 md:flex-none"
                  />
                }
                actions={
                  <>
                    {/* Ticking rows is a mode on a phone, where a checkbox on every
                        row would take the room the name needs. */}
                    <Button variant="secondary" size="sm" selected={selecting} onClick={() => setSelecting((v) => !v)} className="shrink-0 md:hidden">
                      {selecting ? t("selectDone") : t("select")}
                    </Button>
                    {!compact && <PageAction label={tp("seatLayouts")} icon={<LayoutGrid size={16} strokeWidth={1.5} />} onClick={() => router.push("/catalog/layouts")} />}
                    <PagePrimaryButton primary={primary} />
                  </>
                }
                filters={[
                  {
                    key: "state",
                    label: t("col.state"),
                    active: states.length ? states.map((s) => t(s === "attention" ? "facet.attention" : `state.${s}`)).join(", ") : null,
                    onClear: () => {
                      setStates([]);
                      setPage(1);
                    },
                    control: (
                      <div role="group" aria-label={t("stateFilter")} className="flex flex-wrap items-center gap-tight">
                        {/* The state chips inside the Filters panel: the kit's toggle chip. */}
                        {facetChips.map((s) => (
                          <Chip
                            key={s}
                            selected={states.includes(s)}
                            onClick={() => toggleFacet(s)}
                            icon={s === "attention" ? <AlertTriangle size={13} strokeWidth={2} aria-hidden className="text-warning" /> : undefined}
                            count={s !== "archived" ? facetCounts[s] : undefined}
                          >
                            {t(s === "attention" ? "facet.attention" : `state.${s}`)}
                          </Chip>
                        ))}
                      </div>
                    ),
                  },
                  {
                    key: "where",
                    label: t("where.title"),
                    active: wheres.length ? wheres.map((w) => t(`where.${w}`)).join(", ") : null,
                    onClear: () => {
                      setWheres([]);
                      setPage(1);
                    },
                    control: (
                      <div role="group" aria-label={t("where.title")} className="flex flex-wrap items-center gap-tight">
                        {WHERE_FILTERS.map((w) => (
                          <Chip
                            key={w}
                            selected={wheres.includes(w)}
                            onClick={() => {
                              setPage(1);
                              setWheres((cur) => (cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w]));
                            }}
                          >
                            {t(`where.${w}`)}
                          </Chip>
                        ))}
                      </div>
                    ),
                  },
                  {
                    key: "sort",
                    label: t("sortBy"),
                    active: sort.key === "smart" ? null : t(`sort.${sort.key}`),
                    onClear: () => setSort({ key: "smart", order: "asc" }),
                    control: (
                      <Select
                        aria-label={t("sortBy")}
                        value={sort.key}
                        onChange={(v) => setSort({ key: v, order: "asc" })}
                        triggerClassName="text-base md:h-9"
                        options={[
                          { value: "smart", label: t("sort.smart") },
                          { value: "name", label: t("sort.name") },
                          { value: "updated", label: t("sort.updated") },
                        ]}
                      />
                    ),
                  },
                ]}
              />
            }
            emptyState={
              <EmptyState
                title={t("emptyTitle")}
                message={filtered ? t("emptyFiltered") : t("emptyKind.all")}
                action={
                  filtered ? (
                    <Button variant="secondary" onClick={clearAll}>{t("clearFilters")}</Button>
                  ) : (
                    <Link href="/catalog/new">
                      <Button icon={<Plus size={16} strokeWidth={1.5} />}>{t("add")}</Button>
                    </Link>
                  )
                }
              />
            }
            pagination={{ page: curPage, pageSize: PAGE_SIZE, total: rows.length, onPageChange: setPage }}
          />
        </div>
      )}

      {/* The bulk bar floats at the bottom of the screen while anything is
          selected: with fifty rows a page, a bar at the top of the table is
          off-screen by the time the eighth row is ticked. Above the phone's
          tab bar there; bottom-centre from md. */}
      {selected.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom)+0.75rem)] z-40 flex justify-center px-gutter md:bottom-section">
                <Card role="region" aria-label={t("bulk.region")} padding="none" className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center gap-tight px-comfortable py-tight shadow-float">
                  <span className="text-sm font-medium">{t("selectedCount", { count: selected.size })}</span>
                  {/* The whole filtered list, not only this page — "everything
                      that is off sale" is the set people mean. */}
                  {allOnPage && rows.length > selected.size && (
                    <Button variant="tertiary" size="sm" onClick={() => setSelected(new Set(rows.map((r) => r.key)))}>
                      {t("selectAllMatching", { count: rows.length })}
                    </Button>
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
                    <p className="basis-full text-xs text-muted">
                      {canPutOn.length === 0 && canTakeOff.length === 0
                        ? t("bulk.noneToChange")
                        : canPutOn.length === 0
                          ? t("bulk.noneToPutOn")
                          : t("bulk.noneToTakeOff")}
                    </p>
                  )}
                </Card>
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

