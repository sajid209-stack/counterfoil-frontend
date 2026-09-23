"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Archive, ArrowLeft, CalendarDays, Check, ChevronDown, Circle, Copy, Eye, EyeOff, Monitor, Pencil, Smartphone, Ticket, Wallet } from "lucide-react";
import { ActionMenu, Button, ConfirmDialog, EmptyState, PageShell, StatStrip, StatusPill, useToast, type PillTone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import {
  archiveEvent,
  duplicateEvent,
  eventCapacity,
  eventChannels,
  eventRevenue,
  eventSold,
  getEvent,
  listLocations,
  setEventPublished,
} from "@/lib/api";
import { eventState, type CatalogState } from "@/lib/catalog";
import { categoryById } from "@/lib/events/catalog";
import { useTemplateLabels } from "@/lib/events/useTemplateLabels";
import { templateFontVars } from "@/lib/events/fonts";
import { EventTemplate } from "@/components/events/EventTemplate";
import { PreviewFrame } from "@/components/events/PreviewFrame";
import { formatDay, formatPriceShort } from "@/lib/format";
import { demoNow } from "@/lib/schedule";

const TONE: Record<CatalogState, PillTone> = { onSale: "success", needsSetup: "warning", soldOut: "info", offSale: "neutral", ended: "neutral", archived: "neutral" };
const DAY = 86_400_000;

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
 * down rather than filling the screen. It used to be four figure cards over a
 * full-width preview, which answered "what does the page look like" and
 * nothing a box office asks.
 */
export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations("events");
  const tc = useTranslations("catalog");
  const tr = useTranslations("catalog.eventRecord");
  const router = useRouter();
  const toast = useToast();
  const now = useMemo(() => demoNow(), []);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
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
  const cap = e ? eventCapacity(e) : 0;
  const pct = cap ? Math.min(100, Math.round((sold / cap) * 100)) : 0;
  const start = e ? new Date(e.startsAt) : null;
  const days = start ? Math.ceil((start.getTime() - now.getTime()) / DAY) : 0;
  const when = e
    ? `${formatDay(e.startsAt.slice(0, 10), { weekday: true })} · ${e.startsAt.slice(11, 16)}${e.endsAt ? `–${e.endsAt.slice(11, 16)}` : ""}`
    : "";
  const channels = e ? eventChannels(e) : [];
  const locs = (locationsQ.data?.data ?? []).filter((l) => e?.locationIds?.includes(l.id));

  return (
    <PageShell
      title={e?.title ?? t("title")}
      description={e ? `${when} · ${e.venueName} · ${t(`category.${categoryById(e.categoryId).key}`)}` : undefined}
      actions={
        e && state !== "archived" ? (
          <div className="flex items-center gap-tight">
            {state && <StatusPill tone={TONE[state]} shape={state === "offSale" ? "record" : "transaction"}>{tc(`state.${state}`)}</StatusPill>}
            {state !== "ended" && (
              <Button variant="secondary" icon={e.published ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />} onClick={toggle}>
                {tc(e.published ? "action.offSale" : "action.onSale")}
              </Button>
            )}
            <Button icon={<Pencil size={16} strokeWidth={1.5} />} onClick={() => router.push(`/catalog/events/${e.id}/edit`)}>
              {tc("action.edit")}
            </Button>
            <ActionMenu
              label={tc("rowActions", { name: e.title })}
              items={[
                { key: "duplicate", label: tc("action.duplicate"), icon: <Copy size={14} strokeWidth={1.5} />, onSelect: duplicate },
                { key: "archive", label: tc("action.archive"), icon: <Archive size={14} strokeWidth={1.5} />, destructive: true, separated: true, onSelect: () => setArchiving(true) },
              ]}
            />
          </div>
        ) : undefined
      }
    >
      <div className={cn("flex flex-col gap-section pb-hero", templateFontVars)}>
        <Link href="/catalog?kind=events" className="inline-flex min-h-11 items-center gap-inline self-start text-[13px] text-muted hover:text-fg md:hidden">
          <ArrowLeft size={14} strokeWidth={1.5} /> {tc("kind.events")}
        </Link>


        {e && (
          <StatStrip
            items={[
              { key: "sold", icon: <Ticket size={18} strokeWidth={1.5} />, label: tr("sold"), value: `${sold.toLocaleString()} / ${cap.toLocaleString()}`, note: tr("soldNote", { pct }) },
              { key: "revenue", icon: <Wallet size={18} strokeWidth={1.5} />, label: t("stat.revenue"), value: formatPriceShort(eventRevenue(e)) },
              {
                key: "starts",
                icon: <CalendarDays size={18} strokeWidth={1.5} />,
                label: tr("starts"),
                value: state === "ended" ? tr("ended") : days <= 0 ? tr("today") : tr("inDays", { count: days }),
                note: when,
              },
            ]}
          />
        )}

        {e && (
          <div className="grid gap-section lg:grid-cols-[minmax(0,1fr)_20rem]">
            {/* Which tickets are selling — the breakdown the list's one bar
                cannot show, and the first thing a box office is asked. */}
            <section className="card-surface overflow-hidden" aria-labelledby="ev-tiers">
              <h2 id="ev-tiers" className="border-b border-hairline px-card py-comfortable text-base font-semibold tracking-[-0.4px]">{tc("editEvent.tabTickets")}</h2>
              <table className="w-full text-[13px]">
                <thead className="text-left text-[12px] text-muted">
                  <tr className="border-b border-hairline">
                    <th scope="col" className="px-card py-tight font-medium">{tr("colTicket")}</th>
                    <th scope="col" className="py-tight pr-section text-right font-medium">{tr("colPrice")}</th>
                    <th scope="col" className="hidden py-tight pr-section font-medium sm:table-cell">{tr("colSold")}</th>
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
                          <span className="block text-[12px] text-muted sm:hidden tabular-nums">{tc("soldOf", { sold: x.sold.toLocaleString(), cap: x.quantity.toLocaleString() })}</span>
                          {x.salesEnd && <span className="block text-[12px] text-muted">{tr("salesEnd", { date: formatDay(x.salesEnd.slice(0, 10)) })}</span>}
                        </td>
                        <td className="py-comfortable pr-section text-right tabular-nums">{x.price === 0 ? t("free") : formatPriceShort(x.price)}</td>
                        <td className="hidden w-48 py-comfortable pr-section sm:table-cell">
                          <span className="flex items-baseline justify-between gap-tight text-[12px] tabular-nums">
                            <span>{tc("soldOf", { sold: x.sold.toLocaleString(), cap: x.quantity.toLocaleString() })}</span>
                            <span className="text-muted">{p}%</span>
                          </span>
                          <span className="mt-inline block h-1.5 w-full overflow-hidden rounded-full bg-line">
                            <span className={cn("block h-full rounded-full", p >= 90 ? "bg-ember-solid" : "bg-success")} style={{ width: `${p}%` }} />
                          </span>
                        </td>
                        <td className="py-comfortable pr-card text-right tabular-nums">{formatPriceShort(x.sold * x.price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <section className="card-surface p-card" aria-labelledby="ev-where">
              <h2 id="ev-where" className="text-base font-semibold tracking-[-0.4px]">{tr("where")}</h2>
              <dl className="mt-section flex flex-col gap-section text-[13px]">
                <div>
                  <dt className="type-label text-[12px] text-muted">{tr("when")}</dt>
                  <dd className="mt-inline">{when}</dd>
                </div>
                <div>
                  <dt className="type-label text-[12px] text-muted">{tr("venue")}</dt>
                  <dd className="mt-inline">{[e.venueName, e.venueAddress].filter(Boolean).join(" · ")}</dd>
                </div>
                <div>
                  <dt className="type-label text-[12px] text-muted">{tr("soldAt")}</dt>
                  <dd className="mt-inline flex flex-col gap-0.5">
                    {(["online", "counter"] as const).map((c) => {
                      const name = c === "online" ? tc("eventWizard.onlinePage") : tc("wizard.atCounter");
                      return (
                        <span key={c} className={cn("inline-flex items-center gap-inline", !channels.includes(c) && "text-muted")}>
                          {channels.includes(c) ? <Check size={14} strokeWidth={2} aria-hidden className="text-success" /> : <Circle size={14} strokeWidth={1.5} aria-hidden />}
                          {channels.includes(c) ? name : tc("wizard.channelOff", { name })}
                        </span>
                      );
                    })}
                    {locs.length > 0 && <span className="text-muted">{locs.map((l) => l.name).join(" · ")}</span>}
                  </dd>
                </div>
                <div>
                  <dt className="type-label text-[12px] text-muted">{tr("page")}</dt>
                  <dd className="mt-inline text-[12px] text-muted">
                    <span className="break-all font-mono">/e/{e.slug}</span> · {tr("notLive")}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        )}

        {e && (
          <div className="card-surface overflow-hidden">
            <div className="flex items-center justify-between gap-tight border-b border-line px-card py-tight">
              <button
                type="button"
                onClick={() => setPreviewOpen((v) => !v)}
                aria-expanded={previewOpen}
                className="flex min-h-11 min-w-0 items-center gap-tight text-left md:min-h-9"
              >
                <ChevronDown size={16} strokeWidth={1.5} aria-hidden className={cn("shrink-0 text-muted transition-transform duration-quick", !previewOpen && "-rotate-90")} />
                <h2 className="truncate text-base font-semibold tracking-[-0.4px]">{t("customise.preview")}</h2>
              </button>
              {previewOpen && (
                <div className="flex shrink-0 items-center gap-inline">
                  {([["desktop", Monitor], ["mobile", Smartphone]] as const).map(([d, Icon]) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDevice(d)}
                      aria-label={t(`device.${d}`)}
                      aria-pressed={device === d}
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-sm transition-colors duration-quick sm:h-9 sm:w-9",
                        device === d ? "bg-inverse text-inverse-fg" : "text-muted hover:bg-subtle hover:text-fg",
                      )}
                    >
                      <Icon size={16} strokeWidth={1.5} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            {previewOpen && (
              <div className="bg-subtle p-card">
                <div className="mx-auto overflow-hidden rounded-sm shadow-md" style={{ maxWidth: width }}>
                  <PreviewFrame width={width}>
                    <EventTemplate event={e} device={device} labels={labels} now={now} />
                  </PreviewFrame>
                </div>
              </div>
            )}
          </div>
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
