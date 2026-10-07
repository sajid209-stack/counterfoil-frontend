"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, PageShell } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { useActiveLocation } from "@/lib/activeLocation";
import {
  createDevice,
  listCounters,
  listLocations,
  listRoles,
  listStaff,
  signInProblem,
  type Device,
} from "@/lib/api";
import { SectionSkeleton, SettingRow, controlCls, useUnsavedGuard } from "../../_components/SettingsKit";
import { CounterSelect } from "../_components/CounterSelect";
import { AccessFields, SignInSummary, accessProblem, type AccessDraft } from "../_components/DeviceAccess";
import { PairingPanel } from "../_components/PairingPanel";
import { StepSection } from "../_components/StepSection";

const OPEN_ACCESS: AccessDraft = { access: "venue", staffIds: [], ownerStaffId: "" };

/** Put the cursor on the first thing that is wrong, so the page says WHERE. */
function focusField(...selectors: string[]) {
  requestAnimationFrame(() => {
    const sel = selectors.find((x) => document.querySelector(x));
    const el = sel ? document.querySelector<HTMLElement>(sel) : null;
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    el?.focus({ preventScroll: true });
  });
}

/**
 * Adding a tablet, in the order it is done in real life.
 *
 *   1. This tablet            its name, and the counter it sells for
 *   2. Who can sign in on it  and a live count of who actually CAN (a person
 *                             without a till PIN is listed but cannot)
 *   3. Get the pairing code   then type it on the tablet
 *
 * Until now a tablet was added with a name only; who could use it was a second
 * trip to the device page, and nothing said that a person with no PIN could
 * never sign in. Everything is asked here, once.
 *
 * The button is never greyed out. Pressed too early it says what is missing,
 * beside the field, and puts the cursor on it — a disabled button says nothing
 * to somebody who cannot tell why.
 */
