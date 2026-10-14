"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Card, useToast } from "@/components/ui";
import {
  eventSettlement,
  eventView,
  tierToPrice,
  updateEvent,
  updateProduct,
  getProduct,
  type Channel,
  type EventDay,
  type EventRecord as EventView,
  type EventTier,
  type PriceTier,
  type Product,
  type ProductPage,
  type ProductPolicies,
} from "@/lib/api";
import { productItem } from "@/lib/catalog";
import { categoryById } from "@/lib/events/catalog";
import { templateFontVars } from "@/lib/events/fonts";
import { formatClock, formatClockRange, formatDay } from "@/lib/format";
import { DEMO_TODAY, demoNow } from "@/lib/schedule";
import { spansDays, eventDays } from "@/lib/api";
import { defaultPolicies } from "@/lib/tax";
import { slugOf } from "@/lib/api/products";
import { cn } from "@/lib/cn";
import { pageOf } from "@/lib/productPage";
import { endsAtOf, type EventContent } from "../event/eventContent";
import { EventDetails } from "../event/EventDetails";
import { TicketTiers, toTiers, type FormTier } from "../event/TicketTiers";
import { AddOnsField, type FormAddOn } from "../booking/AddOnsField";
import { PoliciesField } from "../booking/PoliciesField";
import { SupportRows, channelsOf, onlineModeOf } from "../booking/ProductForm";
import type { OnlineChoice } from "../sell/SellChannels";
import { EventOverview, downloadCsv, settlementCsv } from "./EventOverview";
import { PageTab, WhereTab, whereProblem } from "./parts";
import { RecordFrame, useRecordTab, type RecordTab, type TabId } from "./RecordFrame";
import { useRecordActions } from "./actions";
import type { RecordEnv } from "./BookingRecord";

/**
 * Everything an event's record edits. The facts the page also shows (its
 * subtitle, cover, video, organiser, programme and questions) are NOT copied
 * here: they live on the page, and the Details tab reads and writes them
 * there, so the Details tab and the Page tab can never disagree about them.
 */
interface EventForm {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endDate: string;
  endTime: string;
  days: EventDay[];
  venueName: string;
  venueAddress: string;
  subtype: string;
  rows: FormTier[];
  extras: FormAddOn[];
  policies: ProductPolicies;
  counter: boolean;
  onlineMode: OnlineChoice;
  slug: string;
  locationIds: string[];
  page: ProductPage;
}

function fromEvent(p: Product, e: EventView): EventForm {
  const mode = onlineModeOf(p);
  const known = categoryById(e.categoryId).subtypes.includes(e.subtype);
  return {
    title: e.title,
    description: e.description ?? "",
    date: e.startsAt.slice(0, 10),
    startTime: e.startsAt.slice(11, 16),
    endDate: e.endsAt ? e.endsAt.slice(0, 10) : "",
    endTime: e.endsAt ? e.endsAt.slice(11, 16) : "",
    days: e.days ?? [],
    venueName: e.venueName,
    venueAddress: e.venueAddress ?? "",
    /* The kind is stored as the subtype's key when the wizard made the event;
       older records carry a label, which the select cannot hold, so it opens
       unset rather than guessing. */
    subtype: known ? e.subtype : "",
    rows: e.tiers.map((x) => ({
      id: x.id,
      name: x.name,
      price: String(x.price / 100),
      quantity: String(x.quantity),
      description: x.description ?? "",
      salesEnd: x.salesEnd ? x.salesEnd.slice(0, 10) : "",
      dayIds: x.dayIds ?? [],
    })),
    extras: (e.extras ?? []).map((a) => ({ id: a.id, name: a.name, price: String(a.price / 100), perPerson: a.perPerson, itemId: a.itemId })),
    policies: p.policies ?? defaultPolicies(),
    counter: p.channels.includes("counter"),
    onlineMode: mode,
    slug: p.slug ?? (mode !== "off" ? slugOf(p) : ""),
    locationIds: p.locationIds,
    page: pageOf(p),
  };
}

