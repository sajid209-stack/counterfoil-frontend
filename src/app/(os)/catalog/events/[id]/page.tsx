"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Archive, Check, ChevronDown, Circle, Copy, Download, Eye, EyeOff, Monitor, Pencil, Smartphone } from "lucide-react";
import { ActionMenu, Button, ConfirmDialog, EmptyState, PageShell, StatusPill, useToast, type ActionMenuItem, type PillTone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { MD, useMediaQuery } from "@/lib/useMedia";
import {
  archiveEvent,
  dayFill,
  duplicateEvent,
  eventDays,
  spansDays,
  tierDays,
  eventChannels,
  eventSettlement,
  eventSold,
  getEvent,
  listLocations,
  setEventPublished,
  type EventRecord,
  type EventSettlement,
  type EventTier,
} from "@/lib/api";
import { eventState, type CatalogState } from "@/lib/catalog";
import { dayName } from "@/lib/events/days";
import { categoryById } from "@/lib/events/catalog";
import { useTemplateLabels } from "@/lib/events/useTemplateLabels";
import { templateFontVars } from "@/lib/events/fonts";
import { EventTemplate } from "@/components/events/EventTemplate";
import { PreviewFrame } from "@/components/events/PreviewFrame";
import { formatClock, formatClockRange, formatDay, formatPriceShort } from "@/lib/format";
import { demoNow } from "@/lib/schedule";

const TONE: Record<CatalogState, PillTone> = { onSale: "success", needsSetup: "warning", soldOut: "info", offSale: "neutral", ended: "neutral", archived: "neutral" };

/* The preview is the longest thing on the page and the least often needed, so
   it starts folded; opening it is remembered for next time, per browser. */
const PREVIEW_KEY = "cf_event_preview_open";
const PREVIEW_EVENT = "cf-event-preview";
const subscribePreview = (cb: () => void) => {
  window.addEventListener(PREVIEW_EVENT, cb);
  return () => window.removeEventListener(PREVIEW_EVENT, cb);
};
const previewStored = () => {
  try {
    return localStorage.getItem(PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * The event record: what an operator opens an event to find out — is it
 * selling, which tickets, where, and when — with the page itself one fold
 * down rather than filling the screen.
 *
 * Key facts first, in one quiet card; then the ticket types and the sales
 * summary. What is only sometimes needed (where it was bought, each day's
 * capacity, how it is sold, the page preview) is secondary: shown as plain
 * sections on a desktop, folded behind a labelled row on a phone.
 */
export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations("events");
  const tc = useTranslations("catalog");
  const tr = useTranslations("catalog.eventRecord");
  const router = useRouter();
  const toast = useToast();
  const wide = useMediaQuery(MD);
  const now = useMemo(() => demoNow(), []);
  const [deviceChoice, setDeviceChoice] = useState<"desktop" | "mobile" | null>(null);
  /* A phone opens the preview as a phone: a 1,180px page scaled into 358px is
     a thumbnail nobody can read. */
  const device = deviceChoice ?? (wide ? "desktop" : "mobile");
  const previewOpen = useSyncExternalStore(subscribePreview, previewStored, () => false);
  const setPreviewOpen = (next: (v: boolean) => boolean) => {
    try {
      localStorage.setItem(PREVIEW_KEY, next(previewOpen) ? "1" : "0");
    } catch {
      /* private window: it simply opens folded next time */
    }
    window.dispatchEvent(new Event(PREVIEW_EVENT));
  };
  const [archiving, setArchiving] = useState(false);
  const [busy, setBusy] = useState(false);
  const q = useApiQuery(() => getEvent(params.id), [params.id]);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const e = q.data;
  /* The settlement, and the file an accountant asks for. Built from the same
     function the figures above it use, so the export and the screen can never
     disagree — the rule the tax report already follows. */
  const settlement = useMemo(
    () => (e ? eventSettlement(e, (n) => tr("days.nth", { n })) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [e],
  );
  const exportSettlement = () => {
    if (!settlement) return;
    const major = (m: number) => (m / 100).toFixed(2);
    const cell = (v: string | number) => {
      const t = String(v);
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const row = (xs: (string | number)[]) => xs.map(cell).join(",");
    const lines = [
      row([tr("colTicket"), tr("colPrice"), tr("settle.capacity"), tr("settle.sold"), tr("settle.unsoldCol"), tr("settle.faceValue"), tr("settle.refundedCol"), tr("settle.taken")]),
      ...settlement.tiers.map((x) => row([x.name, major(x.price), x.capacity, x.sold, x.unsold, major(x.faceValue), major(x.refundedAmount), major(x.net)])),
      row([tr("settle.total"), "", settlement.totals.capacity, settlement.totals.sold, settlement.totals.unsold, major(settlement.totals.faceValue), major(settlement.totals.refundedAmount), major(settlement.totals.net)]),
    ];
    if (settlement.days.length > 1) {
      lines.push("", row([tr("settle.byDay"), tr("settle.capacity"), tr("settle.sold"), tr("settle.unsoldCol")]));
      for (const d of settlement.days) lines.push(row([`${d.name} ${d.date}`, d.capacity, d.sold, d.unsold]));
    }
    if (settlement.byChannel.length) {
      lines.push("", row([tr("settle.byChannel"), tr("settle.sold"), tr("settle.taken")]));
      for (const c of settlement.byChannel) lines.push(row([tr(`settle.channel.${c.channel}`), c.sold, major(c.net)]));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `settlement-${e?.slug ?? "event"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const labels = useTemplateLabels(e?.categoryId ?? null);

  if (!q.loading && (q.error || !e)) {
    return (
      <PageShell title={t("title")}>
        <EmptyState title={t("emptyTitle")} action={<Link href="/catalog?kind=events"><Button>{tc("kind.events")}</Button></Link>} />
      </PageShell>
    );
  }

  const width = device === "mobile" ? 390 : 1180;
  const state = e ? eventState(e, now) : null;
  /* On and off sale from the record itself — the list could, the record the
     list opens could not, which sent people back to the list to do it. */
  const toggle = async () => {
    if (!e) return;
    const res = await setEventPublished(e.id, !e.published);
    if (!res.ok) return toast.error(res.error.message);
    toast.success(tc(res.data.published ? "toast.onSaleOne" : "toast.offSaleOne", { name: e.title }));
    q.reload();
  };
  const duplicate = async () => {
    if (!e) return;
    const res = await duplicateEvent(e.id, t("copyTitle", { title: e.title }));
    if (!res.ok) return toast.error(res.error.message);
    toast.success(tc("toast.duplicated", { name: res.data.title }));
    router.push(`/catalog/events/${res.data.id}/edit`);
  };
  const archive = async () => {
    if (!e) return;
    setBusy(true);
    const res = await archiveEvent(e.id);
    setBusy(false);
    setArchiving(false);
    if (!res.ok) return toast.error(res.error.message);
    toast.success(tc("toast.archivedOne", { name: e.title }));
    router.push("/catalog?kind=events");
  };

  const sold = e ? eventSold(e) : 0;
  /* A two-day event used to read "Sat 24 Oct · 16:00–22:00" — the end time of
     a day this line does not name. It states the range of DAYS instead, and
     leaves the clock to the per-day list below, where it is true. */
  const multi = e ? spansDays(e) : false;
  const evDays = e ? eventDays(e) : [];
  const when = !e
    ? ""
    : multi
      ? `${formatDay(evDays[0].date, { weekday: true })} – ${formatDay(evDays[evDays.length - 1].date, { weekday: true })}`
      : `${formatDay(e.startsAt.slice(0, 10), { weekday: true })} · ${e.endsAt ? formatClockRange(e.startsAt.slice(11, 16), e.endsAt.slice(11, 16)) : formatClock(e.startsAt.slice(11, 16))}`;
  const channels = e ? eventChannels(e) : [];
  const locs = (locationsQ.data?.data ?? []).filter((l) => e?.locationIds?.includes(l.id));

  /* One primary, Edit; everything else behind the menu. Download is offered on
     an archived event too — that is where a settlement is most often needed. */
  const menuItems: ActionMenuItem[] = e
    ? [
        ...(state !== "archived" && state !== "ended"
          ? [{ key: "toggle", label: tc(e.published ? "action.offSale" : "action.onSale"), icon: e.published ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />, onSelect: toggle }]
          : []),
        ...(state !== "archived" ? [{ key: "duplicate", label: tc("action.duplicate"), icon: <Copy size={14} strokeWidth={1.5} />, onSelect: duplicate }] : []),
        { key: "csv", label: tr("settle.export"), icon: <Download size={14} strokeWidth={1.5} />, onSelect: exportSettlement },
        ...(state !== "archived"
          ? [{ key: "archive", label: tc("action.archive"), icon: <Archive size={14} strokeWidth={1.5} />, destructive: true, separated: true, onSelect: () => setArchiving(true) }]
          : []),
      ]
    : [];

  return (
    <PageShell
      title={e?.title ?? t("title")}
      back={{ href: "/catalog?kind=events", label: tc("kind.events") }}
      description={e ? `${when} · ${e.venueName} · ${t(`category.${categoryById(e.categoryId).key}`)}` : undefined}
      status={e && state ? <StatusPill tone={TONE[state]} shape={state === "offSale" ? "record" : "transaction"}>{tc(`state.${state}`)}</StatusPill> : undefined}
      /* Edit is the page's one primary. On a phone PageShell draws it as a disc in
         the top bar carrying this pencil, with "Edit" as its accessible name. */
      primary={e && state !== "archived" ? { label: tc("action.edit"), icon: <Pencil size={16} strokeWidth={1.5} />, href: `/catalog/events/${e.id}/edit` } : undefined}
      actions={e ? <ActionMenu label={tc("rowActions", { name: e.title })} items={menuItems} /> : undefined}
    >
      <div className={cn("flex flex-col gap-section pb-hero", templateFontVars)}>
        {!e && <div aria-busy="true" className="h-40 animate-pulse rounded-md bg-muted-wash" />}

        {/* The facts, first and quiet: when, where, how much of it has gone,
            and what that took. Four pairs in one card, no figures competing. */}
        {e && settlement && (
          <dl aria-label={tr("factsLabel")} className="card-surface grid grid-cols-2 gap-x-section gap-y-comfortable p-card lg:grid-cols-4">
            <FactItem label={tr("when")} className="col-span-2 lg:col-span-1">{when}</FactItem>
            <FactItem label={tr("venue")} className="col-span-2 lg:col-span-1">
              <span className="block">{e.venueName}</span>
              {e.venueAddress && <span className="block text-[0.75rem] text-muted">{e.venueAddress}</span>}
            </FactItem>
            <FactItem label={tr("settle.sold")}>
              <span className="tabular-nums">{tr("days.soldOf", { sold: settlement.totals.sold.toLocaleString(), cap: settlement.totals.capacity.toLocaleString() })}</span>
              <Bar pct={settlement.totals.capacity ? Math.min(100, Math.round((settlement.totals.sold / settlement.totals.capacity) * 100)) : 0} className="mt-tight" />
            </FactItem>
            <FactItem label={tr("settle.taken")}>
              <span className="tabular-nums">{formatPriceShort(settlement.totals.net)}</span>
              {settlement.totals.refundedAmount > 0 && <span className="block text-[0.75rem] text-muted">{tr("settle.refunded", { amount: formatPriceShort(settlement.totals.refundedAmount) })}</span>}
            </FactItem>
          </dl>
        )}

        {e && (
          /* Two columns from lg. On a phone both wrappers dissolve (`contents`) and
              the sections stack in the order the `order` utilities give them —
              tickets, summary, then the secondary folds — which is not the
              order the two desktop columns read in. */
          <div className="flex flex-col gap-section lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="flex min-w-0 flex-col gap-section max-lg:contents">
              {/* Which tickets are selling — the breakdown the list's one bar
                  cannot show, and the first thing a box office is asked. */}
              <section className="card-surface overflow-hidden max-lg:order-1" aria-labelledby="ev-tiers">
                <h2 id="ev-tiers" className="px-card pb-tight pt-card text-base font-semibold text-fg">{tc("editEvent.tabTickets")}</h2>
                {wide ? (
                  <table className="w-full text-[0.8125rem]">
                    <thead className="text-left text-[0.75rem] text-muted">
                      <tr className="border-b border-hairline">
                        <th scope="col" className="px-card py-tight font-medium">{tr("colTicket")}</th>
                        <th scope="col" className="py-tight pr-section text-right font-medium">{tr("colPrice")}</th>
                        <th scope="col" className="py-tight pr-section font-medium">{tr("colSold")}</th>
                        <th scope="col" className="py-tight pr-card text-right font-medium">{tr("colRevenue")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {e.tiers.map((x) => {
                        const p = x.quantity ? Math.min(100, Math.round((x.sold / x.quantity) * 100)) : 0;
                        return (
                          <tr key={x.id} className="border-b border-hairline last:border-0">
                            <td className="px-card py-comfortable">
                              <span className="block font-medium">{x.name}</span>
                              <TierMeta e={e} x={x} multi={multi} evDays={evDays} tr={tr} />
                            </td>
                            <td className="py-comfortable pr-section text-right tabular-nums">{x.price === 0 ? t("free") : formatPriceShort(x.price)}</td>
                            <td className="w-48 py-comfortable pr-section">
                              <span className="flex items-baseline justify-between gap-tight text-[0.75rem] tabular-nums">
                                <span>{tc("soldOf", { sold: x.sold.toLocaleString(), cap: x.quantity.toLocaleString() })}</span>
                                <span className="text-muted">{p}%</span>
                              </span>
                              <Bar pct={p} className="mt-inline" />
                            </td>
                            <td className="py-comfortable pr-card text-right tabular-nums">{formatPriceShort(x.sold * x.price)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  /* A phone does not get a table: one card of two-line rows —
                     the ticket and its price, then what has sold and what it
                     brought in. */
                  <ul className="divide-y divide-hairline">
                    {e.tiers.map((x) => (
                      <li key={x.id} className="px-card py-comfortable">
                        <div className="flex items-baseline justify-between gap-tight">
                          <span className="min-w-0 break-words font-medium">{x.name}</span>
                          <span className="shrink-0 text-[0.8125rem] tabular-nums">{x.price === 0 ? t("free") : formatPriceShort(x.price)}</span>
                        </div>
                        <div className="mt-inline flex items-baseline justify-between gap-tight text-[0.75rem] text-muted tabular-nums">
                          <span>{tc("soldOf", { sold: x.sold.toLocaleString(), cap: x.quantity.toLocaleString() })}</span>
                          <span>{formatPriceShort(x.sold * x.price)}</span>
                        </div>
                        <TierMeta e={e} x={x} multi={multi} evDays={evDays} tr={tr} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Each day, and how full it is.
                  The figure that matters here is NOT the ticket count: a weekend
                  pass is one ticket standing on two days, so Saturday's places are
                  the Saturday passes AND every pass that covers it. Summing tickets
                  instead would let a festival sell its Saturday twice. */}
              {multi && (
                <Panel id="ev-days" title={tr("days.title")} wide={wide} className="max-lg:order-3">
                  <ul className="grid gap-comfortable [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
                    {evDays.map((d, i) => {
                      const f = dayFill(e, d.id);
                      /* Through `tierDays`, not a second hand-rolled copy of the
                         same rule — two implementations of "which tickets admit
                         this day" agree until the day one of them is changed. */
                      const admits = e.tiers.filter((x) => tierDays(e, x).some((y) => y.id === d.id));
                      return (
                        <li key={d.id} className="flex flex-col gap-inline rounded-sm bg-muted-wash p-comfortable">
                          <span className="flex flex-wrap items-baseline justify-between gap-tight">
                            <span className="text-[0.8125rem] font-medium">{dayName(d, i, (n) => tr("days.nth", { n }))}</span>
                            <span className="text-[0.75rem] text-muted tabular-nums">{formatDay(d.date, { weekday: true })}</span>
                          </span>
                          <span className="text-[0.8125rem] tabular-nums">{tr("days.soldOf", { sold: f.sold.toLocaleString(), cap: f.cap.toLocaleString() })}</span>
                          <Bar pct={f.pct} track="card" />
                          {/* Named, not counted. "3 ticket types admit this day"
                              left the one question this panel exists to answer —
                              does the weekend pass get them in on Sunday? —
                              needing a trip to the table. */}
                          <span className="text-[0.75rem] text-muted">{tr("days.admits", { names: admits.map((x) => x.name).join(", ") })}</span>
                        </li>
                      );
                    })}
                  </ul>
                </Panel>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-section max-lg:contents">
              {/* The settlement. What a box office actually settles a show on:
                  capacity against sold, what came in, what went back — and
                  where it was bought, which is secondary on a phone. */}
              {settlement && (
                <section className="card-surface overflow-hidden max-lg:order-2" aria-labelledby="ev-settle">
                  <h2 id="ev-settle" className="px-card pb-tight pt-card text-base font-semibold text-fg">{tr("settle.title")}</h2>
                  <dl className="divide-y divide-hairline">
                    <SummaryRow label={tr("settle.capacity")} value={settlement.totals.capacity.toLocaleString()} />
                    <SummaryRow label={tr("settle.sold")} value={settlement.totals.sold.toLocaleString()} sub={tr("settle.unsold", { count: settlement.totals.unsold })} />
                    <SummaryRow label={tr("settle.faceValue")} value={formatPriceShort(settlement.totals.faceValue)} />
                    <SummaryRow
                      label={tr("settle.taken")}
                      value={formatPriceShort(settlement.totals.net)}
                      sub={settlement.totals.refundedAmount > 0 ? tr("settle.refunded", { amount: formatPriceShort(settlement.totals.refundedAmount) }) : undefined}
                    />
                  </dl>
                  {wide && settlement.byChannel.length > 0 && (
                    <div className="border-t border-hairline">
                      <h3 className="px-card pb-inline pt-comfortable text-[0.75rem] font-medium text-muted">{tr("settle.byChannel")}</h3>
                      <ChannelRows settlement={settlement} tr={tr} />
                    </div>
                  )}
                </section>
              )}
              {!wide && settlement && settlement.byChannel.length > 0 && (
                <Panel id="ev-bought" title={tr("settle.byChannel")} wide={false} flush className="order-4">
                  <ChannelRows settlement={settlement} tr={tr} />
                </Panel>
              )}

              <Panel id="ev-where" title={tr("where")} wide={wide} className="max-lg:order-5">
                <div className="flex flex-col gap-comfortable text-[0.8125rem]">
                  <ul className="flex flex-col gap-tight">
                    {(["online", "counter"] as const).map((c) => {
                      const name = c === "online" ? tc("eventWizard.onlinePage") : tc("wizard.atCounter");
                      return (
                        <li key={c} className={cn("inline-flex items-center gap-tight", !channels.includes(c) && "text-muted")}>
                          {channels.includes(c) ? <Check size={14} strokeWidth={2} aria-hidden className="text-success" /> : <Circle size={14} strokeWidth={1.5} aria-hidden />}
                          {channels.includes(c) ? name : tc("wizard.channelOff", { name })}
                        </li>
                      );
                    })}
                    {locs.length > 0 && <li className="pl-[1.375rem] text-muted">{locs.map((l) => l.name).join(" · ")}</li>}
                  </ul>
                  <div>
                    <p className="text-[0.75rem] font-medium text-muted">{tr("page")}</p>
                    <p className="mt-inline text-[0.75rem] text-muted">
                      {/* The address is a real page now. It is only reachable
                          while the event is published and sold online, so the
                          link is offered exactly when it would work. */}
                      <span className="break-all font-mono">/e/{e.slug}</span>
                      {" · "}
                      {e.published && e.status === "active" && (e.channels ?? ["online"]).includes("online") ? (
                        <a className="inline-flex min-h-11 items-center text-brand-foreground underline underline-offset-2 sm:min-h-0" href={`/e/${e.slug}`} target="_blank" rel="noreferrer">
                          {tr("viewPage")}
                        </a>
                      ) : (
                        tr("notLive")
                      )}
                    </p>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        )}

        {e && (
          <section className="card-surface overflow-hidden" aria-labelledby="ev-preview">
            <h2 id="ev-preview" className="text-base font-semibold text-fg">
              <button
                type="button"
                onClick={() => setPreviewOpen((v) => !v)}
                aria-expanded={previewOpen}
                className="flex min-h-11 w-full items-center justify-between gap-tight px-card py-tight text-left"
              >
                <span className="truncate">{t("customise.preview")}</span>
                <ChevronDown size={16} strokeWidth={1.5} aria-hidden className={cn("shrink-0 text-muted transition-transform duration-quick", previewOpen && "rotate-180")} />
              </button>
            </h2>
            {previewOpen && (
              <>
                <div className="flex justify-end gap-inline px-card pb-tight">
                  {([["desktop", Monitor], ["mobile", Smartphone]] as const).map(([d, Icon]) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDeviceChoice(d)}
                      aria-label={t(`device.${d}`)}
                      aria-pressed={device === d}
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-sm transition-colors duration-quick sm:h-9 sm:w-9",
                        device === d ? "bg-inverse text-inverse-fg" : "text-muted hover:bg-muted-wash hover:text-fg",
                      )}
                    >
                      <Icon size={16} strokeWidth={1.5} />
                    </button>
                  ))}
                </div>
                <div className="bg-muted-wash p-card">
                  <div className="mx-auto overflow-hidden rounded-sm shadow-md" style={{ maxWidth: width }}>
                    <PreviewFrame width={width}>
                      <EventTemplate event={e} device={device} labels={labels} now={now} />
                    </PreviewFrame>
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </div>

      <ConfirmDialog
        open={archiving}
        onClose={() => setArchiving(false)}
        onConfirm={archive}
        loading={busy}
        title={e ? tc("confirm.archiveOne", { name: e.title }) : ""}
        message={
          e && sold > 0 && state !== "ended"
            ? tc("confirm.archiveSoldOne", { count: sold.toLocaleString(), date: formatDay(e.startsAt.slice(0, 10)) })
            : tc("confirm.archiveBody")
        }
        confirmLabel={tc("action.archive")}
      />
    </PageShell>
  );
}

/** One fact in the facts card: a quiet sentence-case label over its value. */
function FactItem({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[0.75rem] font-medium text-muted">{label}</dt>
      <dd className="mt-inline break-words text-sm text-fg">{children}</dd>
    </div>
  );
}

/** A slim fill bar. Ember from 90% — the app's "nearly full" language. */
function Bar({ pct, className, track = "line" }: { pct: number; className?: string; track?: "line" | "card" }) {
  return (
    <span className={cn("block h-1.5 w-full overflow-hidden rounded-full", track === "card" ? "bg-card" : "bg-line", className)}>
      <span className={cn("block h-full rounded-full", pct >= 90 ? "bg-ember-solid" : "bg-success")} style={{ width: `${pct}%` }} />
    </span>
  );
}

/** One row of the sales summary: the label, the figure, and a line under the
 *  figure only where there is something to say. */
function SummaryRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-tight px-card py-comfortable">
      <dt className="text-[0.8125rem] text-muted">{label}</dt>
      <dd className="text-right">
        <span className="text-sm font-semibold tabular-nums">{value}</span>
        {sub && <span className="block text-[0.75rem] text-muted tabular-nums">{sub}</span>}
      </dd>
    </div>
  );
}

/** Where it was bought: one row per source, tickets then money — the money is
 *  left off where there is none to state. */
function ChannelRows({ settlement, tr }: { settlement: EventSettlement; tr: ReturnType<typeof useTranslations> }) {
  return (
    <div>
      <ul className="divide-y divide-hairline text-[0.8125rem]">
        {settlement.byChannel.map((c) => (
          <li key={c.channel} className="flex items-baseline justify-between gap-tight px-card py-comfortable">
            <span>{tr(`settle.channel.${c.channel}`)}</span>
            <span className="shrink-0 text-right tabular-nums">
              {tr("settle.tickets", { count: c.sold })}
              {c.channel !== "opening" && <span className="text-muted"> · {formatPriceShort(c.net)}</span>}
            </span>
          </li>
        ))}
      </ul>
      {settlement.byChannel.some((c) => c.channel === "opening") && (
        <p className="px-card pb-comfortable text-[0.75rem] text-muted">{tr("settle.openingNote")}</p>
      )}
    </div>
  );
}

/** What stands under a ticket's name: which days it admits (multi-day events)
 *  and when it stops selling. Only drawn where there is something to say. */
function TierMeta({
  e,
  x,
  multi,
  evDays,
  tr,
}: {
  e: EventRecord;
  x: EventTier;
  multi: boolean;
  evDays: ReturnType<typeof eventDays>;
  tr: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
      {/* Which days it admits, stated under the name. Most ticket names say
          their own day, but an operator may name one "GA", and a box office
          reading this should not have to guess. */}
      {multi && (
        <span className="mt-inline block text-[0.75rem] text-muted">
          {(() => {
            const mine = tierDays(e, x);
            return mine.length === evDays.length
              ? tr("days.admitsAll")
              : tr("days.admitsOn", { days: mine.map((d) => dayName(d, evDays.findIndex((y) => y.id === d.id), (n) => tr("days.nth", { n }))).join(" + ") });
          })()}
        </span>
      )}
      {x.salesEnd && <span className="block text-[0.75rem] text-muted">{tr("salesEnd", { date: formatDay(x.salesEnd.slice(0, 10)) })}</span>}
    </>
  );
}

/**
 * A secondary section. On a desktop it is a plain titled card; on a phone it is
 * a labelled row that opens — a 44px target with `aria-expanded`, and the body
 * is only in the page while it is open, not hidden-but-present.
 */
function Panel({ id, title, wide, flush = false, className, children }: { id: string; title: string; wide: boolean; flush?: boolean; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const bodyId = `${uid}-body`;
  if (wide) {
    return (
      <section className={cn("card-surface p-card", className)} aria-labelledby={id}>
        <h2 id={id} className="text-base font-semibold text-fg">{title}</h2>
        <div className="mt-comfortable">{children}</div>
      </section>
    );
  }
  return (
    <section className={cn("card-surface overflow-hidden", className)} aria-labelledby={id}>
      <h2 className="text-base font-semibold text-fg">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-h-11 w-full items-center justify-between gap-tight px-card py-tight text-left"
        >
          <span id={id}>{title}</span>
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden className={cn("shrink-0 text-muted transition-transform duration-quick", open && "rotate-180")} />
        </button>
      </h2>
      {open && (
        <div id={bodyId} className={flush ? "pb-tight" : "px-card pb-card"}>
          {children}
        </div>
      )}
    </section>
  );
}
