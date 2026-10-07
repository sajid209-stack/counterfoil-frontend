"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Download, Search } from "lucide-react";
import { Button, DateRangePicker, EmptyState, FilterBar, PageShell, Select, formatRange, type FilterSpec } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { useActiveLocation } from "@/lib/activeLocation";
import { formatClockOf, formatDay } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import {
  ACTIVITY_GROUPS,
  activityCsv,
  filterActivity,
  listActivity,
  listActivityPeople,
  listLocations,
  localDay,
  type ActivityEvent,
  type ActivityGroup,
  type ActivityQuery,
  type ActivitySeverity,
} from "@/lib/api";
import { Initials, KindBadge, SEVERITY_ROW_CLASS, SeverityChip, useActivityText } from "./_components/parts";

const shift = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const monthStart = (day: string) => `${day.slice(0, 8)}01`;
const PRESETS: { value: string; range: () => [string, string] }[] = [
  { value: "today", range: () => [DEMO_TODAY, DEMO_TODAY] },
  { value: "yesterday", range: () => [shift(DEMO_TODAY, -1), shift(DEMO_TODAY, -1)] },
  { value: "7d", range: () => [shift(DEMO_TODAY, -6), DEMO_TODAY] },
  { value: "30d", range: () => [shift(DEMO_TODAY, -29), DEMO_TODAY] },
  { value: "month", range: () => [monthStart(DEMO_TODAY), DEMO_TODAY] },
  {
    value: "lastmonth",
    range: () => {
      const end = shift(monthStart(DEMO_TODAY), -1);
      return [monthStart(end), end];
    },
  },
];
const PAGE = 40;

/**
 * Activity log - everything that happened, newest first.
 *
 * The dashboard card shows the last half dozen; this is the whole record, the
 * way Stripe's events, Shopify's staff activity and Linear's audit log are: a
 * time-ordered list grouped by day, each line saying who did what and where,
 * with the facts one press away. The venue is the one in the bar; the
 * filters narrow within it.
 */
export default function ActivityPage() {
  return (
    <Suspense fallback={null}>
      <ActivityView />
    </Suspense>
  );
}

