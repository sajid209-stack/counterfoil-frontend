"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-major">
      <h2 className="type-h2 mb-section text-base">Opening hours</h2>
      <div className="flex flex-col gap-inline">
        {DAYS.map((label, day) => {
          const entry = hours.find((h) => h.dayOfWeek === day);
          const intervals = entry?.intervals ?? [];
          return (
            <div key={day} className="flex items-center justify-between text-sm">
              <span className="w-12 text-neutral-600">{label}</span>
              <span className="font-mono text-[12px] text-neutral-600">
                {intervals.length
                  ? intervals.map((i) => `${i.opensAt}–${i.closesAt}`).join(", ")
                  : "Closed"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-section text-[12px] text-neutral-400">
        Hours + special dates editor is a follow-up — an engineer picks it up here.
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
      toast.success(mode === "create" ? "Location created." : "Changes saved.");
      if (mode === "create") router.push(`/locations/${res.data.id}`);
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
      <div className="rounded-md border border-neutral-200 bg-white p-major">
        <h2 className="type-h2 mb-section text-base">Details</h2>
        <div className="grid gap-section sm:grid-cols-2">
          <FormField
            label="Name"
            required
            value={state.name}
            onChange={(e) => set("name", e.target.value)}
            error={errors.name}
            className="sm:col-span-2"
          />
          <FormField
            label="Address line 1"
            value={state.addressLine1}
            onChange={(e) => set("addressLine1", e.target.value)}
          />
          <FormField
            label="Address line 2"
            value={state.addressLine2}
            onChange={(e) => set("addressLine2", e.target.value)}
          />
          <FormField
            label="City"
            required
            value={state.city}
            onChange={(e) => set("city", e.target.value)}
            error={errors.city}
          />
          <FormField
            label="Country"
            value={state.country}
            onChange={(e) => set("country", e.target.value)}
          />
          <FormField
            label="Timezone"
            variant="select"
            value={state.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            options={TIMEZONES.map((t) => ({ value: t, label: t }))}
          />
          <FormField
            label="Active"
            variant="toggle"
            checked={state.active}
            onChange={(e) => set("active", (e.target as HTMLInputElement).checked)}
          />
        </div>
      </div>

      <HoursSummary hours={location?.openingHours ?? []} />

      <div className="sticky bottom-0 flex items-center justify-end gap-tight border-t border-neutral-200 bg-paper py-section">
        <Button variant="secondary" onClick={() => router.push("/locations")} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} loading={saving} disabled={!dirty && mode === "edit"}>
          {mode === "create" ? "Create location" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
