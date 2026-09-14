"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import type { Counter, Location } from "@/lib/api";
import { controlCls } from "../../_components/SettingsKit";

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
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-describedby={describedBy}
      className={cn(controlCls(), "pr-section")}
    >
      <option value="">{t("devices.noCounter")}</option>
      {locations
        .filter((l) => l.status !== "archived")
        .map((l) => {
          const here = counters.filter((c) => c.locationId === l.id && c.status !== "archived");
          if (here.length === 0) return null;
          return (
            <optgroup key={l.id} label={l.name}>
              {here.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          );
        })}
    </select>
  );
}
