/*
 * The Activity log as a workbook: who did what, when and where — every event the
 * filters match, newest first — with counts by action, person, type and day so a
 * manager can see the shape of a period before reading a single row.
 */
import type { ActivityEvent, ActivityGroup } from "@/lib/api";
import { localDay } from "@/lib/api";
import { formatDay } from "@/lib/format";
import type { Report, ReportColumn, ReportTable } from "@/lib/report";
import type { T } from "./context";

export interface ActivityReportInput {
  events: ActivityEvent[];
  /** The `activity` namespace. */
  t: T;
  kind: (e: ActivityEvent) => string;
  group: (g: ActivityGroup) => string;
  severity: (s: ActivityEvent["severity"]) => string;
  /** The event as one plain sentence. */
  sentence: (e: ActivityEvent) => string;
  labels: Report["labels"];
  meta: [string, string][];
  business: string;
  currency: string;
  fileBase: string;
}

const col = (header: string, type: ReportColumn["type"] = "text", total?: ReportColumn["total"]): ReportColumn => ({ header, type, ...(total ? { total } : {}) });

function count<K extends string>(events: ActivityEvent[], keyOf: (e: ActivityEvent) => K) {
  const by = new Map<K, number>();
  for (const e of events) by.set(keyOf(e), (by.get(keyOf(e)) ?? 0) + 1);
  return [...by.entries()].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}

export function buildActivityReport(i: ActivityReportInput): Report {
  const { events: ev, t } = i;
  const x = (k: string, v?: Record<string, string | number>) => t(`report.${k}`, v);
  const who = (e: ActivityEvent) => e.actor?.name ?? t("system");
  const total = ev.length;
  const share = (n: number) => (total > 0 ? n / total : 0);
  const flagged = ev.filter((e) => e.severity !== "info");
  const serious = ev.filter((e) => e.severity === "critical").length;

  const people = count(ev, who);
  const kinds = count(ev, (e) => i.kind(e));
  const groups = count(ev, (e) => e.group);
  const daily = count(ev, (e) => localDay(e.at)).sort((a, b) => a.key.localeCompare(b.key));
  const busiest = [...daily].sort((a, b) => b.n - a.n)[0];

  const countTable = (title: string, head: string, rows: { key: string; n: number }[], label: (k: string) => string, note?: string): ReportTable => ({
    title,
    note,
    columns: [col(head), col(x("col.events"), "int"), col(x("col.share"), "pct", "sum")],
    rows: rows.map((r) => [label(r.key), r.n, share(r.n)]),
    totalLabel: x("total"),
  });
  const flaggedByDay = new Map<string, number>();
  for (const e of flagged) flaggedByDay.set(localDay(e.at), (flaggedByDay.get(localDay(e.at)) ?? 0) + 1);

  const summary: ReportTable[] = [
    countTable(x("table.byAction"), x("col.action"), kinds, (k) => k, x("note.byAction")),
    countTable(x("table.byPerson"), x("col.person"), people, (k) => k, x("note.byPerson")),
    countTable(x("table.byType"), x("col.type"), groups, (k) => i.group(k as ActivityGroup)),
    {
      title: x("table.byDay"),
      note: x("note.byDay"),
      columns: [col(x("col.date"), "date"), col(x("col.events"), "int"), col(x("col.needsLook"), "int")],
      rows: daily.map((d) => [d.key, d.n, flaggedByDay.get(d.key) ?? 0]),
      totalLabel: x("total"),
    },
  ].filter((tb) => tb.rows.length > 0);

  const data: ReportTable = {
    title: x("sheet.log"),
    columns: [
      col(x("col.when"), "datetime"),
      col(x("col.person")),
      col(x("col.action")),
      col(x("col.subject")),
      col(x("col.details")),
      col(x("col.counter")),
      col(x("col.device")),
      col(x("col.venue")),
      col(x("col.type")),
      col(x("col.importance")),
    ],
    rows: ev.map((e) => [e.at, who(e), i.kind(e), e.kind === "settings.changed" ? "" : (e.subject?.label ?? ""), i.sentence(e), e.counter ?? "", e.device ?? "", e.venue ?? "", i.group(e.group), i.severity(e.severity)]),
    totalLabel: x("total"),
  };
  data.columns[0].total = "none";

  const top = people[0];
  const gl = (key: string): [string, string] => [x(`term.${key}`), x(`def.${key}`)];
  return {
    title: x("title"),
    business: i.business,
    fileBase: i.fileBase,
    currency: i.currency,
    meta: i.meta,
    kpis: [
      { label: x("kpi.events"), value: total, type: "int", note: x("kpi.eventsNote", { days: daily.length }) },
      { label: x("kpi.needsLook"), value: flagged.length, type: "int", note: x("kpi.needsLookNote", { serious }) },
      { label: x("kpi.people"), value: people.filter((p) => p.key !== t("system")).length, type: "int", note: top ? x("kpi.peopleNote", { name: top.key, n: top.n }) : undefined },
      { label: x("kpi.busiest"), value: busiest ? formatDay(busiest.key, { weekday: true }) : "—", type: "text", note: busiest ? x("kpi.busiestNote", { n: busiest.n }) : undefined },
    ],
    summary,
    sheets: [{ name: x("sheet.log"), table: data }],
    glossary: [gl("event"), gl("action"), gl("person"), gl("type"), gl("importance"), gl("needsLook"), [t("system"), x("def.system")] as [string, string]],
    labels: i.labels,
  };
}