/** An event's record page. */
export function EventRecord({ product, env, onChanged }: { product: Product; env: RecordEnv; onChanged: (next: Product) => void }) {
  const t = useTranslations("catalog");
  const te = useTranslations("events");
  const ti = useTranslations("catalog.item");
  const tc = useTranslations("catalog.editEvent");
  const tw = useTranslations("catalog.eventWizard");
  const tcw = useTranslations("catalog.wizard");
  const tr = useTranslations("catalog.eventRecord");
  const toast = useToast();

  /* The event as the sales record sees it: opening balances plus what has sold
     here. It is also the source for what each ticket already sold, which an
     edit must carry over. */
  const view = useMemo(() => eventView(product), [product]);
  const initial = useMemo(() => fromEvent(product, view), [product, view]);
  const [f, setF] = useState<EventForm>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const now = useMemo(() => demoNow(), []);
  const item = useMemo(() => productItem(product, env.resources, DEMO_TODAY, now), [product, env.resources, now]);
  const actions = useRecordActions({ product, item, onChanged });

  const available: TabId[] = ["overview", "details", "prices", "where", "page", "rules", "support"];
  const [tab, setTab] = useRecordTab(available);

  const patch = (p: Partial<EventForm>) => setF((cur) => ({ ...cur, ...p }));
  const dirty = useMemo(() => JSON.stringify(f) !== JSON.stringify(initial), [f, initial]);

  /* The Details tab speaks EventContent. Its page-owned facts are read from
     and written to the page, so nothing is held twice. */
  const content: EventContent = {
    title: f.title,
    subtitle: f.page.tagline ?? "",
    date: f.date,
    startTime: f.startTime,
    endDate: f.endDate,
    endTime: f.endTime,
    days: f.days,
    venueName: f.venueName,
    venueAddress: f.venueAddress,
    description: f.description,
    coverUrl: f.page.coverUrl ?? "",
    videoUrl: f.page.videoUrl ?? "",
    organiserName: f.page.organiser?.name ?? "",
    organiserBlurb: f.page.organiser?.blurb ?? "",
    lineup: f.page.lineup,
    faq: f.page.faq,
  };
  const onContent = (c: Partial<EventContent>) =>
    setF((cur) => {
      const next: EventForm = { ...cur };
      let page = cur.page;
      for (const [k, v] of Object.entries(c)) {
        switch (k) {
          case "title": case "description": case "date": case "startTime": case "endDate": case "endTime": case "venueName": case "venueAddress":
            (next as unknown as Record<string, unknown>)[k] = v;
            break;
          case "days":
            next.days = v as EventDay[];
            break;
          case "subtitle":
            page = { ...page, tagline: (v as string).trim() ? (v as string) : undefined };
            break;
          case "coverUrl":
            page = { ...page, coverUrl: (v as string) || undefined };
            break;
          case "videoUrl":
            page = { ...page, videoUrl: (v as string) || undefined };
            break;
          case "organiserName":
          case "organiserBlurb": {
            const name = k === "organiserName" ? (v as string) : (page.organiser?.name ?? "");
            const blurb = k === "organiserBlurb" ? (v as string) : (page.organiser?.blurb ?? "");
            page = { ...page, organiser: name.trim() || blurb.trim() ? { name, blurb: blurb || undefined } : undefined };
            break;
          }
          case "lineup":
            page = { ...page, lineup: v as ProductPage["lineup"] };
            break;
          case "faq":
            page = { ...page, faq: v as ProductPage["faq"] };
            break;
        }
      }
      next.page = page;
      return next;
    });

  const existing = useMemo(() => new Map(view.tiers.map((x) => [x.id, x])), [view.tiers]);
  /** The form's tickets, with what the form does not edit carried over from
   *  the record — above all what has been sold. */
  const tiers: EventTier[] = toTiers(f.rows).map((x) => {
    const was = existing.get(x.id);
    return was ? { ...was, ...x, sold: was.sold, perks: was.perks, maxPerOrder: was.maxPerOrder } : x;
  });
  const startsAt = `${f.date}T${f.startTime}:00+06:00`;
  const endsAt = endsAtOf(f);

  const problem = whereProblem({ counter: f.counter, online: f.onlineMode, locationIds: f.locationIds, slug: f.slug }, product.id);
  const invalid = problem !== null;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.title.trim()) e.title = te("error.title");
    if (!f.date) e.date = tw("missing.date");
    if (!f.venueName.trim()) e.venueName = te("error.venue");
    if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) e.ends = tw("missing.ends");
    const kept = new Set(f.rows.map((r) => r.id));
    const removedSold = view.tiers.find((x) => !kept.has(x.id) && x.sold > 0);
    if (removedSold) e.tiers = tc("removedSold", { name: removedSold.name, count: removedSold.sold });
    const under = tiers.find((x) => x.quantity < x.sold);
    if (under) e.tiers = tc("belowSold", { name: under.name, count: under.sold });
    if (f.rows.some((r) => !r.name.trim() || !r.quantity.trim())) e.tiers = e.tiers ?? te("error.tierName");
    if (problem === "nowhere") e.where = tcw("nowhere");
    setErrors(e);
    if (e.title || e.venueName || e.date || e.ends) setTab("details");
    else if (e.tiers) setTab("prices");
    else if (e.where) setTab("where");
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    const res = await updateEvent(product.id, {
      subtype: f.subtype || view.subtype,
      channels: channelsOf(f.counter, f.onlineMode) as Channel[],
      locationIds: f.counter ? f.locationIds : [],
      title: f.title.trim(),
      description: f.description.trim() || undefined,
      ...(f.onlineMode !== "off" ? { slug: f.slug.trim() } : {}),
      startsAt,
      endsAt,
      days: f.days.length > 1 ? f.days : undefined,
      venueName: f.venueName.trim(),
      venueAddress: f.venueAddress.trim() || undefined,
      tiers,
      extras: f.extras
        .filter((a) => a.name.trim())
        .map((a) => ({
          id: a.id ?? `add_${globalThis.crypto.randomUUID().slice(0, 8)}`,
          name: a.name.trim(),
          price: Math.round((parseFloat(a.price) || 0) * 100),
          perPerson: a.perPerson,
          itemId: a.itemId,
        })),
    });
    if (!res.ok) {
      setSaving(false);
      toast.error(res.error.message);
      return;
    }
    /* The page, the link's listing and the rules are not part of an event's own
       record, so they go in a second write — and only what changed. */
    const rest: Partial<Product> = {};
    if (JSON.stringify(f.page) !== JSON.stringify(initial.page)) rest.page = f.page;
    if (f.onlineMode !== "off") rest.online = f.onlineMode;
    if (JSON.stringify(f.policies) !== JSON.stringify(initial.policies)) rest.policies = f.policies;
    if (Object.keys(rest).length) {
      const r2 = await updateProduct(product.id, rest);
      if (!r2.ok) {
        setSaving(false);
        toast.error(r2.error.message);
        return;
      }
    }
    const fresh = await getProduct(product.id);
    setSaving(false);
    if (!fresh.ok) return toast.error(fresh.error.message);
    toast.success(tc("saved", { title: res.data.title }));
    setF(fromEvent(fresh.data, eventView(fresh.data)));
    setErrors({});
    onChanged(fresh.data);
  };

  const discard = () => {
    setF(initial);
    setErrors({});
  };

  /* The page, drawn from the draft: unsaved edits included. */
  const draftProduct = useMemo<Product>(
    () => ({
      ...product,
      name: f.title.trim() || product.name,
      description: f.description,
      channels: channelsOf(f.counter, f.onlineMode),
      locationIds: f.locationIds,
      online: f.onlineMode !== "off" ? f.onlineMode : product.online,
      slug: f.slug || product.slug,
      event: {
        ...product.event!,
        startsAt,
        endsAt,
        days: f.days.length > 1 ? f.days : undefined,
        venueName: f.venueName.trim() || product.event!.venueName,
        venueAddress: f.venueAddress.trim() || undefined,
      },
      tiers: tiers.map((x) => tierToPrice(x) as PriceTier),
      page: f.page,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tiers`, `startsAt` and `endsAt` derive from `f`
    [product, f],
  );

  const sold = Object.fromEntries(view.tiers.map((x) => [x.id, x.sold]));
  const savedOnline = initial.onlineMode !== "off" && f.onlineMode === initial.onlineMode && f.slug === initial.slug;
  const card = (node: React.ReactNode) => <Card>{node}</Card>;

  const settlement = useMemo(() => eventSettlement(view, (n) => tr("days.nth", { n })), [view, tr]);
  const csvItem = {
    key: "csv",
    label: tr("settle.export"),
    icon: <Download size={14} strokeWidth={1.5} />,
    onSelect: () => downloadCsv(`settlement-${view.slug}.csv`, settlementCsv(view, settlement, tr as never)),
  };
  /* The settlement download sits before the destructive item (archive/delete),
     which the shared menu always puts last, after a rule. */
  const full = [...actions.menu.slice(0, actions.menu.length - 1), csvItem, ...actions.menu.slice(-1)];

  const multi = spansDays(view);
  const days = eventDays(view);
  const when = multi
    ? `${formatDay(days[0].date, { weekday: true })} – ${formatDay(days[days.length - 1].date, { weekday: true })}`
    : `${formatDay(view.startsAt.slice(0, 10), { weekday: true })} · ${view.endsAt ? formatClockRange(view.startsAt.slice(11, 16), view.endsAt.slice(11, 16)) : formatClock(view.startsAt.slice(11, 16))}`;

  const tabs: RecordTab[] = [
    {
      id: "overview",
      label: ti("tab.overview"),
      node: (
        <EventOverview
          e={view}
          online={f.onlineMode}
          slug={f.slug}
          counter={f.counter}
          locations={env.locations}
          locationIds={f.locationIds}
          saved={savedOnline}
          onSellOnline={() => setTab("where")}
        />
      ),
    },
    {
      id: "details",
      label: ti("tab.details"),
      node: card(
        <EventDetails
          scopedTickets={f.rows.filter((r) => r.dayIds.length > 0).length}
          onUntieTickets={() => setF((cur) => ({ ...cur, rows: cur.rows.map((r) => (r.dayIds.length ? { ...r, dayIds: [] } : r)) }))}
          categoryId={view.categoryId}
          content={content}
          onContent={onContent}
          errors={errors}
          subtype={f.subtype}
          onSubtype={(s) => patch({ subtype: s })}
        />,
      ),
    },
    {
      id: "prices",
      label: ti("tab.prices"),
      node: (
        <div className="flex flex-col gap-section">
          {Object.values(sold).some((n) => n > 0) && <p className="text-sm text-muted">{tc("soldNote")}</p>}
          {errors.tiers && (
            <p role="alert" className="rounded-control bg-danger-wash px-comfortable py-tight text-sm font-medium text-danger">{errors.tiers}</p>
          )}
          <TicketTiers rows={f.rows} onChange={(rows) => patch({ rows })} errors={errors} sold={sold} days={f.days} />
          {/* An event hands things over too — a programme, a glow band, a
              T-shirt — and they are the same countable things a booking
              offers, so they use the same editor and the same shelf. */}
          {card(<AddOnsField addOns={f.extras} onChange={(extras) => patch({ extras })} locationIds={f.locationIds} />)}
        </div>
      ),
    },
    {
      id: "where",
      label: ti("tab.where"),
      node: (
        <>
          {errors.where && <p role="alert" className="rounded-control bg-danger-wash px-comfortable py-tight text-sm font-medium text-danger">{errors.where}</p>}
          <WhereTab
            productId={product.id}
            name={f.title}
            counter={f.counter}
            online={f.onlineMode}
            slug={f.slug}
            locations={env.locations}
            locationIds={f.locationIds}
            onCounter={(v) => patch({ counter: v })}
            onOnline={(v) => patch({ onlineMode: v })}
            onSlug={(v) => patch({ slug: v })}
            onToggleLocation={(id) => patch({ locationIds: f.locationIds.includes(id) ? f.locationIds.filter((x) => x !== id) : [...f.locationIds, id] })}
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
          page={f.page}
          online={f.onlineMode}
          onPage={(page) => patch({ page })}
          onDescription={(description) => patch({ description })}
          onEditDetails={() => setTab("details")}
          onEditTickets={() => setTab("prices")}
          onGoWhere={() => setTab("where")}
        />
      ),
    },
    { id: "rules", label: ti("tab.rules"), node: card(<PoliciesField value={f.policies} onChange={(policies) => patch({ policies })} />) },
    { id: "support", label: ti("tab.support"), node: card(<SupportRows code={product.bookingType} id={product.id} createdAt={product.createdAt} updatedAt={product.updatedAt} />) },
  ];

  return (
    <div className={cn(templateFontVars)}>
      <RecordFrame
        title={view.title}
        description={`${when} · ${view.venueName} · ${te(`category.${categoryById(view.categoryId).key}`)}`}
        state={item.state}
        kindLabel={t("type.event", { category: te(`category.${categoryById(view.categoryId).key}`) })}
        primary={actions.primary}
        secondary={actions.secondary}
        menu={full}
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