export default function RegisterDevicePage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const countersQ = useApiQuery(() => listCounters({ pageSize: 500 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 500 }), []);
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const counters = useMemo(() => countersQ.data?.data ?? [], [countersQ.data]);
  const locations = useMemo(() => locationsQ.data?.data ?? [], [locationsQ.data]);
  const staff = useMemo(() => staffQ.data?.data ?? [], [staffQ.data]);
  const roles = useMemo(() => rolesQ.data?.data ?? [], [rolesQ.data]);

  const [name, setName] = useState("");
  /** null = not chosen yet: the counter at the venue in the top bar stands in. */
  const [chosen, setChosen] = useState<string | null>(null);
  const [who, setWho] = useState<AccessDraft>(OPEN_ACCESS);
  const [attempted, setAttempted] = useState(false);
  const [apiErrors, setApiErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Device | null>(null);

  // The venue in the bar decides which counter is offered first.
  const bar = useActiveLocation(locations);
  const openCounters = counters.filter((c) => c.status === "active");
  const defaultCounter = openCounters.find((c) => c.locationId === bar.id) ?? undefined;
  const counterId = chosen ?? defaultCounter?.id ?? "";
  const counter = counters.find((c) => c.id === counterId);
  const venue = locations.find((l) => l.id === counter?.locationId);

  useUnsavedGuard((!!name || chosen !== null || who !== OPEN_ACCESS) && !created);

  // The tablet as drafted, so the same rules that judge a real one judge it live.
  const draft: Device = {
    id: "",
    name,
    counterId: counterId || null,
    pairingCode: "",
    access: who.access,
    staffIds: who.staffIds,
    ownerStaffId: who.ownerStaffId || null,
    status: "active",
    lastSeenAt: null,
    pairedAt: null,
    createdAt: "",
    updatedAt: "",
  };

  const nameErr = (attempted || apiErrors.name) && !name.trim() ? t("devices.nameRequired") : undefined;
  const counterErr = (attempted || apiErrors.counterId) && !counterId ? t("devices.counterRequired") : undefined;
  const pickProblem = accessProblem(who, staff);
  const peopleErr = pickProblem
    ? attempted
      ? pickProblem.key === "pickErr"
        ? t("devices.pickErr")
        : t("devices.pickBlocked", { name: pickProblem.name })
      : undefined
    : attempted && counterId && signInProblem(draft, staff) && who.access === "assigned"
      ? t("devices.signInNone")
      : undefined;

  const submit = async () => {
    setAttempted(true);
    setApiErrors({});
    if (!name.trim()) return focusField('[data-field="name"]');
    if (!counterId) return focusField('[data-field="counter"]');
    if (pickProblem || signInProblem(draft, staff)) {
      return focusField('[data-field="people"]', '[data-section="access"] input');
    }
    setSaving(true);
    const res = await createDevice({
      name: name.trim(),
      counterId,
      status: "active",
      access: who.ownerStaffId ? "assigned" : who.access,
      staffIds: who.ownerStaffId ? [who.ownerStaffId] : who.access === "assigned" ? who.staffIds : [],
      ownerStaffId: who.ownerStaffId || null,
    });
    setSaving(false);
    if (!res.ok) {
      setApiErrors(res.error.fieldErrors ?? { form: res.error.message });
      return focusField('[data-field="name"]');
    }
    setCreated(res.data);
  };

  if (countersQ.loading || locationsQ.loading || !staffQ.data || !rolesQ.data) {
    return (
      <PageShell title={t("devices.newTitle")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  if (created) {
    return (
      <PageShell title={t("devices.pairTitle", { name: created.name })} description={t("devices.pairDesc")}>
        <div className="flex max-w-3xl flex-col gap-section pb-hero">
          <PairingPanel
            device={created}
            staff={staff}
            counters={counters}
            locations={locations}
            onDone={() => router.push("/settings/devices")}
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={t("devices.newTitle")} description={t("devices.registerDesc")}>
      <div className="flex max-w-3xl flex-col gap-section pb-hero">
        <StepSection n={1} title={t("devices.step1Title")} description={t("devices.step1Desc")}>
          <SettingRow label={t("devices.deviceName")} error={nameErr}>
            {({ id, describedBy }) => (
              <input
                id={id}
                data-field="name"
                value={name}
                placeholder={t("devices.deviceNamePlaceholder")}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                aria-invalid={!!nameErr || undefined}
                aria-describedby={describedBy}
                className={cn(controlCls(!!nameErr))}
              />
            )}
          </SettingRow>
          <SettingRow label={t("devices.counterLabel")} description={t("devices.counterDescNew")} error={counterErr}>
            {({ id, describedBy }) => (
              <CounterSelect
                id={id}
                describedBy={describedBy}
                value={counterId}
                onChange={setChosen}
                counters={openCounters}
                locations={locations}
                required
                invalid={!!counterErr}
              />
            )}
          </SettingRow>
        </StepSection>

        <StepSection n={2} title={t("devices.step2Title")} description={t("devices.step2Desc")}>
          <div data-section="access" className="divide-y divide-hairline">
            <AccessFields
              value={who}
              onChange={setWho}
              staff={staff}
              roles={roles}
              place={venue?.name ?? ""}
              counterName={counter?.name ?? ""}
              error={peopleErr ?? apiErrors.staffIds}
              scope={venue ? { venueId: venue.id, venueName: venue.name } : "pending"}
            />
          </div>
          <div className="px-card py-section">
            <SignInSummary device={draft} staff={staff} showRefusal={attempted || !!counterId} />
          </div>
        </StepSection>

        <StepSection n={3} title={t("devices.step3Title")} description={t("devices.step3Desc")}>
          <div className="flex flex-wrap items-center gap-tight px-card py-section">
            <Button onClick={submit} loading={saving}>
              {t("devices.addAndPair")}
            </Button>
            <Button variant="secondary" onClick={() => router.push("/settings/devices")} disabled={saving}>
              {t("save.cancel")}
            </Button>
            {apiErrors.form && (
              <p role="alert" className="w-full text-[13px] text-danger">
                {apiErrors.form}
              </p>
            )}
          </div>
        </StepSection>
      </div>
    </PageShell>
  );
}
