"use client";

import { useTranslations } from "next-intl";
import { Checkbox, Chip, Notice } from "@/components/ui";
import type { Counter, Location } from "@/lib/api";

/**
 * Where someone works: locations, and the counters at each.
 *
 * These were two unrelated checkbox lists side by side, so a person assigned
 * only to Lalbagh Fort could still be ticked onto the Museum Lobby — a counter
 * at a location they cannot sign in to. A counter belongs to exactly one
 * location, so its choice now sits under that location and only appears once
 * the location is chosen; leaving a location takes its counters with it.
 */
export function WorkplacePicker({
  locations,
  counters,
  locationIds,
  counterIds,
  onChange,
  warnEmpty,
}: {
  locations: Location[];
  counters: Counter[];
  locationIds: string[];
  counterIds: string[];
  onChange: (locationIds: string[], counterIds: string[]) => void;
  /** Whether "no location" deserves a warning yet — not on a form nobody has touched. */
  warnEmpty: boolean;
}) {
  const t = useTranslations("settings");
  const places = locations.filter((l) => l.status !== "archived");

  const toggleLocation = (id: string) => {
    const on = locationIds.includes(id);
    if (on) {
      onChange(
        locationIds.filter((x) => x !== id),
        counterIds.filter((c) => counters.find((k) => k.id === c)?.locationId !== id),
      );
    } else {
      onChange([...locationIds, id], counterIds);
    }
  };
  const toggleCounter = (id: string) =>
    onChange(locationIds, counterIds.includes(id) ? counterIds.filter((x) => x !== id) : [...counterIds, id]);

  return (
    <div>
      <ul className="divide-y divide-hairline">
        {places.map((l) => {
          const on = locationIds.includes(l.id);
          const here = counters.filter((c) => c.locationId === l.id && c.status !== "archived");
          const pickedHere = here.filter((c) => counterIds.includes(c.id)).length;
          return (
            <li key={l.id} className="px-card py-tight">
              <Checkbox
                checked={on}
                onChange={() => toggleLocation(l.id)}
                label={<span className="font-medium">{l.name}</span>}
                description={l.status === "inactive" ? `${l.city} · ${t("common.inactive")}` : l.city}
              />
              {on && here.length > 0 && (
                <fieldset className="pb-tight pl-13 md:pl-11">
                  <legend className="text-sm text-muted">{t("team.countersAt", { location: l.name })}</legend>
                  <div className="mt-tight flex flex-wrap gap-tight">
                    {here.map((c) => {
                      const checked = counterIds.includes(c.id);
                      return (
                        <Chip key={c.id} selected={checked} onClick={() => toggleCounter(c.id)}>
                          {c.name}
                        </Chip>
                      );
                    })}
                  </div>
                  {pickedHere === 0 && <p className="mt-tight text-sm text-muted">{t("team.noCounterHere")}</p>}
                </fieldset>
              )}
            </li>
          );
        })}
      </ul>
      {warnEmpty && locationIds.length === 0 && (
        <div className="border-t border-hairline px-card py-section">
          <Notice tone="warning" size="sm">
            {t("team.noLocation")}
          </Notice>
        </div>
      )}
    </div>
  );
}
