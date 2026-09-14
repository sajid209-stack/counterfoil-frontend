"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { createLocation, updateLocation, type Counter, type Location, type OpeningHours, type Resource } from "@/lib/api";
import { CreateBar, SaveBar, SettingRow, SettingsSection, controlCls } from "../../_components/SettingsKit";
import { TIMEZONES, zoneLabel } from "../../_lib/zones";
import { dayProblem, normalizeHours, openDays } from "../_lib/hours";
import { HoursEditor } from "./HoursEditor";

interface Draft {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  country: string;
  timezone: string;
  hours: OpeningHours[];
}

const fromLocation = (l: Location): Draft => ({
  name: l.name,
  addressLine1: l.addressLine1,
  addressLine2: l.addressLine2 ?? "",
  city: l.city,
  country: l.country,
  timezone: l.timezone,
  hours: normalizeHours(l.openingHours),
});

const BLANK: Draft = {
  name: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  country: "Bangladesh",
  timezone: "Asia/Dhaka",
  hours: normalizeHours(([0, 1, 2, 3, 4, 5, 6] as OpeningHours["dayOfWeek"][]).map((d) => ({ dayOfWeek: d, intervals: [{ opensAt: "10:00", closesAt: "18:00" }] }))),
};

const chip =
  "inline-flex min-h-11 items-center rounded-full border border-line px-comfortable text-[13px] text-fg transition-colors duration-quick hover:bg-subtle/60 md:min-h-9";

/**
 * A location: where it is, when it is open, what hangs off it, and whether it
 * is selling.
 *
 * It was a two-column form of uppercase labels with an "Active" toggle floating
 * beside the time zone, and hours that could not be edited. Switching a venue
 * off is not a field in a draft — it stops its counters and bookings the moment
 * it happens — so it is its own action with a confirmation, apart from the
 * details that wait for Save. "Used here" is there because the question before
 * closing a location is always what closes with it.
 */
