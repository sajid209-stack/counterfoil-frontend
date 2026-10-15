"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Card, useToast } from "@/components/ui";
import {
  eventSettlement,
  eventView,
  isEventProduct,
  updateProduct,
  type Location,
  type Product,
  type Resource,
  type Staff,
} from "@/lib/api";
import { useBehaviourSubtitle } from "@/lib/behaviour";
import { productItem } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { templateFontVars } from "@/lib/events/fonts";
import { DEMO_TODAY, demoNow } from "@/lib/schedule";
import {
  buildInput,
  createResourceFor,
  DetailsTab,
  fromProduct,
  PricesTab,
  RulesTab,
  summaryKeyOf,
  SupportRows,
  useProductDraft,
  WhenTab,
  type ProductCtx,
} from "../booking/ProductForm";
import { endsAtOf } from "../event/eventContent";
import { Overview } from "./Overview";
import { ticketSales } from "./overviewData";
import { PageTab, WhereTab, whereProblem } from "./parts";
import { RecordFrame, useRecordTab, type RecordTab, type TabId } from "./RecordFrame";
import { downloadCsv, settlementCsv } from "./settlement";
import { useRecordActions } from "./actions";

export interface RecordEnv {
  locations: Location[];
  team: Staff[];
  resources: Resource[];
  /** The other bookings (not this one), for a combo to pick its parts from. */
  products: Product[];
  currency: string;
}

const TABS: TabId[] = ["overview", "details", "when", "prices", "where", "page", "rules", "support"];

/**
 * THE record page: one design for every booking (docs/catalog.md §10.4).
 *
 * The header (a way back, the state, one primary action), the eight tabs in one
 * order, the Overview and the save bar are the same whether the booking is a
 * ticket, a lane by the hour or a concert. What differs is only what a tab
 * edits — a repeating booking's schedule against an on-a-date booking's days —
 * and that is decided inside the tab. Everything is saved together by the one
 * save bar.
 */
