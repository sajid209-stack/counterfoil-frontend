"use client";

import { useTranslations } from "next-intl";

import { Select } from "@/components/ui";
import type { Counter, Location } from "@/lib/api";


/**
 * Which counter a tablet opens, grouped by location — six counter names in a
 * flat list do not say that two of them are "Group Desk" at different places.
 */
export function CounterSelect({
  id,
  describedBy,
  value,
  onChange,
  counters,
  locations,
}: {
  id: string;
  describedBy?: string;
  value: string;
  onChange: (counterId: string) => void;
  counters: Counter[];
  locations: Location[];
}) {
  const t = useTranslations("settings");
  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      aria-describedby={describedBy}
      options={[
        { value: "", label: t("devices.noCounter") },
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