export function LocationEditor({
  mode,
  location,
  counters = [],
  resources = [],
  teamCount = 0,
  onSaved,
}: {
  mode: "create" | "edit";
  location?: Location;
  counters?: Counter[];
  resources?: Resource[];
  teamCount?: number;
  onSaved?: (l: Location) => void;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [allResources, setAllResources] = useState(false);
  const toast = useToast();
  const initial = useMemo(() => (location ? fromLocation(location) : BLANK), [location]);
  const [base, setBase] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [busy, setBusy] = useState(false);
  const saved = base ?? initial;
  const form = draft ?? saved;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch: Partial<Draft>) => setDraft({ ...form, ...patch });

  const judge = mode === "edit" || !!draft;
  const nameErr = judge && !form.name.trim() ? t("locations.nameRequired") : undefined;
  const cityErr = judge && !form.city.trim() ? t("locations.cityRequired") : undefined;
  const hoursBad = form.hours.some((h) => dayProblem(h.intervals) !== null);
  const invalid = !form.name.trim() || !form.city.trim() || hoursBad;
  const zones = TIMEZONES.includes(form.timezone) ? TIMEZONES : [form.timezone, ...TIMEZONES];

  const submit = async () => {
    setSaving(true);
    const input = {
      name: form.name.trim(),
      addressLine1: form.addressLine1.trim(),
      addressLine2: form.addressLine2.trim() || undefined,
      city: form.city.trim(),
      country: form.country.trim(),
      timezone: form.timezone,
      openingHours: form.hours,
      status: location?.status ?? ("active" as const),
    };
    const res = mode === "create" ? await createLocation(input) : await updateLocation(location!.id, input);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    if (mode === "create") {
      toast.success(t("locations.createdToast"));
      router.push(`/settings/locations/${res.data.id}`);
      return;
    }
    setBase(fromLocation(res.data));
    setDraft(null);
    onSaved?.(res.data);
    toast.success(t("common.changesSaved"));
  };

  const setStatus = async (status: "active" | "inactive") => {
    if (!location) return;
    setBusy(true);
    const res = await updateLocation(location.id, { status });
    setBusy(false);
    setConfirmStop(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    onSaved?.(res.data);
    toast.success(status === "inactive" ? t("locations.stopped", { name: location.name }) : t("locations.started", { name: location.name }));
  };

  return (
    <div className="flex max-w-3xl flex-col gap-section pb-hero">
      <SettingsSection title={t("locations.detailsTitle")} description={t("locations.detailsDesc")}>
        <SettingRow label={t("common.name")} error={nameErr}>
          {({ id, describedBy }) => (
            <input
              id={id}
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              autoComplete="off"
              aria-invalid={!!nameErr || undefined}
              aria-describedby={describedBy}
              className={controlCls(!!nameErr)}
            />
          )}
        </SettingRow>
        <SettingRow label={t("locations.address")} description={t("locations.addressDesc")} error={cityErr} labelFor={false}>
          {({ describedBy }) => (
            <div className="flex flex-col gap-tight">
              <input
                aria-label={t("locations.street")}
                placeholder={t("locations.street")}
                value={form.addressLine1}
                onChange={(e) => set({ addressLine1: e.target.value })}
                autoComplete="address-line1"
                className={controlCls()}
              />
              <input
                aria-label={t("locations.building")}
                placeholder={t("locations.building")}
                value={form.addressLine2}
                onChange={(e) => set({ addressLine2: e.target.value })}
                autoComplete="address-line2"
                className={controlCls()}
              />
              <div className="grid grid-cols-2 gap-tight">
                <input
                  aria-label={t("locations.cityPh")}
                  placeholder={t("locations.cityPh")}
                  value={form.city}
                  onChange={(e) => set({ city: e.target.value })}
                  autoComplete="address-level2"
                  aria-invalid={!!cityErr || undefined}
                  aria-describedby={describedBy}
                  className={controlCls(!!cityErr)}
                />
                <input
                  aria-label={t("locations.countryPh")}
                  placeholder={t("locations.countryPh")}
                  value={form.country}
                  onChange={(e) => set({ country: e.target.value })}
                  autoComplete="country-name"
                  className={controlCls()}
                />
              </div>
            </div>
          )}
        </SettingRow>
        <SettingRow label={t("common.timezone")} description={t("locations.timezoneDesc")}>
          {({ id, describedBy }) => (
            <select
              id={id}
              value={form.timezone}
              onChange={(e) => set({ timezone: e.target.value })}
              aria-describedby={describedBy}
              className={cn(controlCls(), "pr-section")}
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {zoneLabel(z)}
                </option>
              ))}
            </select>
          )}
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        title={t("locations.openingHours")}
        description={t("locations.hoursDesc")}
        aside={<p className="text-[13px] text-muted">{t("locations.hoursSummary", { days: openDays(form.hours) })}</p>}
      >
        <HoursEditor hours={form.hours} onChange={(hours) => set({ hours })} />
      </SettingsSection>

      {mode === "edit" && (
        <SettingsSection title={t("locations.usedTitle")} description={t("locations.usedDesc")}>
          <SettingRow
            label={t("counters.title")}
            description={counters.length === 0 ? t("locations.noCountersYet") : undefined}
            labelFor={false}
          >
            {() => (
              <ul className="flex flex-wrap gap-tight sm:justify-end">
                {counters.length > 0 ? (
                  counters.map((c) => (
                    <li key={c.id}>
                      <Link href={`/settings/counters/${c.id}`} className={chip}>
                        {c.name}
                      </Link>
                    </li>
                  ))
                ) : (
                  <li>
                    <Button variant="secondary" size="sm" onClick={() => router.push("/settings/counters/new")}>
                      {t("locations.addCounter")}
                    </Button>
                  </li>
                )}
              </ul>
            )}
          </SettingRow>
          {resources.length > 0 && (
            <SettingRow label={t("nav.items.resources.title")} labelFor={false}>
              {() => (
                <ul className="flex flex-wrap gap-tight sm:justify-end">
                  {(allResources ? resources : resources.slice(0, 6)).map((r) => (
                    <li key={r.id}>
                      <Link href={`/settings/resources/${r.id}`} className={chip}>
                        {r.name}
                      </Link>
                    </li>
                  ))}
                  {/* It was "+2 more" in grey — a count of things you could
                      not get to. */}
                  {resources.length > 6 && !allResources && (
                    <li>
                      <button
                        type="button"
                        onClick={() => setAllResources(true)}
                        className="inline-flex min-h-11 items-center rounded-sm px-tight text-[13px] font-medium text-fg underline-offset-2 transition-colors duration-quick hover:underline md:min-h-9"
                      >
                        {t("locations.showAll", { count: resources.length })}
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </SettingRow>
          )}
          <SettingRow label={t("team.title")} description={t("locations.teamCount", { count: teamCount })} labelFor={false}>
            {() => (
              <div className="flex sm:justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push(location ? `/settings/team?location=${location.id}` : "/settings/team")}
                >
                  {t("locations.viewTeam")}
                </Button>
              </div>
            )}
          </SettingRow>
        </SettingsSection>
      )}

      {mode === "edit" && location && (
        <SettingsSection title={t("locations.statusTitle")} description={t("locations.statusDesc")}>
          <SettingRow
            label={t("locations.sellingLabel")}
            description={location.status === "inactive" ? t("locations.sellingOff") : t("locations.sellingOn")}
            labelFor={false}
          >
            {() => (
              <div className="flex sm:justify-end">
                {location.status === "inactive" ? (
                  <Button onClick={() => setStatus("active")} loading={busy}>
                    {t("locations.start")}
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => setConfirmStop(true)}>
                    {t("locations.stop")}
                  </Button>
                )}
              </div>
            )}
          </SettingRow>
        </SettingsSection>
      )}

      {mode === "create" ? (
        <CreateBar
          dirty={!!draft}
          invalid={invalid}
          saving={saving}
          note={t("locations.createNote")}
          invalidNote={t("locations.createInvalid")}
          submitLabel={t("locations.createButton")}
          onSubmit={submit}
          onCancel={() => router.push("/settings/locations")}
        />
      ) : (
        <SaveBar dirty={dirty} saving={saving} invalid={invalid} onSave={submit} onDiscard={() => setDraft(null)} />
      )}

      {location && (
        <ConfirmDialog
          open={confirmStop}
          onClose={() => setConfirmStop(false)}
          onConfirm={() => setStatus("inactive")}
          title={t("locations.stopTitle", { name: location.name })}
          message={t("locations.stopBody")}
          confirmLabel={t("locations.stop")}
          loading={busy}
        />
      )}
    </div>
  );
}
