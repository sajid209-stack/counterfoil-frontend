"use client";

import { useTranslations } from "next-intl";

import { Select } from "@/components/ui";
import type { Counter, Location } from "@/lib/api";


/**
 * Which counter a tablet opens, grouped by location — six counter names in a
 * flat list do not say that two of them are "Group Desk" at different places.
 *
 * `required` is for a tablet that is being added: there is no "No counter"
 * answer, only a placeholder, and the control carries `data-field="counter"` so
 * a page that refuses an empty one can put the cursor back on it.
 */
export function CounterSelect({
  id,
  describedBy,
  value,
  onChange,
  counters,
  locations,
  required,
  invalid,
}: {
  id: string;
  describedBy?: string;
  value: string;
  onChange: (counterId: string) => void;
  counters: Counter[];
  locations: Location[];
  required?: boolean;
  invalid?: boolean;
}) {
  const t = useTranslations("settings");
  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      placeholder={required ? t("devices.counterPlaceholder") : undefined}
      dataAttrs={required ? { "data-field": "counter" } : undefined}
      options={[
        ...(required ? [] : [{ value: "", label: t("devices.noCounter") }]),
        ...locations
          .filter((l) => l.status !== "archived")
          .flatMap((l) =>
            counters
              .filter((c) => c.locationId === l.id && c.status !== "archived")
              .map((c) => ({ value: c.id, label: c.name, group: l.name })),
          ),
      ]}
    />
  );
}
