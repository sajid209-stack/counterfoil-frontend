"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, FormField, useToast } from "@/components/ui";
import {
  createLocation,
  updateLocation,
  type Location,
  type LocationInput,
  type OpeningHours,
} from "@/lib/api";

const TIMEZONES = [
  "Asia/Dhaka",
  "Asia/Kuala_Lumpur",
  "America/New_York",
  "America/Toronto",
];
const DAY_KEYS = ["daySun", "dayMon", "dayTue", "dayWed", "dayThu", "dayFri", "daySat"] as const;

interface FormState {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  country: string;
  timezone: string;
  active: boolean;
}

const fromLocation = (l: Location): FormState => ({
  name: l.name,
  addressLine1: l.addressLine1,
  addressLine2: l.addressLine2 ?? "",
  city: l.city,
  country: l.country,
  timezone: l.timezone,
  active: l.status !== "inactive",
});

const blank: FormState = {
  name: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  country: "Bangladesh",
  timezone: "Asia/Dhaka",
  active: true,
};

function HoursSummary({ hours }: { hours: OpeningHours[] }) {
  const t = useTranslations("settings");
  return (
    <div className="rounded-md border border-line bg-card p-major">
      <h2 className="type-h2 mb-section text-base">{t("locations.openingHours")}</h2>
      <div className="flex flex-col gap-inline">
        {DAY_KEYS.map((dayKey, day) => {
          const entry = hours.find((h) => h.dayOfWeek === day);
          const intervals = entry?.intervals ?? [];
          return (
            <div key={day} className="flex items-center justify-between text-sm">
              <span className="w-12 text-muted">{t(`common.${dayKey}` as never)}</span>
              <span className="font-mono text-[12px] text-muted">
                {intervals.length
                  ? intervals.map((i) => `${i.opensAt}–${i.closesAt}`).join(", ")
                  : t("locations.closed")}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-section text-[12px] text-faint">
        {t("locations.hoursFollowUp")}
      </p>
    </div>
  );
}

export function LocationForm({
  mode,
  location,
}: {
  mode: "create" | "edit";
  location?: Location;
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("settings");
  const initial = useMemo(() => (location ? fromLocation(location) : blank), [location]);
  const [state, setState] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(initial), [state, initial]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    setErrors({});
    const input: LocationInput = {
      name: state.name,
      addressLine1: state.addressLine1,
      addressLine2: state.addressLine2 || undefined,
      city: state.city,
      country: state.country,
      timezone: state.timezone,
      openingHours: location?.openingHours ?? [],
      status: state.active ? "active" : "inactive",
    };
    const res =
      mode === "create"
        ? await createLocation(input)
        : await updateLocation(location!.id, input);
    setSaving(false);
    if (res.ok) {
      toast.success(mode === "create" ? t("locations.createdToast") : t("common.changesSaved"));
      if (mode === "create") router.push(`/settings/locations/${res.data.id}`);
      else setState(fromLocation(res.data));
    } else if (res.error.code === "validation" && res.error.fieldErrors) {
      setErrors(res.error.fieldErrors);
      toast.error(res.error.message);
    } else {
      toast.error(res.error.message);
    }
  };

  return (
    <div className="flex flex-col gap-section pb-hero">
      <div className="rounded-md border border-line bg-card p-major">
        <h2 className="type-h2 mb-section text-base">{t("common.details")}</h2>
        <div className="grid gap-section sm:grid-cols-2">
          <FormField
            label={t("common.name")}
            required
            value={state.name}
            onChange={(e) => set("name", e.target.value)}
            error={errors.name}
            className="sm:col-span-2"
          />
          <FormField
            label={t("locations.addressLine1")}
            value={state.addressLine1}
            onChange={(e) => set("addressLine1", e.target.value)}
          />
          <FormField
            label={t("locations.addressLine2")}
            value={state.addressLine2}
            onChange={(e) => set("addressLine2", e.target.value)}
          />
          <FormField
            label={t("common.city")}
            required
            value={state.city}
            onChange={(e) => set("city", e.target.value)}
            error={errors.city}
          />
          <FormField
            label={t("common.country")}
            value={state.country}
            onChange={(e) => set("country", e.target.value)}
          />
          <FormField
            label={t("common.timezone")}
            variant="select"
            value={state.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
          />
          <FormField
            label={t("common.active")}
            variant="toggle"
            checked={state.active}
            onChange={(e) => set("active", (e.target as HTMLInputElement).checked)}
          />
        </div>
      </div>

      <HoursSummary hours={location?.openingHours ?? []} />

      <div className="sticky bottom-0 max-md:bottom-[calc(56px+env(safe-area-inset-bottom))] flex items-center justify-end gap-tight border-t border-line bg-surface py-section">
        <Button variant="secondary" onClick={() => router.push("/settings/locations")} disabled={saving}>
          {t("common.cancel")}
        </Button>
        <Button onClick={save} loading={saving} disabled={!dirty && mode === "edit"}>
          {mode === "create" ? t("locations.createButton") : t("common.saveChanges")}
        </Button>
      </div>
    </div>
  );
}
