"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, ConfirmDialog, EmptyState, PageShell, StatusPill, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  archiveDevice,
  deviceAccess,
  getDevice,
  isPaired,
  listCounters,
  listLocations,
  listRoles,
  listStaff,
  newPairingCode,
  updateDevice,
  type Device,
} from "@/lib/api";
import { isDeviceQuiet } from "@/lib/devices";
import { DEMO_TODAY } from "@/lib/schedule";
import { formatDate, formatDateTime } from "@/lib/format";
import { RecordFacts, SaveBar, SectionSkeleton, SettingRow, SettingsSection, controlCls } from "../../_components/SettingsKit";
import { useSince } from "../../_lib/time";
import { CounterSelect } from "../_components/CounterSelect";
import { accessProblem, DeviceAccess, SignInSummary } from "../_components/DeviceAccess";
import { PairingPanel } from "../_components/PairingPanel";
import { ReadinessLines } from "../_components/Readiness";
import { resolveWho, firstName } from "../_components/WhoStack";

interface Draft {
  name: string;
  counterId: string;
  /** Who can sign in on it: everyone at the counter, or only these people. */
  access: "venue" | "assigned";
  staffIds: string[];
  /** "" when it is a shared tablet. */
  ownerStaffId: string;
}

const fromDevice = (d: Device): Draft => ({
  name: d.name,
  counterId: d.counterId ?? "",
  access: deviceAccess(d),
  staffIds: d.staffIds ?? [],
  ownerStaffId: d.ownerStaffId ?? "",
});

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
  const staffQ = useApiQuery(() => listStaff({ pageSize: 500 }), []);
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const [latest, setLatest] = useState<Device | null>(null);
  const [base, setBase] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<null | "off" | "remove" | "repair">(null);
  /** Keeps the pairing panel on screen once it has been shown, so "Paired ✓" is seen. */
  const [panelKept, setPanelKept] = useState(false);
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
  if (!device || !initial || countersQ.loading || locationsQ.loading || !staffQ.data || !rolesQ.data) {
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
  const staff = staffQ.data?.data ?? [];
  const roles = rolesQ.data?.data ?? [];
  const problem = accessProblem(form, staff);
  const accessErr = problem ? (problem.key === "pickErr" ? t("devices.pickErr") : t("devices.pickBlocked", { name: problem.name })) : undefined;
  // The counter the DRAFT points at, so the words under "Everyone who works at…"
  // follow a change of counter before it is saved.
  const draftCounter = counters.find((c) => c.id === form.counterId);
  const draftPlace = locations.find((l) => l.id === draftCounter?.locationId)?.name ?? "";
  // And who it is open to as SAVED, for the facts above the form.
  const who = resolveWho(device, staff, counters, locations);
  const counter = counters.find((c) => c.id === device.counterId);
  const place = locations.find((l) => l.id === counter?.locationId);
  /* A tablet that has not checked in for a week is the one fact on this page
     somebody has to act on, so it is the one fact that carries a tone. The
     dashboard's notice uses the same rule, from the same function. */
  const quiet = isDeviceQuiet(device, DEMO_TODAY);
  const facts = [
    {
      key: "status",
      label: t("devices.factStatus"),
      value: device.status === "active" ? t("devices.factOn") : t("devices.factOff"),
      tone: device.status === "active" ? undefined : ("warn" as const),
    },
    ...(device.status === "active"
      ? [{ key: "ready", label: t("devices.factReady"), value: <ReadinessLines device={device} staff={staff} /> }]
      : []),
    {
      key: "paired",
      label: t("devices.factPaired"),
      value: !isPaired(device)
        ? t("devices.waitingToPair")
        : device.pairedAt
          ? formatDateTime(device.pairedAt)
          : "—",
      tone: !isPaired(device) && device.status === "active" ? ("warn" as const) : undefined,
    },
    {
      key: "seen",
      label: t("devices.factSeen"),
      // The exact moment as well as the relative one: "3 hours ago" is what
      // you read, and the timestamp is what you quote.
      value: device.lastSeenAt
        ? since(device.lastSeenAt) === formatDateTime(device.lastSeenAt)
          ? formatDateTime(device.lastSeenAt)
          : `${since(device.lastSeenAt)} · ${formatDateTime(device.lastSeenAt)}`
        : t("devices.neverSeen"),
      tone: quiet ? ("warn" as const) : undefined,
    },
    {
      key: "counter",
      label: t("devices.factCounter"),
      value: counter ? counter.name : t("devices.notPaired"),
      tone: counter ? undefined : ("warn" as const),
    },
    { key: "place", label: t("devices.factPlace"), value: place ? place.name : "—" },
    {
      key: "who",
      label: t("devices.accessTitle"),
      value:
        who.kind === "own"
          ? t("devices.whoOwn", { name: who.people[0] ? firstName(who.people[0]) : "—" })
          : who.kind === "nobody"
            ? t("devices.whoNobody")
            : who.kind === "everyone"
              ? counter
                ? t("devices.whoEveryone", { place: who.place })
                : t("devices.accessVenueNoCounter")
              : who.people.map(firstName).join(", "),
      tone: who.kind === "nobody" ? ("warn" as const) : undefined,
    },
    { key: "added", label: t("devices.factAdded"), value: formatDate(device.createdAt.slice(0, 10)) },
  ];

  const save = async () => {
    setSaving(true);
    const res = await updateDevice(device.id, {
      name: form.name.trim(),
      counterId: form.counterId || null,
      access: form.ownerStaffId ? "assigned" : form.access,
      staffIds: form.ownerStaffId ? [form.ownerStaffId] : form.access === "assigned" ? form.staffIds : [],
      ownerStaffId: form.ownerStaffId || null,
    });
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

  const rePair = async () => {
    setBusy(true);
    const res = await newPairingCode(device.id);
    setBusy(false);
    setConfirm(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setLatest(res.data);
    setPanelKept(true);
    toast.success(t("devices.newCodeToast"));
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
      status={device.status !== "active" ? <StatusPill status={device.status} /> : undefined}
    >
      <div className="flex max-w-3xl flex-col gap-section pb-hero">
        {/* What this tablet IS, before anything you can change about it. The
            page used to state none of it: the last-seen time was inside the
            description of a Turn-off button, the counter was in the page
            subtitle, and when it was registered was nowhere. */}
        <RecordFacts label={t("devices.factsLabel")} facts={facts} />

        {/* A tablet still waiting for its code shows the code here, with the
            steps and a live "paired" answer — the same panel the Add screen ends on. */}
        {device.status === "active" && (!isPaired(device) || panelKept) && (
          <div id="pairing" className="flex flex-col gap-tight">
            <div>
              <h2 className="text-base font-semibold text-fg">{t("devices.pairingTitle")}</h2>
              <p className="mt-inline max-w-prose text-[13px] leading-relaxed text-muted">{t("devices.pairingDesc")}</p>
            </div>
            <PairingPanel
              key={device.id}
              device={device}
              staff={staff}
              counters={counters}
              locations={locations}
              onChange={(d) => {
                setLatest(d);
                setPanelKept(true);
              }}
              onDone={() => router.push("/settings/devices")}
            />
          </div>
        )}

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

        <DeviceAccess
          value={{ access: form.access, staffIds: form.staffIds, ownerStaffId: form.ownerStaffId }}
          onChange={(a) => setDraft({ ...form, ...a })}
          staff={staff}
          roles={roles}
          place={draftPlace}
          counterName={draftCounter?.name ?? ""}
          error={accessErr}
          summary={
            <SignInSummary
              staff={staff}
              device={{
                ...device,
                counterId: form.counterId || null,
                access: form.access,
                staffIds: form.staffIds,
                ownerStaffId: form.ownerStaffId || null,
              }}
            />
          }
        />

        <SettingsSection title={t("devices.connectionTitle")} description={t("devices.connectionDesc")}>
          <SettingRow
            label={t("devices.statusLabel")}
            /* No longer carries the last-seen time: the facts above say it,
               and a control's description should say what the control does. */
            description={device.status === "active" ? t("devices.activeShort") : t("devices.inactiveDesc")}
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
          {isPaired(device) && (
            <SettingRow label={t("devices.replaceLabel")} description={t("devices.replaceDesc")} labelFor={false}>
              {() => (
                <div className="flex sm:justify-end">
                  <Button variant="secondary" onClick={() => setConfirm("repair")}>
                    {t("devices.rePairButton")}
                  </Button>
                </div>
              )}
            </SettingRow>
          )}
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

        <SaveBar dirty={dirty} saving={saving} invalid={!!nameErr || !!problem} onSave={save} onDiscard={() => setDraft(null)} />
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => (confirm === "remove" ? remove() : confirm === "repair" ? rePair() : setStatus("inactive"))}
        title={
          confirm === "remove"
            ? t("devices.removeTitle", { name: device.name })
            : confirm === "repair"
              ? t("devices.rePairTitle")
              : t("devices.turnOffTitle", { name: device.name })
        }
        message={
          confirm === "remove"
            ? t("devices.removeBody")
            : confirm === "repair"
              ? t("devices.rePairBody", { name: device.name })
              : t("devices.turnOffBody")
        }
        confirmLabel={confirm === "remove" ? t("devices.remove") : confirm === "repair" ? t("devices.rePairButton") : t("devices.turnOff")}
        loading={busy}
      />
    </PageShell>
  );
}
