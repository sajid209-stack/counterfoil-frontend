"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { useToast } from "@/components/ui";
import { updateProduct, type Location, type Product, type Resource, type Staff } from "@/lib/api";
import { useBehaviourSubtitle } from "@/lib/behaviour";
import { bookingKindOf, productItem } from "@/lib/catalog";
import { DEMO_TODAY, demoNow } from "@/lib/schedule";
import {
  buildInput,
  createResourceFor,
  DetailsTab,
  fromProduct,
  hasWhen,
  PricesTab,
  RulesTab,
  summaryKeyOf,
  SupportRows,
  useProductDraft,
  WhenTab,
  type ProductCtx,
} from "../booking/ProductForm";
import { BookingOverview } from "./BookingOverview";
import { PageTab, WhereTab, whereProblem } from "./parts";
import { RecordFrame, useRecordTab, type RecordTab, type TabId } from "./RecordFrame";
import { useRecordActions } from "./actions";

export interface RecordEnv {
  locations: Location[];
  team: Staff[];
  resources: Resource[];
  /** The other bookings (not this one), for a combo to pick its parts from. */
  products: Product[];
  currency: string;
}

/**
 * A booking's record page: Overview first, then the same answers as the wizard,
 * each in its own tab, all saved together by the one save bar.
 */
export function BookingRecord({ product, env, onChanged }: { product: Product; env: RecordEnv; onChanged: (next: Product) => void }) {
  const t = useTranslations("catalog");
  const ti = useTranslations("catalog.item");
  const ts = useTranslations("catalog.setup");
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

  const bt = state.booking.bookingType;
  const available: TabId[] = ["overview", "details", ...(hasWhen(bt) ? (["when"] as TabId[]) : []), "prices", "where", "page", "rules", "support"];
  const [tab, setTab] = useRecordTab(available);

  const problem = whereProblem({ counter: state.counter, online: state.onlineMode, locationIds: state.locationIds, slug: state.slug }, product.id);
  const invalid = problem !== null;

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
    onCreateResource: async (name, noun) => {
      const r = await createResourceFor(name, noun);
      if (r) setResources((rs) => [...rs, r]);
      return r;
    },
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    const res = await updateProduct(product.id, buildInput(state, product, initial));
    setSaving(false);
    if (res.ok) {
      toast.success(ti("saved", { name: res.data.name }));
      setState(fromProduct(res.data, summaryOf));
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

  const tabs: RecordTab[] = [
    {
      id: "overview",
      label: ti("tab.overview"),
      node: (
        <BookingOverview
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
    ...(hasWhen(bt) ? [{ id: "when" as const, label: ti("tab.when"), node: card(<WhenTab ctx={ctx} />) }] : []),
    { id: "prices", label: ti("tab.prices"), node: card(<PricesTab ctx={ctx} />) },
    {
      id: "where",
      label: ti("tab.where"),
      node: (
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
    <RecordFrame
      title={product.name}
      description={subtitle(product, { resources, team: env.team })}
      state={item.state}
      kindLabel={t(`type.${bookingKindOf(product.bookingType)}`)}
      primary={actions.primary}
      secondary={actions.secondary}
      menu={actions.menu}
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
  );
}
