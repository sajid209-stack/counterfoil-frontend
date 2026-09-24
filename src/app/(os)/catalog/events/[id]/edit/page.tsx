"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button, EmptyState, PageShell, Tabs, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { eventChannels, getEvent, listLocations, updateEvent, type Channel, type EventCustomisation, type EventRecord, type EventTier } from "@/lib/api";
import { categoryById } from "@/lib/events/catalog";
import { WhereSold } from "../../../_components/WhereSold";
import { templateFontVars } from "@/lib/events/fonts";
import { useTemplateLabels } from "@/lib/events/useTemplateLabels";
import { demoNow } from "@/lib/schedule";
import { EventArchitect, type EventContent } from "../../../_components/event/EventArchitect";
import { EventDetails } from "../../../_components/event/EventDetails";
import { endsAtOf } from "../../../_components/event/EventWizard";
import { TicketTiers, toTiers, type FormTier } from "../../../_components/event/TicketTiers";
import { AddOnsField, type FormAddOn } from "../../../_components/booking/AddOnsField";

/**
 * Edit an event.
 *
 * The list's Edit went to a page that could only look at the event — its
 * figures and its preview — so an event, once created, could not have its
 * date, its bill or a price changed at all. Three tabs, in the order they are
 * changed: Details (name, date, venue, cover — the box office's commonest
 * edit, and not a design task), the Page the wizard designs with, and the
 * Ticket types.
 *
 * Tickets carry one rule the wizard never needed: some have been sold. A tier
 * keeps its sold count through an edit, cannot be removed once anything on it
 * has sold (the orders point at it), and cannot be cut below what has already
 * gone — each refused in words beside the tier, never silently.
 */
export default function EditEventPage() {
  const params = useParams<{ id: string }>();
  const q = useApiQuery(() => getEvent(params.id), [params.id]);
  const t = useTranslations("events");
  if (!q.loading && (q.error || !q.data)) {
    return (
      <PageShell title={t("title")}>
        <EmptyState title={t("emptyTitle")} action={<Link href="/catalog?kind=events"><Button>{t("title")}</Button></Link>} />
      </PageShell>
    );
  }
  if (!q.data) return <PageShell title={t("title")}><div aria-busy="true" className="h-64 animate-pulse rounded-md bg-line/40" /></PageShell>;
  return <Editor event={q.data} />;
}