function ActivityView() {
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const { id: locationId, location, pending } = useActiveLocation(locationsQ.data?.data ?? []);
  const x = useActivityText();
  const { t } = x;

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<ActivityGroup | "all">("all");
  const [actorId, setActorId] = useState("");
  const [severity, setSeverity] = useState<"all" | "warning" | "critical">("all");
  const [range, setRange] = useState(() => ({ preset: "7d", from: PRESETS[2].range()[0], to: PRESETS[2].range()[1] }));
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const query: ActivityQuery = useMemo(() => {
    const severities: ActivitySeverity[] | undefined = severity === "all" ? undefined : severity === "warning" ? ["warning", "critical"] : ["critical"];
    return {
      locationId,
      groups: group === "all" ? undefined : [group],
      actorId: actorId || undefined,
      severities,
      from: range.from,
      to: range.to,
      search: q || undefined,
    };
  }, [locationId, group, actorId, severity, range.from, range.to, q]);
  const listQ = useApiQuery(() => listActivity({ ...query, pageSize: limit }), [query, limit]);
  const peopleQ = useApiQuery(() => listActivityPeople(), []);

  const events = pending ? undefined : listQ.data?.data;
  const total = listQ.data?.page.total ?? 0;

  /* Newest first already; cut into days, each with its own sticky header. */
  const days = useMemo(() => {
    const out: { day: string; items: ActivityEvent[] }[] = [];
    for (const e of events ?? []) {
      const day = localDay(e.at);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(e);
      else out.push({ day, items: [e] });
    }
    return out;
  }, [events]);

  const presets = PRESETS.map((p) => ({ value: p.value, label: t(`period.${p.value}`), range: p.range }));
  const filtered = group !== "all" || !!actorId || severity !== "all" || !!q;
  const reset = () => {
    setSearch("");
    setQ("");
    setGroup("all");
    setActorId("");
    setSeverity("all");
    setLimit(PAGE);
  };

  const dayLabel = (day: string) => {
    if (day === DEMO_TODAY) return t("day.today");
    if (day === shift(DEMO_TODAY, -1)) return t("day.yesterday");
    return formatDay(day, { weekday: true });
  };

  const download = () => {
    const rows = filterActivity({ ...query });
    const csv = activityCsv(rows, {
      headers: [t("csv.when"), t("csv.type"), t("csv.person"), t("csv.what"), t("csv.venue"), t("csv.counter"), t("csv.device"), t("csv.importance")],
      kind: x.kindLabel,
      text: x.plain,
      severity: (e) => x.severityLabel(e.severity),
    });
    /* A byte-order mark so a spreadsheet reads Bangla correctly. */
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = (location?.name ?? "venue").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "venue";
    a.download = `${t("exportFile")}-${slug}-${range.from}_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filters: FilterSpec[] = [
    {
      key: "group",
      label: t("filter.type"),
      active: group === "all" ? null : x.groupLabel(group),
      onClear: () => setGroup("all"),
      control: (
        <Select
          size="sm"
          className="w-full md:w-44"
          aria-label={t("filter.type")}
          value={group}
          onChange={(v) => {
            setGroup(v as ActivityGroup | "all");
            setLimit(PAGE);
          }}
          options={[
            { value: "all", label: t("filter.allTypes") },
            ...ACTIVITY_GROUPS.map((g) => ({ value: g, label: x.groupLabel(g) })),
          ]}
        />
      ),
    },
    {
      key: "person",
      label: t("filter.person"),
      active: actorId ? peopleQ.data?.find((p) => p.staffId === actorId)?.name ?? actorId : null,
      onClear: () => setActorId(""),
      control: (
        <Select
          size="sm"
          className="w-full md:w-40"
          aria-label={t("filter.person")}
          value={actorId}
          searchPlaceholder={t("search")}
          onChange={(v) => {
            setActorId(v);
            setLimit(PAGE);
          }}
          options={[
            { value: "", label: t("filter.everyone") },
            ...(peopleQ.data ?? []).map((p) => ({ value: p.staffId ?? "", label: p.name })),
          ]}
        />
      ),
    },
    {
      key: "severity",
      label: t("filter.importance"),
      active: severity === "all" ? null : severity === "warning" ? t("filter.warnings") : t("filter.serious"),
      onClear: () => setSeverity("all"),
      control: (
        <Select
          size="sm"
          className="w-full md:w-40"
          aria-label={t("filter.importance")}
          value={severity}
          onChange={(v) => {
            setSeverity(v as "all" | "warning" | "critical");
            setLimit(PAGE);
          }}
          options={[
            { value: "all", label: t("filter.allImportance") },
            { value: "warning", label: t("filter.warnings") },
            { value: "critical", label: t("filter.serious") },
          ]}
        />
      ),
    },
  ];

  return (
    <PageShell title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-section">
        <div className="flex flex-wrap items-start justify-between gap-tight">
          <FilterBar
            className="min-w-0 flex-1 md:flex-row md:items-center"
            search={
              <label className="relative block">
                <Search size={15} strokeWidth={1.5} aria-hidden className="pointer-events-none absolute left-comfortable top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setLimit(PAGE);
                  }}
                  placeholder={t("search")}
                  aria-label={t("search")}
                  className="h-11 w-full min-w-0 rounded-sm border border-line bg-card pl-8 pr-comfortable text-[0.8125rem] outline-none placeholder:text-muted focus:border-inverse md:h-9 md:w-52"
                />
              </label>
            }
            lead={
              <div className="flex w-full min-w-0 items-center gap-tight md:w-auto">
              <DateRangePicker
                value={range}
                onChange={(r) => {
                  setRange({ preset: r.preset, from: r.from, to: r.to });
                  setLimit(PAGE);
                }}
                presets={presets}
                today={DEMO_TODAY}
                max={DEMO_TODAY}
                labels={{
                  choose: t("range.choose"),
                  custom: t("range.custom"),
                  from: t("range.from"),
                  to: t("range.to"),
                  apply: t("range.apply"),
                  cancel: t("range.cancel"),
                  previousMonth: t("range.previousMonth"),
                  nextMonth: t("range.nextMonth"),
                  days: (count) => t("range.days", { count }),
                  pickEnd: t("range.pickEnd"),
                }}
                className="min-w-0 flex-1 md:flex-none"
              />
              {/* On a phone the export is a glyph beside the dates, named in
                  words for a screen reader and on hover; from md it has its own
                  labelled button on the right. */}
              <button
                type="button"
                onClick={download}
                title={t("export")}
                aria-label={t("export")}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-sm border border-line bg-card text-muted active:bg-muted-wash md:hidden"
              >
                <Download size={16} strokeWidth={1.5} aria-hidden />
              </button>
              </div>
            }
            filters={filters}
          />
          <div className="flex items-center gap-tight md:ml-auto">
            {filtered && (
              <Button variant="tertiary" size="sm" onClick={reset}>
                {t("clear")}
              </Button>
            )}
            <Button variant="secondary" size="sm" icon={<Download size={15} strokeWidth={1.5} aria-hidden />} onClick={download} className="max-md:hidden">
              {t("export")}
            </Button>
          </div>
        </div>

        <p className="text-[0.8125rem] text-muted" aria-live="polite">
          {listQ.loading && !events ? " " : `${t("count", { count: total })} · ${PRESETS.some((p) => p.value === range.preset) ? t(`period.${range.preset}`) : formatRange(range.from, range.to)}`}
        </p>

        {listQ.error ? (
          <EmptyState
            title={t("loadFailed")}
            action={
              <Button variant="secondary" size="sm" onClick={() => listQ.reload()}>
                {t("retry")}
              </Button>
            }
          />
        ) : !events ? (
          <div aria-busy="true" className="flex flex-col gap-section">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col gap-tight">
                <div className="h-5 w-28 animate-pulse rounded-sm bg-subtle" />
                <div className="rounded-md border border-line bg-card">
                  {[0, 1, 2, 3].map((j) => (
                    <div key={j} className="flex items-center gap-comfortable border-b border-hairline px-card py-comfortable last:border-0">
                      <div className="h-8 w-8 animate-pulse rounded-sm bg-subtle" />
                      <div className="h-4 flex-1 animate-pulse rounded-sm bg-subtle" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={<Search size={20} strokeWidth={1.5} aria-hidden />}
            title={filtered ? t("empty.title") : t("empty.none")}
            message={filtered ? t("empty.body") : undefined}
            action={
              filtered ? (
                <Button variant="secondary" size="sm" onClick={reset}>
                  {t("clear")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {days.map(({ day, items }) => (
              <section key={day} aria-label={dayLabel(day)} className="flex flex-col">
                {/* Sticky under the page bar, on the page's own colour so rows
                    slide cleanly beneath it. On a phone the document scrolls
                    and the bar is pinned above it (53px); from md the content
                    scrolls inside its own pane, which already starts below the
                    bar, so the header pins to the pane's top. */}
                <h2 className="sticky top-[53px] z-10 -mx-gutter bg-surface px-gutter py-tight text-[0.8125rem] font-semibold text-muted md:top-0">
                  {dayLabel(day)}
                  <span className="ml-tight font-normal">{day === DEMO_TODAY || day === shift(DEMO_TODAY, -1) ? formatDay(day, { weekday: true }) : ""}</span>
                </h2>
                <ul className="overflow-hidden rounded-md border border-line bg-card">
                  {items.map((e) => (
                    <Row key={e.id} e={e} x={x} expanded={!!open[e.id]} onToggle={() => setOpen((o) => ({ ...o, [e.id]: !o[e.id] }))} />
                  ))}
                </ul>
              </section>
            ))}
            {total > events.length && (
              <div className="flex justify-center">
                <Button variant="secondary" onClick={() => setLimit((n) => n + PAGE)}>
                  {t("showMore", { count: Math.min(PAGE, total - events.length) })}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}

function Row({
  e,
  x,
  expanded,
  onToggle,
}: {
  e: ActivityEvent;
  x: ReturnType<typeof useActivityText>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = x;
  /* The venue is the one in the bar, so a row names the counter and device; a
     business-wide event (a setting) names the venue instead. */
  const where = [e.counter, e.device].filter(Boolean).join(" · ") || e.venue || "";
  return (
    <li className={cn("border-b border-hairline last:border-0", SEVERITY_ROW_CLASS[e.severity])}>
      {/* The row opens on a press anywhere that is not a link or a button; the
          chevron is the keyboard's way in. */}
      <div
        className="flex items-start gap-comfortable px-card py-comfortable"
        onClick={(ev) => {
          if ((ev.target as HTMLElement).closest("a,button")) return;
          onToggle();
        }}
      >
        <span className="hidden w-[4.75rem] shrink-0 pt-[0.4rem] text-[0.8125rem] tabular-nums text-muted md:block">{formatClockOf(e.at)}</span>
        <KindBadge kind={e.kind} severity={e.severity} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-[0.8125rem] leading-snug">{x.sentence(e, true)}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-tight gap-y-0.5 text-[0.75rem] text-muted">
            <span className="md:hidden">{formatClockOf(e.at)}</span>
            <span className="font-medium">{x.kindLabel(e)}</span>
            {where && <span className="min-w-0 break-words">· {where}</span>}
            <SeverityChip severity={e.severity} label={x.severityLabel(e.severity)} />
          </p>
        </div>
        <span className="hidden items-center gap-inline pt-1 text-[0.75rem] text-muted md:flex">
          <Initials name={e.actor?.name ?? null} />
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? t("hide") : t("show")}: ${x.plain(e)}`}
          className="-my-1 -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-sm text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg"
        >
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden className={cn("transition-transform duration-quick", expanded && "rotate-180")} />
        </button>
      </div>
      {expanded && (
        <dl className="grid gap-x-section gap-y-tight border-t border-hairline bg-subtle/40 px-card py-comfortable text-[0.8125rem] sm:grid-cols-2 md:pl-[calc(var(--spacing-card)+4.75rem+var(--spacing-comfortable)*2+2rem)]">
          {x.details(e).map((d, i) => (
            <div key={`${d.label}-${i}`} className="min-w-0">
              <dt className="text-[0.75rem] font-medium text-muted">{d.label}</dt>
              <dd className={cn("break-words text-fg", d.mono && "font-mono text-[0.75rem]")}>
                {d.href ? (
                  <Link href={d.href} className="underline decoration-line underline-offset-2 hover:decoration-fg">
                    {d.value}
                  </Link>
                ) : (
                  d.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}
