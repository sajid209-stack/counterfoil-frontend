"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button, Checkbox, FormField, Notice } from "@/components/ui";
import type { Location } from "@/lib/api";

/**
 * Where something is sold: at the till, online, and at which venues — the
 * same block for a booking and an event, so the two kinds cannot drift into
 * different ideas of what "on sale" covers. Online is never assumed: when it
 * is off the block says, in so many words, that this will not be on the
 * website.
 */
export function WhereSold({
  counter,
  online,
  onCounter,
  onOnline,
  onlineHelp,
  counterHelp,
  locations,
  locationIds,
  onToggleLocation,
  onAddLocation,
  error,
  locationsOnlyForCounter = false,
  hideHeading = false,
}: {
  counter: boolean;
  online: boolean;
  onCounter: (v: boolean) => void;
  onOnline: (v: boolean) => void;
  /** What "online" means for this kind — a booking page, or the event's own page. */
  onlineHelp: string;
  /** What "at the counter" means for this kind, where it differs. */
  counterHelp?: string;
  locations: Location[];
  locationIds: string[];
  onToggleLocation: (id: string) => void;
  onAddLocation?: () => void;
  error?: string | null;
  /** An event sold only on its own page belongs to no venue of the
   *  operator's; venues matter once a counter sells it. */
  locationsOnlyForCounter?: boolean;
  /** Where a step title already says "where is it sold", the block's own
   *  heading would say it twice. It stays for a screen reader. */
  hideHeading?: boolean;
}) {
  const showLocations = !locationsOnlyForCounter || counter;
  const t = useTranslations("catalog.wizard");
  return (
    <div className="grid gap-section sm:grid-cols-2">
      <div className="flex flex-col gap-tight">
        <span className={hideHeading ? "sr-only" : "text-md font-semibold text-fg"}>{t("soldWhere")}</span>
        <FormField label={t("atCounter")} variant="toggle" help={counterHelp ?? t("atCounterHelp")} checked={counter} onChange={(e) => onCounter((e.target as HTMLInputElement).checked)} />
        <FormField label={t("online")} variant="toggle" help={onlineHelp} checked={online} onChange={(e) => onOnline((e.target as HTMLInputElement).checked)} />
        {!counter && !online ? (
          <p className="text-sm font-medium text-danger">{t("nowhere")}</p>
        ) : !online ? (
          <Notice tone="warning" size="sm">{t("notOnline")}</Notice>
        ) : null}
      </div>
      {showLocations && (
      <fieldset className="flex min-w-0 flex-col gap-tight" aria-invalid={error ? true : undefined} aria-describedby={error ? "where-loc-error" : undefined}>
        <legend className="mb-tight text-md font-semibold text-fg">{t("locations")}</legend>
        {locations.length === 0 ? (
          <div className="rounded-inner bg-muted-wash px-comfortable py-section text-center">
            <p className="text-sm text-muted">{t("noLocation")}</p>
            {onAddLocation && (
              <Button size="sm" className="mt-tight" icon={<Plus size={14} strokeWidth={1.5} />} onClick={onAddLocation}>{t("addLocationNow")}</Button>
            )}
          </div>
        ) : (
          <>
            {locations.map((l) => (
              <Checkbox key={l.id} label={l.name} checked={locationIds.includes(l.id)} onCheckedChange={() => onToggleLocation(l.id)} />
            ))}
            {onAddLocation && (
              <Button variant="tertiary" size="sm" className="mt-inline self-start" icon={<Plus size={14} strokeWidth={1.5} />} onClick={onAddLocation}>
                {t("addLocation")}
              </Button>
            )}
          </>
        )}
        {error && <p id="where-loc-error" role="alert" className="text-sm font-medium text-danger">{error}</p>}
      </fieldset>
      )}
    </div>
  );
}