function Editor({ event }: { event: EventRecord }) {
  const t = useTranslations("events");
  const tc = useTranslations("catalog.editEvent");
  const tw = useTranslations("catalog.eventWizard");
  const router = useRouter();
  const toast = useToast();
  const now = useMemo(() => demoNow(), []);
  const labels = useTemplateLabels(event.categoryId);
  const [tab, setTab] = useState<"details" | "page" | "tickets">("details");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [custom, setCustom] = useState<EventCustomisation>(event.customisation);
  const [content, setContent] = useState<EventContent>({
    title: event.title,
    subtitle: event.subtitle ?? "",
    date: event.startsAt.slice(0, 10),
    startTime: event.startsAt.slice(11, 16),
    endDate: event.endsAt ? event.endsAt.slice(0, 10) : "",
    endTime: event.endsAt ? event.endsAt.slice(11, 16) : "",
    venueName: event.venueName,
    venueAddress: event.venueAddress ?? "",
    description: event.description ?? "",
    coverUrl: event.customisation.coverUrl ?? "",
    videoUrl: event.videoUrl ?? "",
    organiserName: event.organiser?.name ?? "",
    organiserBlurb: event.organiser?.blurb ?? "",
    days: event.days ?? [],
    lineup: event.lineup ?? [],
    faq: event.faq ?? [],
  });
  const [seedEdits, setSeedEdits] = useState<Partial<EventRecord>>({});
  /* The kind is stored as the subtype's key when the wizard made the event;
     older records carry a label, which the select cannot hold, so it opens
     unset rather than guessing. */
  const [subtype, setSubtype] = useState(categoryById(event.categoryId).subtypes.includes(event.subtype) ? event.subtype : "");
  const tcw = useTranslations("catalog.wizard");
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const locations = useMemo(() => locationsQ.data?.data ?? [], [locationsQ.data]);
  const [counter, setCounter] = useState(eventChannels(event).includes("counter"));
  const [online, setOnline] = useState(eventChannels(event).includes("online"));
  const [picked, setPicked] = useState<string[] | null>(event.locationIds ?? null);
  const locationIds = picked ?? (locations.length === 1 ? [locations[0].id] : []);
  const [rows, setRows] = useState<FormTier[]>(() =>
    event.tiers.map((x) => ({
      id: x.id,
      name: x.name,
      price: String(x.price / 100),
      quantity: String(x.quantity),
      description: x.description ?? "",
      salesEnd: x.salesEnd ? x.salesEnd.slice(0, 10) : "",
      dayIds: x.dayIds ?? [],
    })),
  );

  /* Extras, in the same form a booking's take — including the inventory link,
     so a programme sold with a ticket is the same programme on the shelf. */
  const [extras, setExtras] = useState<FormAddOn[]>(() =>
    (event.extras ?? []).map((a) => ({ id: a.id, name: a.name, price: String(a.price / 100), perPerson: a.perPerson, itemId: a.itemId })),
  );

  const existing = useMemo(() => new Map(event.tiers.map((x) => [x.id, x])), [event.tiers]);
  /** The form's tiers, with what the form does not edit carried over from the
   *  record — above all what has been sold. */
  const tiers: EventTier[] = toTiers(rows).map((x) => {
    const was = existing.get(x.id);
    return was ? { ...was, ...x, sold: was.sold, perks: was.perks, maxPerOrder: was.maxPerOrder } : x;
  });

  const draft: EventRecord = {
    ...event,
    ...seedEdits,
    title: content.title.trim() || t("placeholder.title"),
    subtitle: content.subtitle.trim() || undefined,
    startsAt: `${content.date}T${content.startTime}:00+06:00`,
    endsAt: endsAtOf(content),
    days: content.days.length > 1 ? content.days : undefined,
    venueName: content.venueName.trim() || t("placeholder.venue"),
    venueAddress: content.venueAddress.trim() || undefined,
    description: content.description.trim() || undefined,
    videoUrl: content.videoUrl.trim() || undefined,
    organiser: content.organiserName.trim() ? { name: content.organiserName.trim(), blurb: content.organiserBlurb.trim() || undefined } : undefined,
    lineup: content.lineup.filter((l) => l.name.trim()),
    faq: content.faq.filter((f) => f.q.trim()),
    tiers,
    customisation: { ...custom, coverUrl: content.coverUrl.trim() || undefined },
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!content.title.trim()) e.title = t("error.title");
    if (!content.date) e.date = tw("missing.date");
    if (!counter && !online) e.tiers = tcw("nowhere");
    else if (counter && locationIds.length === 0) e.tiers = tw("missing.counterLocation");
    if (!content.venueName.trim()) e.venueName = t("error.venue");
    const end = endsAtOf(content);
    if (end && Date.parse(end) <= Date.parse(`${content.date}T${content.startTime}:00+06:00`)) e.ends = tw("missing.ends");
    const kept = new Set(rows.map((r) => r.id));
    const removedSold = event.tiers.filter((x) => !kept.has(x.id) && x.sold > 0);
    if (removedSold.length) e.tiers = tc("removedSold", { name: removedSold[0].name, count: removedSold[0].sold });
    const under = tiers.find((x) => x.quantity < x.sold);
    if (under) e.tiers = tc("belowSold", { name: under.name, count: under.sold });
    if (rows.some((r) => !r.name.trim() || !r.quantity.trim())) e.tiers = e.tiers ?? t("error.tierName");
    setErrors(e);
    if (e.title || e.venueName || e.date || e.ends) setTab("details");
    else if (e.tiers) setTab("tickets");
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    const res = await updateEvent(event.id, {
      ...seedEdits,
      subtype: subtype || event.subtype,
      channels: [...(counter ? (["counter"] as Channel[]) : []), ...(online ? (["online"] as Channel[]) : [])],
      locationIds: counter ? locationIds : [],
      title: content.title.trim(),
      subtitle: content.subtitle.trim() || undefined,
      startsAt: `${content.date}T${content.startTime}:00+06:00`,
      endsAt: endsAtOf(content),
      days: content.days.length > 1 ? content.days : undefined,
      venueName: content.venueName.trim(),
      venueAddress: content.venueAddress.trim() || undefined,
      description: content.description.trim() || undefined,
      videoUrl: content.videoUrl.trim() || undefined,
      organiser: draft.organiser,
      lineup: draft.lineup,
      faq: draft.faq,
      tiers,
      extras: extras
        .filter((a) => a.name.trim())
        .map((a) => ({
          id: a.id ?? `add_${globalThis.crypto.randomUUID().slice(0, 8)}`,
          name: a.name.trim(),
          price: Math.round((parseFloat(a.price) || 0) * 100),
          perPerson: a.perPerson,
          itemId: a.itemId,
        })),
      customisation: draft.customisation,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(tc("saved", { title: res.data.title }));
    router.push(`/catalog/events/${event.id}`);
  };

  return (
    <PageShell
      title={tc("title", { title: event.title })}
      description={tc("description")}
      actions={
        <div className="flex gap-tight">
          <Button variant="secondary" disabled={saving} onClick={() => router.push(`/catalog/events/${event.id}`)}>{tc("cancel")}</Button>
          <Button loading={saving} onClick={save}>{tc("save")}</Button>
        </div>
      }
    >
      <div className={cn("flex flex-col gap-section pb-hero", templateFontVars)}>
        <Link href={`/catalog/events/${event.id}`} className="inline-flex min-h-11 items-center gap-inline self-start text-[13px] text-muted hover:text-fg md:min-h-0">
          <ArrowLeft size={14} strokeWidth={1.5} /> {event.title}
        </Link>
        <Tabs
          items={[
            { value: "details", label: tc("tabDetails") },
            { value: "page", label: tc("tabPage") },
            { value: "tickets", label: tc("tabSales"), count: rows.length },
          ]}
          value={tab}
          onChange={(v) => setTab(v as "details" | "page" | "tickets")}
        />
        {errors.tiers && tab === "tickets" && (
          <p role="alert" className="rounded-sm bg-danger-wash px-comfortable py-tight text-[13px] font-medium text-danger">{errors.tiers}</p>
        )}
        {tab === "details" ? (
          <div className="card-surface p-card">
            <EventDetails
              scopedTickets={rows.filter((r) => r.dayIds.length > 0).length}
              onUntieTickets={() => setRows((rs) => rs.map((r) => (r.dayIds.length ? { ...r, dayIds: [] } : r)))} categoryId={event.categoryId} content={content} onContent={(patch) => setContent((c) => ({ ...c, ...patch }))} errors={errors} subtype={subtype} onSubtype={setSubtype} />
          </div>
        ) : tab === "page" ? (
          <EventArchitect
            categoryId={event.categoryId}
            event={draft}
            custom={custom}
            onCustom={setCustom}
            content={content}
            onContent={(patch) => setContent((c) => ({ ...c, ...patch }))}
            onEvent={(patch) => setSeedEdits((e) => ({ ...e, ...patch }))}
            now={now}
            labels={labels}
            onEditDetails={() => setTab("details")}
          />
        ) : (
          <div className="flex flex-col gap-tight">
            {event.tiers.some((x) => x.sold > 0) && (
              <p className="text-[13px] text-muted">{tc("soldNote")}</p>
            )}
            <TicketTiers rows={rows} onChange={setRows} errors={errors} sold={Object.fromEntries(event.tiers.map((x) => [x.id, x.sold]))} days={content.days} />
            {/* An event hands things over too — a programme, a glow band, a
                T-shirt — and they are the same countable things a booking
                offers, so they use the same editor and the same shelf. */}
            <div className="card-surface mt-section p-card">
              <AddOnsField addOns={extras} onChange={setExtras} locationIds={locationIds} />
            </div>
            <div className="card-surface mt-section p-card">
              <WhereSold
                counter={counter}
                online={online}
                onCounter={setCounter}
                onOnline={setOnline}
                onlineHelp={tw("onlineHelp")}
                counterHelp={tw("counterHelp")}
                locations={locations}
                locationIds={locationIds}
                onToggleLocation={(id) => setPicked(locationIds.includes(id) ? locationIds.filter((x) => x !== id) : [...locationIds, id])}
                locationsOnlyForCounter
              />
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
