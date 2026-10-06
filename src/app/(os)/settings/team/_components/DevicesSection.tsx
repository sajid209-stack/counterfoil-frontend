"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MonitorSmartphone, Plus } from "lucide-react";
import { Button, Modal, Select, useToast } from "@/components/ui";
import {
  assignDeviceToStaff,
  devicesForStaff,
  removeStaffFromDevice,
  updateDevice,
  type Counter,
  type Device,
  type Location,
  type Staff,
} from "@/lib/api";
import { IconTile, SettingsSection } from "../../_components/SettingsKit";

/**
 * The tablets a person can sign in on — the other half of "Who can use it".
 *
 * A device page answers "who is on this tablet"; this answers "which tablets is
 * this person on". Three kinds appear: ones they own, ones they were assigned,
 * and ones open to everyone at the venue (which need nothing from anybody, so
 * they say so rather than offering a button that would change nothing).
 *
 * Assign and Remove act at once and offer Undo, the way every other switch in
 * the settings lists does. Undo writes the device back exactly as it was.
 */
export function DevicesSection({
  member,
  devices,
  counters,
  locations,
  onChanged,
}: {
  member: Staff;
  devices: Device[];
  counters: Counter[];
  locations: Location[];
  onChanged: () => void;
}) {
  const t = useTranslations("settings");
  const toast = useToast();
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  const mine = useMemo(() => devicesForStaff(devices, member), [devices, member]);
  const placeOf = (d: Device) => {
    const counter = counters.find((c) => c.id === d.counterId);
    const venue = locations.find((l) => l.id === counter?.locationId);
    return { counter, venue, text: counter ? [counter.name, venue?.name].filter(Boolean).join(" · ") : t("devices.notPaired") };
  };

  /** Devices they could be added to: not already theirs, not someone else's own. */
  const candidates = useMemo(() => {
    const have = new Set([...mine.owned, ...mine.assigned, ...mine.open].map((d) => d.id));
    return devices
      .filter((d) => d.status !== "archived" && !have.has(d.id) && !(d.ownerStaffId && d.ownerStaffId !== member.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [devices, mine, member.id]);

  const undoTo = (prev: Device) => async () => {
    const res = await updateDevice(prev.id, {
      access: prev.access ?? "venue",
      staffIds: prev.staffIds ?? [],
      ownerStaffId: prev.ownerStaffId ?? null,
    });
    if (res.ok) {
      toast.success(t("team.devicesUndone"));
      onChanged();
    } else toast.error(res.error.message);
  };

  const assign = async () => {
    const prev = devices.find((d) => d.id === pick);
    if (!prev) return;
    setBusy(true);
    const res = await assignDeviceToStaff(prev.id, member.id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setPicking(false);
    setPick("");
    const wasOpen = (prev.access ?? "venue") === "venue";
    toast.success(
      wasOpen
        ? t("team.assignedLimitedToast", { name: member.name, device: prev.name, count: res.data.staffIds?.length ?? 0 })
        : t("team.assignedToast", { name: member.name, device: prev.name }),
      { label: t("common.undo"), run: undoTo(prev) },
    );
    onChanged();
  };

  const remove = async (d: Device) => {
    const res = await removeStaffFromDevice(d.id, member.id);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("team.removedToast", { name: member.name, device: d.name }), { label: t("common.undo"), run: undoTo(d) });
    onChanged();
  };

  const rows: { d: Device; kind: "own" | "assigned" | "open" }[] = [
    ...mine.owned.map((d) => ({ d, kind: "own" as const })),
    ...mine.assigned.map((d) => ({ d, kind: "assigned" as const })),
    ...mine.open.map((d) => ({ d, kind: "open" as const })),
  ];
  const anyOpen = mine.open.length > 0;

  return (
    <>
      <SettingsSection
        title={t("team.devicesTitle")}
        description={t("team.devicesDesc", { name: member.name.split(" ")[0] })}
        aside={
          <Button variant="secondary" icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => setPicking(true)}>
            {t("team.assignDevice")}
          </Button>
        }
      >
        {rows.length === 0 ? (
          <p className="px-card py-section text-sm text-muted">{t("team.devicesNone", { name: member.name.split(" ")[0] })}</p>
        ) : (
          <ul aria-label={t("team.devicesTitle")} className="divide-y divide-hairline">
            {rows.map(({ d, kind }) => {
              const place = placeOf(d);
              return (
                <li key={d.id} className="flex min-h-16 items-center gap-section px-card py-tight">
                  <IconTile icon={MonitorSmartphone} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/settings/devices/${d.id}`}
                      className="inline-flex min-h-11 items-center text-sm font-medium text-fg underline-offset-4 hover:underline md:min-h-0"
                    >
                      {d.name}
                    </Link>
                    <p className="text-[13px] text-muted">{place.text}</p>
                    <p className="text-[13px] text-muted" data-kind={kind}>
                      {kind === "own"
                        ? t("team.kindOwn")
                        : kind === "assigned"
                          ? t("team.kindAssigned")
                          : t("team.kindOpen", { place: place.venue?.name ?? place.counter?.name ?? "—" })}
                    </p>
                  </div>
                  {kind === "assigned" && (
                    <Button variant="secondary" onClick={() => remove(d)} aria-label={t("team.removeAria", { name: member.name, device: d.name })}>
                      {t("team.removeDevice")}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {anyOpen && <p className="px-card py-section text-[13px] leading-relaxed text-muted">{t("team.devicesOpenHint")}</p>}
      </SettingsSection>

      <Modal
        open={picking}
        onClose={() => {
          setPicking(false);
          setPick("");
        }}
        title={t("team.assignTitle", { name: member.name })}
        description={t("team.assignDesc", { name: member.name.split(" ")[0] })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPicking(false)} disabled={busy}>
              {t("save.cancel")}
            </Button>
            <Button onClick={assign} loading={busy} disabled={!pick}>
              {t("team.assignConfirm")}
            </Button>
          </>
        }
      >
        {candidates.length === 0 ? (
          <p className="text-sm text-muted">{t("team.assignNone")}</p>
        ) : (
          <div>
            <p id="assign-device-label" className="mb-tight text-sm font-medium text-fg">
              {t("team.assignPick")}
            </p>
            <Select
              value={pick}
              onChange={setPick}
              aria-labelledby="assign-device-label"
              options={[
                { value: "", label: "—" },
                ...candidates.map((d) => ({ value: d.id, label: d.name, note: placeOf(d).text })),
              ]}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
