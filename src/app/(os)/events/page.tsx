"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button, DataTable, EmptyState, PageShell, StatStrip, StatusPill, type Column } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { eventCapacity, eventFromPrice, eventRevenue, eventSold, listEvents, type EventRecord } from "@/lib/api";
import { CATEGORIES, categoryById } from "@/lib/events/catalog";
import { templateFontVars } from "@/lib/events/fonts";
import { formatMoney } from "@/lib/format";
import { demoNow } from "@/lib/schedule";

/**
 * The events index.
 *
 * The one thing an events list must answer that a product list does not is
 * **is it selling** — capacity sold against capacity built, per event, at a
 * glance. So the fill bar is the row's centre of gravity rather than a
 * decoration, and the theme swatch on the left says which template it publishes
 * in without opening it.
 */
export default function EventsPage() {
  const t = useTranslations("events");
  const router = useRouter();
  const now = useMemo(() => demoNow(), []);
  const [category, setCategory] = useState("all");
  const [state, setState] = useState("all");

  const q = useApiQuery(() => listEvents({ pageSize: 200 }), []);
  const all = useMemo(() => q.data?.data ?? [], [q.data]);

  const rows = useMemo(
    () =>
      all.filter(
        (e) =>
          (category === "all" || e.categoryId === category) &&
          (state === "all" ||
            (state === "published" ? e.published : state === "draft" ? !e.published : lifecycle(e, now) === state)),
      ),
    [all, category, state, now],
  );

  const summary = useMemo(() => {
    const sold = rows.reduce((s, e) => s + eventSold(e), 0);
    const cap = rows.reduce((s, e) => s + eventCapacity(e), 0);
    return [
      { key: "events", label: t("stat.events"), value: String(rows.length) },
      { key: "sold", label: t("stat.sold"), value: `${sold.toLocaleString()} / ${cap.toLocaleString()}` },
      { key: "revenue", label: t("stat.revenue"), value: formatMoney(rows.reduce((s, e) => s + eventRevenue(e), 0)) },
      { key: "live", label: t("stat.live"), value: String(rows.filter((e) => e.published && lifecycle(e, now) !== "ended").length) },
    ];
  }, [rows, t, now]);

  const columns: Column<EventRecord>[] = [
    {
      key: "title",
      header: t("col.event"),
      render: (e) => {
        const cat = categoryById(e.categoryId);
        return (
          <span className="flex min-w-0 items-center gap-comfortable">
            {/* The theme, in its own literal colours — which template this
                publishes in, without opening it. */}
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm"
              style={{ background: cat.theme.bg, border: `1px solid ${cat.theme.line}` }}
            >
              <span style={{ display: "block", height: 14, width: 3, borderRadius: 999, background: e.customisation.accent }} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{e.title}</span>
              <span className="truncate text-[12px] text-muted">
                {t(`category.${cat.key}`)} · {e.venueName}
              </span>
            </span>
          </span>
        );
      },
    },
    {
      key: "startsAt",
      header: t("col.when"),
      sortable: true,
      render: (e) => (
        <span className="whitespace-nowrap text-muted">
          {new Date(e.startsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      ),
    },
    {
      key: "fill",
      header: t("col.sold"),
      render: (e) => {
        const sold = eventSold(e);
        const cap = eventCapacity(e);
        const pct = cap ? Math.min(100, Math.round((sold / cap) * 100)) : 0;
        return (
          <span className="flex min-w-[9rem] flex-col gap-inline">
            <span className="flex items-baseline justify-between gap-tight text-[12px]">
              <span className="tabular-nums">{sold.toLocaleString()} / {cap.toLocaleString()}</span>
              <span className="text-muted tabular-nums">{pct}%</span>
            </span>
            <span className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <span
                className={cn("block h-full rounded-full", pct >= 90 ? "bg-ember-solid" : "bg-success")}
                style={{ width: `${pct}%` }}
              />
            </span>
          </span>
        );
      },
    },
    {
      key: "from",
      header: t("col.from"),
      align: "right",
      render: (e) => {
        const p = eventFromPrice(e);
        return (
          <span className="whitespace-nowrap font-mono text-[13px] tabular-nums">
            {p === null ? <span className="text-muted">{t("soldOut")}</span> : p === 0 ? t("free") : formatMoney(p)}
          </span>
        );
      },
    },
    {
      key: "status",
      header: t("col.status"),
      align: "right",
      render: (e) => <EventState event={e} now={now} />,
    },
  ];

  return (
    <PageShell
      title={t("title")}
      description={t("description")}
      actions={
        <Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/events/new")}>
          {t("create")}
        </Button>
      }
    >
      <div className={cn("flex flex-col gap-section pb-hero", templateFontVars)}>
        <StatStrip items={summary} loading={q.loading} />

        <div className="flex flex-wrap items-center gap-tight">
          <select
            aria-label={t("filter.allCategories")}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-11 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-ember md:h-9"
          >
            <option value="all">{t("filter.allCategories")}</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{t(`category.${c.key}`)}</option>
            ))}
          </select>
          <select
            aria-label={t("filter.allStates")}
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="h-11 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-ember md:h-9"
          >
            <option value="all">{t("filter.allStates")}</option>
            <option value="published">{t("state.published")}</option>
            <option value="draft">{t("state.draft")}</option>
            <option value="onSale">{t("state.onSale")}</option>
            <option value="ended">{t("state.ended")}</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(e) => e.id}
          loading={q.loading}
          minWidth="52rem"
          onRowClick={(e) => router.push(`/events/${e.id}`)}
          renderCard={(e) => {
            const sold = eventSold(e);
            const cap = eventCapacity(e);
            const pct = cap ? Math.min(100, Math.round((sold / cap) * 100)) : 0;
            return (
              <span className="flex flex-col gap-inline">
                <span className="flex items-baseline justify-between gap-tight">
                  <span className="min-w-0 truncate font-medium">{e.title}</span>
                  <EventState event={e} now={now} />
                </span>
                <span className="truncate text-[13px] text-muted">
                  {new Date(e.startsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {e.venueName}
                </span>
                <span className="mt-inline h-1.5 w-full overflow-hidden rounded-full bg-line">
                  <span className={cn("block h-full rounded-full", pct >= 90 ? "bg-ember-solid" : "bg-success")} style={{ width: `${pct}%` }} />
                </span>
                <span className="text-[12px] text-muted tabular-nums">{sold.toLocaleString()} / {cap.toLocaleString()}</span>
              </span>
            );
          }}
          emptyState={
            <EmptyState
              title={t("emptyTitle")}
              message={t("emptyMessage")}
              action={
                <Link href="/events/new">
                  <Button icon={<Plus size={16} strokeWidth={1.5} />}>{t("create")}</Button>
                </Link>
              }
            />
          }
        />
      </div>
    </PageShell>
  );
}

/** Derived from the clock and the record — never a stored flag, the same rule
 *  memberships and holds already follow. */
function lifecycle(e: EventRecord, now: Date): "draft" | "onSale" | "ended" {
  if (!e.published) return "draft";
  if (Date.parse(e.endsAt ?? e.startsAt) < now.getTime()) return "ended";
  return "onSale";
}

function EventState({ event, now }: { event: EventRecord; now: Date }) {
  const t = useTranslations("events");
  const s = lifecycle(event, now);
  return (
    <StatusPill
      tone={s === "onSale" ? "success" : s === "draft" ? "neutral" : "neutral"}
      shape={s === "draft" ? "record" : "transaction"}
    >
      {t(`state.${s}`)}
    </StatusPill>
  );
}
