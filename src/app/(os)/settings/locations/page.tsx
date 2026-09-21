"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MapPin, Plus } from "lucide-react";
import { Button, ConfirmDialog, EmptyState, PageShell, StatusPill, Tabs, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { listCounters, listLocations, updateLocation, type Location } from "@/lib/api";
import { DEMO_TODAY } from "@/lib/schedule";
import { IconTile, RecordList, RecordRow, SearchField, SectionSkeleton, Switch } from "../_components/SettingsKit";
import { DAY_KEY, normalizeHours, openDays, spans, weekdayOf } from "./_lib/hours";

/** Past this many, a list is long enough to be worth searching. */
const SEARCH_FROM = 8;

type Tab = "all" | "selling" | "off";
const TABS: Tab[] = ["all", "selling", "off"];

/**
 * Locations.
 *
 * It was a sortable table whose columns were "Open days 2/7" and an Updated
 * date identical on every row, under a search box and pagination for three
 * venues. What a manager opens this list to learn is whether each place is
 * open today and what runs there, so each row says exactly that — and a venue
 * with no hours at all says so in warning, because nothing can be booked there.
 *
 * Each row carries its own selling switch, as counters do. Stopping asks first,
 * because it closes every counter at the venue at once and a customer at the
 * gate is the one who finds out; starting again does not, because nothing
 * starting can go wrong for anyone. Both offer Undo.
 */
export default function LocationsPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  // The location as last written from this list, so the switch moves under the
  // finger rather than after a reload.
  const [latest, setLatest] = useState<Record<string, Location>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [stopping, setStopping] = useState<Location | null>(null);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  const countersQ = useApiQuery(() => listCounters({ pageSize: 500 }), []);

  const locations = (locationsQ.data?.data ?? []).map((l) => latest[l.id] ?? l).filter((l) => l.status !== "archived");
  const counters = countersQ.data?.data ?? [];
  const today = weekdayOf(DEMO_TODAY);
  const q = search.trim().toLowerCase();
  const counts: Record<Tab, number> = {
    all: locations.length,
    selling: locations.filter((l) => l.status === "active").length,
    off: locations.filter((l) => l.status === "inactive").length,
  };
  const inTab = (l: Location) => tab === "all" || (tab === "selling" ? l.status === "active" : l.status === "inactive");
  const rows = locations.filter((l) => inTab(l) && (!q || `${l.name} ${l.city}`.toLowerCase().includes(q)));

  const todayLine = (l: Location): { text: string; warn: boolean } => {
    const hours = normalizeHours(l.openingHours);
    if (openDays(hours) === 0) return { text: t("locations.noHours"), warn: true };
    if (hours[today].intervals.length > 0) return { text: t("locations.openToday", { hours: spans(hours[today].intervals) }), warn: false };
    for (let k = 1; k <= 7; k++) {
      const d = (today + k) % 7;
      if (hours[d].intervals.length > 0) {
        return {
          text: t("locations.closedTodayNext", { day: t(`common.${DAY_KEY[d]}`), time: hours[d].intervals[0].opensAt }),
          warn: false,
        };
      }
    }
    return { text: t("locations.noHours"), warn: true };
  };

  const setSelling = async (l: Location, selling: boolean, undoable = true) => {
    setBusy(l.id);
    const res = await updateLocation(l.id, { status: selling ? "active" : "inactive" });
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setLatest((m) => ({ ...m, [l.id]: res.data }));
    if (!undoable) return;
    toast.success(selling ? t("locations.started", { name: l.name }) : t("locations.stopped", { name: l.name }), {
      label: t("common.undo"),
      run: () => setSelling(res.data, !selling, false),
    });
  };

  return (
    <PageShell
      title={t("locations.title")}
      description={t("locations.description")}
      actions={
        <Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/settings/locations/new")}>
          {t("locations.add")}
        </Button>
      }
    >
      {!locationsQ.data || !countersQ.data ? (
        <SectionSkeleton />
      ) : locations.length === 0 ? (
        <div className="max-w-3xl">
          <EmptyState
            title={t("locations.emptyTitle")}
            message={t("locations.emptyMessage")}
            action={<Button onClick={() => router.push("/settings/locations/new")}>{t("locations.add")}</Button>}
          />
        </div>
      ) : (
        <div className="flex max-w-4xl flex-col gap-section pb-hero">
          <Tabs
            items={TABS.map((v) => ({ value: v, label: t(`locations.tab.${v}`), count: counts[v] }))}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
          {rows.length === 0 && !q ? (
            <p className="py-section text-sm text-muted">{t("locations.emptyTab")}</p>
          ) : (
            <RecordList
              label={t("locations.title")}
              header={
                locations.length > SEARCH_FROM ? (
                  <div className="border-b border-hairline px-card py-tight">
                    <SearchField value={search} onChange={setSearch} label={t("locations.searchLabel")} placeholder={t("locations.searchPlaceholder")} />
                  </div>
                ) : undefined
              }
            >
              {rows.map((l) => {
                const line = todayLine(l);
                const here = counters.filter((c) => c.locationId === l.id).length;
                const selling = l.status === "active";
                return (
                  <RecordRow
                    key={l.id}
                    href={`/settings/locations/${l.id}`}
                    leading={<IconTile icon={MapPin} />}
                    title={l.name}
                    badges={selling ? null : <StatusPill tone="neutral">{t("locations.offTag")}</StatusPill>}
                    meta={
                      <>
                        <span className="block">{[l.addressLine1, l.city].filter(Boolean).join(", ")}</span>
                        <span className={cn("block", line.warn ? "text-warning" : undefined)}>{line.text}</span>
                      </>
                    }
                    aside={t("locations.countersCount", { count: here })}
                    control={
                      <Switch
                        checked={selling}
                        disabled={busy === l.id}
                        onChange={(on) => (on ? setSelling(l, true) : setStopping(l))}
                        label={t("locations.sellingSwitch", { name: l.name })}
                      />
                    }
                  />
                );
              })}
            </RecordList>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!stopping}
        onClose={() => setStopping(null)}
        onConfirm={() => {
          const l = stopping;
          setStopping(null);
          if (l) void setSelling(l, false);
        }}
        title={stopping ? t("locations.stopTitle", { name: stopping.name }) : ""}
        message={t("locations.stopBody")}
        confirmLabel={t("locations.stop")}
      />
    </PageShell>
  );
}
