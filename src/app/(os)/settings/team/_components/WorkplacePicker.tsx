"use client";

import { useTranslations } from "next-intl";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
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
            <li key={l.id} className="px-major py-tight">
              <label className="flex min-h-12 cursor-pointer items-center gap-comfortable">
                <input type="checkbox" checked={on} onChange={() => toggleLocation(l.id)} className="h-4 w-4 shrink-0 accent-ember" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-fg">{l.name}</span>
                  <span className="block text-[13px] text-muted">
                    {l.status === "inactive" ? `${l.city} · ${t("common.inactive")}` : l.city}
                  </span>
                </span>
              </label>
              {on && here.length > 0 && (
                <fieldset className="pb-tight pl-[28px]">
                  <legend className="text-[13px] text-muted">{t("team.countersAt", { location: l.name })}</legend>
                  <div className="mt-tight flex flex-wrap gap-tight">
                    {here.map((c) => {
                      const checked = counterIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={cn(
                            "inline-flex min-h-11 cursor-pointer items-center gap-tight rounded-full border px-comfortable text-[13px] transition-colors duration-quick md:min-h-9",
                            checked ? "border-ember-solid bg-ember/5 text-fg" : "border-line text-muted hover:bg-subtle/60",
                          )}
                        >
                          <input type="checkbox" checked={checked} onChange={() => toggleCounter(c.id)} className="h-4 w-4 accent-ember" />
                          {c.name}
                        </label>
                      );
                    })}
                  </div>
                  {pickedHere === 0 && <p className="mt-tight text-[13px] text-muted">{t("team.noCounterHere")}</p>}
                </fieldset>
              )}
            </li>
          );
        })}
      </ul>
      {warnEmpty && locationIds.length === 0 && (
        <p className="flex items-start gap-tight border-t border-hairline bg-warning-wash px-major py-tight text-[13px] text-fg">
          <CircleAlert size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-warning" />
          {t("team.noLocation")}
        </p>
      )}
    </div>
  );
}
