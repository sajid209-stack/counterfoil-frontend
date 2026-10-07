"use client";

import { useTranslations } from "next-intl";
import { NO_ONE, orderChannelOf, type Order, type OrderChannel } from "@/lib/api";
import { formatRange } from "@/components/ui";
import { useEnumLabels } from "@/lib/labels";
import { PRESETS, presetOf, type SalesFilters } from "./filters";
import type { Directory } from "./useReport";

/**
 * The words for every value a sales report can be cut by, in one place — the
 * filter chips, the table, the Summary, the CSV and the printout all say
 * "Cash", "Counter" and "Part paid" the same way because they all ask here.
 */
export function useSalesLabels(dir: Directory) {
  const t = useTranslations("orders");
  const enumL = useEnumLabels();

  const channel = (c: OrderChannel): string => t(`channel.${c}`);
  const method = (m: string): string => (m === "split" ? t("method.split") : m === "none" ? t("method.none") : enumL.method(m));
  const status = (s: string): string => enumL.status(s);
  const counter = (id: string | null): string => (!id || id === NO_ONE ? t("noCounter") : dir.counterName(id));
  const staff = (id: string | null): string => (!id || id === NO_ONE ? t("noStaff") : dir.staffName(id));
  /** Where a sale was made, as one answer: "Counter · Museum Group Desk" for a counter sale that
   *  recorded its counter, plain "Counter" where it did not, and the channel as it is for online
   *  and marketplace sales. The Counter column is optional on a laptop; this is not. */
  const soldAt = (o: Order): string => {
    const c = orderChannelOf(o);
    const name = c === "counter" && o.counterId ? dir.counterName(o.counterId) : "";
    return name ? `${channel(c)} · ${name}` : channel(c);
  };
  const range = (from: string, to: string): string => (from && to ? formatRange(from, to) : t("range.any"));
  /** A named range by its own words — "Last 7 days" — or null for a drawn one. */
  const preset = (from: string, to: string): string | null => {
    const p = presetOf(from, to);
    return PRESETS.some((x) => x.value === p) ? t(`range.${p}` as "range.today") : null;
  };

  /** What the filters say, as a line: "Lalbagh Fort · 29 Jul 2026 · Fort Main Gate · Cash". */
  const describe = (f: SalesFilters, venueName: string): string[] => {
    const parts: string[] = [];
    if (f.customerId) parts.push(f.customer ? t("describe.customer", { name: f.customer }) : t("describe.customerAnon"));
    else if (venueName) parts.push(venueName);
    parts.push(f.from && f.to ? range(f.from, f.to) : t("describe.allDates"));
    if (f.counters.length) parts.push(f.counters.map(counter).join(", "));
    if (f.staff.length) parts.push(t("describe.staff", { names: f.staff.map(staff).join(", ") }));
    if (f.channels.length) parts.push(f.channels.map(channel).join(", "));
    if (f.methods.length) parts.push(f.methods.map(method).join(", "));
    if (f.statuses.length) parts.push(f.statuses.map(status).join(", "));
    if (f.q.trim()) parts.push(t("describe.search", { q: f.q.trim() }));
    return parts;
  };

  return { channel, soldAt, method, status, counter, staff, range, preset, describe };
}
export type SalesLabels = ReturnType<typeof useSalesLabels>;