export function BookingRecord({ product, env, onChanged }: { product: Product; env: RecordEnv; onChanged: (next: Product) => void }) {
  const t = useTranslations("catalog");
  const ti = useTranslations("catalog.item");
  const ts = useTranslations("catalog.setup");
  const tw = useTranslations("catalog.wizard");
  const tev = useTranslations("catalog.editEvent");
  const tevw = useTranslations("catalog.eventWizard");
  const te = useTranslations("events");
  const tr = useTranslations("catalog.eventRecord");
  const toast = useToast();
  const subtitle = useBehaviourSubtitle();
  const summaryOf = (code: Product["bookingType"]) => ts(`summary.${summaryKeyOf(code)}`);
  const { state, setState, set, initial, dirty } = useProductDraft(product, summaryOf);
  const [resources, setResources] = useState<Resource[]>(env.resources);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const now = useMemo(() => demoNow(), []);
  const item = useMemo(() => productItem(product, resources, DEMO_TODAY, now), [product, resources, now]);
  const actions = useRecordActions({ product, item, onChanged });
  const [tab, setTab] = useRecordTab(TABS);

  const isEvent = isEventProduct(product);
  const problem = whereProblem({ counter: state.counter, online: state.onlineMode, locationIds: state.locationIds, slug: state.slug }, product.id);
  const invalid = problem !== null;

  /* What each saved ticket has sold (before Counterfoil and since), which a
     save must not go below. */
  const sold = useMemo(() => Object.fromEntries(ticketSales(product).map((r) => [r.id, r.sold])), [product]);

  const ctx: ProductCtx = {
    product,
    state,
    set,
    setState,
    errors,
    team: env.team,
    locations: env.locations,
    resources,
    products: env.products,
    currency: env.currency,
    sold,
    onCreateResource: async (name, noun) => {
      const r = await createResourceFor(name, noun);
      if (r) setResources((rs) => [...rs, r]);
      return r;
    },
  };

  /** Check what a save needs, say what is wrong where it is, and go to it. */
  const validate = () => {
    const e: Record<string, string> = {};
    if (!state.name.trim()) e.name = tw("missing.name");
    if (isEvent) {
      if (!state.ev.date) e.date = tevw("missing.date");
      if (!state.ev.venueName.trim()) e.venueName = te("error.venue");
      const end = endsAtOf(state.ev);
      if (end && state.ev.date && Date.parse(end) <= Date.parse(`${state.ev.date}T${state.ev.startTime}:00+06:00`)) e.ends = tevw("missing.ends");
    }
    if (state.tiers.length === 0) e.tiers = tw("missing.tiers");
    state.tiers.forEach((x, i) => {
      if (!x.name.trim()) e[`tiers.${i}.name`] = tw("missing.tierName");
      if (x.price.trim() === "") e[`tiers.${i}.price`] = tw("missing.tierPrice");
    });
    /* A ticket that has sold keeps its sales: it cannot be removed, and its
       number cannot go below what has gone. */
    const kept = new Set(state.tiers.map((x) => x.id));
    const removed = product.tiers.find((x) => !kept.has(x.id) && (sold[x.id] ?? 0) > 0);
    if (removed) e.tiers = tev("removedSold", { name: removed.name, count: sold[removed.id] });
    state.tiers.forEach((x, i) => {
      const cap = parseInt(x.quantity, 10);
      const had = sold[x.id] ?? 0;
      if (Number.isFinite(cap) && cap > 0 && cap < had) {
        e[`tiers.${i}.quantity`] = tev("belowSold", { name: x.name.trim() || ti("ticketFallback"), count: had });
        e.tiers = e[`tiers.${i}.quantity`];
      }
    });
    if (problem === "nowhere") e.where = t("wizard.nowhere");
    setErrors(e);
    if (e.name) setTab("details");
    else if (e.date || e.venueName || e.ends) setTab("when");
    else if (e.tiers || Object.keys(e).some((k) => k.startsWith("tiers."))) setTab("prices");
    else if (e.where) setTab("where");
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    const res = await updateProduct(product.id, buildInput(state, product, initial));
    setSaving(false);
    if (res.ok) {
      toast.success(ti("saved", { name: res.data.name }));
      setState(fromProduct(res.data, summaryOf));
      setErrors({});
      onChanged(res.data);
    } else if (res.error.code === "validation" && res.error.fieldErrors) {
      setErrors(res.error.fieldErrors);
      toast.error(res.error.message);
      setTab(res.error.fieldErrors.name ? "details" : "prices");
    } else {
      toast.error(res.error.message);
    }
  };

  const discard = () => {
    setState(initial);
    setErrors({});
  };

  /* A preview of the item as it stands now, unsaved edits included. */
  const draftProduct = useMemo<Product>(() => {
    const built = buildInput(state, product, initial);
    return {
      ...product,
      ...built,
      page: state.page,
      tiers: (built.tiers ?? product.tiers).map((x, i) => ({ ...x, id: x.id ?? `draft_${i}` })),
    } as Product;
  }, [state, product, initial]);

  const card = (node: React.ReactNode) => <Card>{node}</Card>;
  const savedOnline = initial.onlineMode !== "off" && state.onlineMode === initial.onlineMode && state.slug === initial.slug;

  /* An on-a-date booking can be downloaded as a sales summary: capacity,
     unsold and face value by ticket and by day. It is a menu item, never a
     different layout. */
  const menu = useMemo(() => {
    if (!isEvent) return actions.menu;
    const view = eventView(product);
    const settlement = eventSettlement(view, (n) => tr("days.nth", { n }));
    const csv = {
      key: "csv",
      label: tr("settle.export"),
      icon: <Download size={14} strokeWidth={1.5} />,
      onSelect: () => downloadCsv(`sales-${view.slug}.csv`, settlementCsv(view, settlement, tr as never)),
    };
    /* Before the destructive item, which the shared menu always puts last. */
    return [...actions.menu.slice(0, actions.menu.length - 1), csv, ...actions.menu.slice(-1)];
  }, [isEvent, actions.menu, product, tr]);

  const tabs: RecordTab[] = [
    {
      id: "overview",
      label: ti("tab.overview"),
      node: (
        <Overview
          product={product}
          online={state.onlineMode}
          slug={state.slug}
          counter={state.counter}
          locations={env.locations}
          locationIds={state.locationIds}
          saved={savedOnline}
          onSellOnline={() => setTab("where")}
        />
      ),
    },
    { id: "details", label: ti("tab.details"), node: card(<DetailsTab ctx={ctx} />) },
    { id: "when", label: ti("tab.when"), node: card(<WhenTab ctx={ctx} />) },
    { id: "prices", label: ti("tab.prices"), node: card(<PricesTab ctx={ctx} />) },
    {
      id: "where",
      label: ti("tab.where"),
      node: (
        <>
          {errors.where && <p role="alert" className="rounded-control bg-danger-wash px-comfortable py-tight text-sm font-medium text-danger">{errors.where}</p>}
          <WhereTab
            productId={product.id}
            name={state.name}
            counter={state.counter}
            online={state.onlineMode}
            slug={state.slug}
            locations={env.locations}
            locationIds={state.locationIds}
            onCounter={(v) => set("counter", v)}
            onOnline={(v) => set("onlineMode", v)}
            onSlug={(v) => set("slug", v)}
            onToggleLocation={(id) => set("locationIds", state.locationIds.includes(id) ? state.locationIds.filter((x) => x !== id) : [...state.locationIds, id])}
          />
        </>
      ),
    },
    {
      id: "page",
      label: ti("tab.page"),
      node: (
        <PageTab
          draft={draftProduct}
          page={state.page}
          online={state.onlineMode}
          onPage={(p) => set("page", p)}
          onDescription={(d) => set("description", d)}
          onEditDetails={() => setTab("details")}
          onEditTickets={() => setTab("prices")}
          onGoWhere={() => setTab("where")}
        />
      ),
    },
    { id: "rules", label: ti("tab.rules"), node: card(<RulesTab ctx={ctx} />) },
    { id: "support", label: ti("tab.support"), node: card(<SupportRows code={product.bookingType} id={product.id} createdAt={product.createdAt} updatedAt={product.updatedAt} />) },
  ];

  return (
    <div className={cn(templateFontVars)}>
      <RecordFrame
        title={product.name}
        description={subtitle(product, { resources, team: env.team })}
        state={item.state}
        primary={actions.primary}
        secondary={actions.secondary}
        menu={menu}
        blockers={item.state === "needsSetup" ? item.blockers : []}
        tabs={tabs}
        tab={tab}
        onTab={setTab}
        dirty={dirty}
        saving={saving}
        invalid={invalid}
        onSave={save}
        onDiscard={discard}
      >
        {actions.dialogs}
      </RecordFrame>
    </div>
  );
}
