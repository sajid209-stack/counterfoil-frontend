"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MonitorSmartphone, Plus } from "lucide-react";
import { Button, ConfirmDialog, EmptyState, PageShell, StatusPill, Tabs, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { listCounters, listDevices, listLocations, updateDevice, type Device } from "@/lib/api";
import { isDeviceQuiet } from "@/lib/devices";
import { DEMO_TODAY } from "@/lib/schedule";
import { IconTile, RecordList, RecordRow, SectionSkeleton, Switch } from "../_components/SettingsKit";
import { useSince } from "../_lib/time";

type Tab = "all" | "on" | "off" | "attention";
const TABS: Tab[] = ["all", "on", "off", "attention"];

/**
 * Devices.
 *
 * The table printed every tablet's pairing code in a column. A pairing code is
 * a key — it is meant to be shown once, when the tablet is registered — and a
 * list of them is a list of keys anyone at the screen can read. It is gone from
 * here. What a manager needs from this list is which till each tablet opens,
 * and whether it is still checking in; a tablet quiet for a week, never
 * connected, or opening no counter is said in warning, and gathered under
 * "Needs attention" so it can be found without reading every row.
 *
 * Each row carries its on/off switch. Turning a tablet on is immediate.
 * Turning one off asks first, unlike the other lists: it signs out whoever is
 * using it mid-sale, and an Undo cannot sign them back in.
 */
export default function DevicesPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const toast = useToast();
  const since = useSince();
  const [tab, setTab] = useState<Tab>("all");
  const [latest, setLatest] = useState<Record<string, Device>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmOff, setConfirmOff] = useState<Device | null>(null);

  const devicesQ = useApiQuery(() => listDevices({ pageSize: 500 }), []);
  const countersQ = useApiQuery(() => listCounters({ pageSize: 500 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);

  const devices = [...(devicesQ.data?.data ?? [])]
    .map((d) => latest[d.id] ?? d)
    .filter((d) => d.status !== "archived")
    .sort((a, b) => a.name.localeCompare(b.name));
  const counters = countersQ.data?.data ?? [];
  const locations = locationsQ.data?.data ?? [];
  const loading = !devicesQ.data || !countersQ.data || !locationsQ.data;

  const needsAttention = (d: Device) =>
    d.status === "active" && (!d.counterId || !d.lastSeenAt || isDeviceQuiet(d, DEMO_TODAY));
  const counts: Record<Tab, number> = {
    all: devices.length,
    on: devices.filter((d) => d.status === "active").length,
    off: devices.filter((d) => d.status === "inactive").length,
    attention: devices.filter(needsAttention).length,
  };
  const inTab = (d: Device) =>
    tab === "all" ? true : tab === "on" ? d.status === "active" : tab === "off" ? d.status === "inactive" : needsAttention(d);

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

  const setOn = async (d: Device, on: boolean) => {
    setBusy(d.id);
    const res = await updateDevice(d.id, { status: on ? "active" : "inactive" });
    setBusy(null);
    setConfirmOff(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setLatest((m) => ({ ...m, [d.id]: res.data }));
    toast.success(on ? t("devices.turnedOn", { name: d.name }) : t("devices.turnedOff", { name: d.name }));
  };

  const visible = devices.filter(inTab);

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
      {loading ? (
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
          <Tabs
            items={TABS.map((v) => ({ value: v, label: t(`devices.tab.${v}`), count: counts[v] }))}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
          {visible.length === 0 ? (
            <p className="py-section text-sm text-muted">{t("devices.emptyTab")}</p>
          ) : (
            <RecordList label={t("devices.title")}>
              {visible.map((d) => {
                const place = where(d);
                const last = seen(d);
                const on = d.status === "active";
                return (
                  <RecordRow
                    key={d.id}
                    href={`/settings/devices/${d.id}`}
                    leading={<IconTile icon={MonitorSmartphone} />}
                    title={d.name}
                    badges={on ? null : <StatusPill tone="neutral">{t("devices.offTag")}</StatusPill>}
                    meta={
                      <>
                        <span className={cn("block", place.warn ? "text-warning" : undefined)}>{place.text}</span>
                        <span className={cn("block", last.warn ? "text-warning" : undefined)}>{last.text}</span>
                      </>
                    }
                    control={
                      <Switch
                        checked={on}
                        disabled={busy === d.id}
                        onChange={(next) => (next ? setOn(d, true) : setConfirmOff(d))}
                        label={t("devices.powerSwitch", { name: d.name })}
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
        open={confirmOff !== null}
        onClose={() => setConfirmOff(null)}
        onConfirm={() => {
          if (confirmOff) setOn(confirmOff, false);
        }}
        title={confirmOff ? t("devices.turnOffTitle", { name: confirmOff.name }) : ""}
        message={t("devices.turnOffBody")}
        confirmLabel={t("devices.turnOff")}
        loading={busy !== null}
      />
    </PageShell>
  );
}
