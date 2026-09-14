"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, ConfirmDialog, EmptyState, PageShell, StatusPill, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { archiveDevice, getDevice, listCounters, listLocations, updateDevice, type Device } from "@/lib/api";
import { SaveBar, SectionSkeleton, SettingRow, SettingsSection, controlCls } from "../../_components/SettingsKit";
import { useSince } from "../../_lib/time";
import { CounterSelect } from "../_components/CounterSelect";

interface Draft {
  name: string;
  counterId: string;
}

const fromDevice = (d: Device): Draft => ({ name: d.name, counterId: d.counterId ?? "" });

/**
 * One tablet.
 *
 * There was no page for a device at all — the list rows did not open — so
 * moving a tablet to another counter, or turning off one that had gone
 * missing, could not be done anywhere. Turning off and removing are immediate
 * and confirmed; the name and the counter wait for Save.
 */
export default function DevicePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("settings");
  const toast = useToast();
  const since = useSince();
  const deviceQ = useApiQuery(() => getDevice(params.id), [params.id]);
  const countersQ = useApiQuery(() => listCounters({ pageSize: 500 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  const [latest, setLatest] = useState<Device | null>(null);
  const [base, setBase] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<null | "off" | "remove">(null);
  const [busy, setBusy] = useState(false);

  const device = latest?.id === params.id ? latest : deviceQ.data;
  const initial = useMemo(() => (device ? fromDevice(device) : null), [device]);

  if (!deviceQ.loading && (deviceQ.error || !deviceQ.data)) {
    return (
      <PageShell title={t("devices.fallbackTitle")}>
        <EmptyState
          title={t("devices.notFoundTitle")}
          action={<Button onClick={() => router.push("/settings/devices")}>{t("devices.backButton")}</Button>}
        />
      </PageShell>
    );
  }
  if (!device || !initial || countersQ.loading || locationsQ.loading) {
    return (
      <PageShell title={t("devices.fallbackTitle")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  const saved = base ?? initial;
  const form = draft ?? saved;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);
  const nameErr = !form.name.trim() ? t("devices.nameRequired") : undefined;
  const counters = countersQ.data?.data ?? [];
  const locations = locationsQ.data?.data ?? [];
  const counter = counters.find((c) => c.id === device.counterId);
  const place = locations.find((l) => l.id === counter?.locationId);
  const seen = device.lastSeenAt ? t("devices.seen", { when: since(device.lastSeenAt) }) : t("devices.neverSeen");

  const save = async () => {
    setSaving(true);
    const res = await updateDevice(device.id, { name: form.name.trim(), counterId: form.counterId || null });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setLatest(res.data);
    setBase(fromDevice(res.data));
    setDraft(null);
    toast.success(t("common.changesSaved"));
  };

  const setStatus = async (status: "active" | "inactive") => {
    setBusy(true);
    const res = await updateDevice(device.id, { status });
    setBusy(false);
    setConfirm(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setLatest(res.data);
    toast.success(status === "inactive" ? t("devices.turnedOff", { name: device.name }) : t("devices.turnedOn", { name: device.name }));
  };

  const remove = async () => {
    setBusy(true);
    const res = await archiveDevice(device.id);
    setBusy(false);
    setConfirm(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("devices.removed", { name: device.name }));
    router.push("/settings/devices");
  };

  return (
    <PageShell
      title={device.name}
      description={counter ? [counter.name, place?.name].filter(Boolean).join(" · ") : t("devices.notPaired")}
      actions={device.status !== "active" ? <StatusPill status={device.status} /> : undefined}
    >
      <div className="flex max-w-3xl flex-col gap-section pb-hero">
        <SettingsSection title={t("devices.detailsTitle")} description={t("devices.detailsDesc")}>
          <SettingRow label={t("devices.deviceName")} error={nameErr}>
            {({ id, describedBy }) => (
              <input
                id={id}
                value={form.name}
                onChange={(e) => setDraft({ ...form, name: e.target.value })}
                autoComplete="off"
                aria-invalid={!!nameErr || undefined}
                aria-describedby={describedBy}
                className={controlCls(!!nameErr)}
              />
            )}
          </SettingRow>
          <SettingRow label={t("devices.counterLabel")} description={t("devices.counterDesc")}>
            {({ id, describedBy }) => (
              <CounterSelect
                id={id}
                describedBy={describedBy}
                value={form.counterId}
                onChange={(counterId) => setDraft({ ...form, counterId })}
                counters={counters}
                locations={locations}
              />
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={t("devices.connectionTitle")} description={t("devices.connectionDesc")}>
          <SettingRow
            label={t("devices.statusLabel")}
            description={device.status === "active" ? t("devices.activeDesc", { seen }) : t("devices.inactiveDesc")}
            labelFor={false}
          >
            {() => (
              <div className="flex sm:justify-end">
                {device.status === "active" ? (
                  <Button variant="secondary" onClick={() => setConfirm("off")}>
                    {t("devices.turnOff")}
                  </Button>
                ) : (
                  <Button onClick={() => setStatus("active")} loading={busy}>
                    {t("devices.turnOn")}
                  </Button>
                )}
              </div>
            )}
          </SettingRow>
          <SettingRow label={t("devices.replaceLabel")} description={t("devices.replaceDesc")} labelFor={false}>
            {() => (
              <div className="flex sm:justify-end">
                <Button variant="secondary" onClick={() => router.push("/settings/devices/new")}>
                  {t("devices.register")}
                </Button>
              </div>
            )}
          </SettingRow>
          <SettingRow label={t("devices.removeLabel")} description={t("devices.removeDesc")} labelFor={false}>
            {() => (
              <div className="flex sm:justify-end">
                <Button variant="secondary" onClick={() => setConfirm("remove")}>
                  {t("devices.remove")}
                </Button>
              </div>
            )}
          </SettingRow>
        </SettingsSection>

        <SaveBar dirty={dirty} saving={saving} invalid={!!nameErr} onSave={save} onDiscard={() => setDraft(null)} />
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => (confirm === "remove" ? remove() : setStatus("inactive"))}
        title={confirm === "remove" ? t("devices.removeTitle", { name: device.name }) : t("devices.turnOffTitle", { name: device.name })}
        message={confirm === "remove" ? t("devices.removeBody") : t("devices.turnOffBody")}
        confirmLabel={confirm === "remove" ? t("devices.remove") : t("devices.turnOff")}
        loading={busy}
      />
    </PageShell>
  );
}
