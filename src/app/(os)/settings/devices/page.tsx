"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MonitorSmartphone, Plus } from "lucide-react";
import { Button, EmptyState, PageShell, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { listCounters, listDevices, listLocations, type Device } from "@/lib/api";
import { isDeviceQuiet } from "@/lib/devices";
import { DEMO_TODAY } from "@/lib/schedule";
import { IconTile, RecordList, RecordRow, SectionSkeleton } from "../_components/SettingsKit";
import { useSince } from "../_lib/time";

/**
 * Devices.
 *
 * The table printed every tablet's pairing code in a column. A pairing code is
 * a key — it is meant to be shown once, when the tablet is registered — and a
 * list of them is a list of keys anyone at the screen can read. It is gone from
 * here. What a manager needs from this list is which till each tablet opens,
 * and whether it is still checking in; a tablet quiet for a week, or never
 * connected, is said in warning, by the same rule the dashboard uses.
 */
export default function DevicesPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const since = useSince();
  const devicesQ = useApiQuery(() => listDevices({ pageSize: 500 }), []);
  const countersQ = useApiQuery(() => listCounters({ pageSize: 500 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);

  const devices = [...(devicesQ.data?.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const counters = countersQ.data?.data ?? [];
  const locations = locationsQ.data?.data ?? [];

  const where = (d: Device): { text: string; warn: boolean } => {
    const counter = counters.find((c) => c.id === d.counterId);
    if (!counter) return { text: t("devices.notPaired"), warn: true };
    const place = locations.find((l) => l.id === counter.locationId);
    return { text: place ? `${counter.name} · ${place.name}` : counter.name, warn: false };
  };
  const seen = (d: Device): { text: string; warn: boolean } => {
    if (!d.lastSeenAt) return { text: t("devices.neverSeen"), warn: d.status === "active" };
    const quiet = d.status === "active" && isDeviceQuiet(d, DEMO_TODAY);
    return { text: quiet ? t("devices.quiet") : t("devices.seen", { when: since(d.lastSeenAt) }), warn: quiet };
  };

  return (
    <PageShell
      title={t("devices.title")}
      description={t("devices.description")}
      actions={
        <Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/settings/devices/new")}>
          {t("devices.register")}
        </Button>
      }
    >
      {devicesQ.loading || countersQ.loading || locationsQ.loading ? (
        <SectionSkeleton />
      ) : devices.length === 0 ? (
        <div className="max-w-3xl">
          <EmptyState
            title={t("devices.emptyTitle")}
            message={t("devices.emptyMessage")}
            action={<Button onClick={() => router.push("/settings/devices/new")}>{t("devices.register")}</Button>}
          />
        </div>
      ) : (
        <div className="flex max-w-4xl flex-col gap-section pb-hero">
          <RecordList label={t("devices.title")}>
            {devices.map((d) => {
              const place = where(d);
              const last = seen(d);
              return (
                <RecordRow
                  key={d.id}
                  href={`/settings/devices/${d.id}`}
                  leading={<IconTile icon={MonitorSmartphone} />}
                  title={d.name}
                  badges={d.status !== "active" ? <StatusPill status={d.status} /> : null}
                  meta={<span className={cn("block", place.warn ? "text-warning" : undefined)}>{place.text}</span>}
                  aside={<span className={last.warn ? "text-warning" : undefined}>{last.text}</span>}
                />
              );
            })}
          </RecordList>
        </div>
      )}
    </PageShell>
  );
}
