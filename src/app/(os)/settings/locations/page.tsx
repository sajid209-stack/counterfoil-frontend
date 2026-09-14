"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MapPin, Plus } from "lucide-react";
import { Button, EmptyState, PageShell, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { listCounters, listLocations, type Location } from "@/lib/api";
import { DEMO_TODAY } from "@/lib/schedule";
import { IconTile, RecordList, RecordRow, SearchField, SectionSkeleton } from "../_components/SettingsKit";
import { DAY_KEY, normalizeHours, openDays, spans, weekdayOf } from "./_lib/hours";

/** Past this many, a list is long enough to be worth searching. */
const SEARCH_FROM = 8;

/**
 * Locations.
 *
 * It was a sortable table whose columns were "Open days 2/7" and an Updated
 * date identical on every row, under a search box and pagination for three
 * venues. What a manager opens this list to learn is whether each place is
 * open today and what runs there, so each row says exactly that — and a venue
 * with no hours at all says so in warning, because nothing can be booked there.
 */
export default function LocationsPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  const countersQ = useApiQuery(() => listCounters({ pageSize: 500 }), []);

  const locations = locationsQ.data?.data ?? [];
  const counters = countersQ.data?.data ?? [];
  const today = weekdayOf(DEMO_TODAY);
  const q = search.trim().toLowerCase();
  const rows = locations.filter((l) => !q || `${l.name} ${l.city}`.toLowerCase().includes(q));

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
      {locationsQ.loading || countersQ.loading ? (
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
          <RecordList
            label={t("locations.title")}
            header={
              locations.length > SEARCH_FROM ? (
                <div className="border-b border-hairline px-section py-tight sm:px-major">
                  <SearchField value={search} onChange={setSearch} label={t("locations.searchLabel")} placeholder={t("locations.searchPlaceholder")} />
                </div>
              ) : undefined
            }
          >
            {rows.map((l) => {
              const line = todayLine(l);
              const here = counters.filter((c) => c.locationId === l.id).length;
              return (
                <RecordRow
                  key={l.id}
                  href={`/settings/locations/${l.id}`}
                  leading={<IconTile icon={MapPin} />}
                  title={l.name}
                  badges={l.status !== "active" ? <StatusPill status={l.status} /> : null}
                  meta={
                    <>
                      <span className="block">{[l.addressLine1, l.city].filter(Boolean).join(", ")}</span>
                      <span className={cn("block", line.warn ? "text-warning" : undefined)}>{line.text}</span>
                    </>
                  }
                  aside={t("locations.countersCount", { count: here })}
                />
              );
            })}
          </RecordList>
        </div>
      )}
    </PageShell>
  );
}
