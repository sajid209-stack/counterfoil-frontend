"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, Plus } from "lucide-react";
import { Button, FormField } from "@/components/ui";
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
}) {
  const showLocations = !locationsOnlyForCounter || counter;
  const t = useTranslations("catalog.wizard");
  return (
    <div className="grid gap-section sm:grid-cols-2">
      <div className="flex flex-col gap-tight">
        <span className="text-[15px] font-semibold tracking-tight">{t("soldWhere")}</span>
        <FormField label={t("atCounter")} variant="toggle" help={counterHelp ?? t("atCounterHelp")} checked={counter} onChange={(e) => onCounter((e.target as HTMLInputElement).checked)} />
        <FormField label={t("online")} variant="toggle" help={onlineHelp} checked={online} onChange={(e) => onOnline((e.target as HTMLInputElement).checked)} />
        {!counter && !online ? (
          <p className="text-[13px] font-medium text-danger">{t("nowhere")}</p>
        ) : !online ? (
          <p className="flex items-start gap-tight rounded-sm bg-warning-wash px-comfortable py-tight text-[13px] text-fg">
            <AlertTriangle size={14} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-warning" />
            {t("notOnline")}
          </p>
        ) : null}
      </div>
      {showLocations && (
      <fieldset className="flex min-w-0 flex-col gap-tight" aria-invalid={error ? true : undefined} aria-describedby={error ? "where-loc-error" : undefined}>
        <legend className="mb-tight text-[15px] font-semibold tracking-tight">{t("locations")}</legend>
        {locations.length === 0 ? (
          <div className="rounded-sm border border-dashed border-line px-comfortable py-section text-center">
            <p className="text-[13px] text-muted">{t("noLocation")}</p>
            {onAddLocation && (
              <Button size="sm" className="mt-tight" icon={<Plus size={14} strokeWidth={1.5} />} onClick={onAddLocation}>{t("addLocationNow")}</Button>
            )}
          </div>
        ) : (
          <>
            {locations.map((l) => (
              <label key={l.id} className="flex min-h-11 cursor-pointer items-center gap-tight text-sm md:min-h-9">
                <input type="checkbox" checked={locationIds.includes(l.id)} onChange={() => onToggleLocation(l.id)} className="h-4 w-4 accent-ember" />
                {l.name}
              </label>
            ))}
            {onAddLocation && (
              <button type="button" onClick={onAddLocation} className="mt-inline flex min-h-11 items-center gap-inline self-start text-[13px] text-brand-foreground hover:underline md:min-h-0">
                <Plus size={14} strokeWidth={1.5} /> {t("addLocation")}
              </button>
            )}
          </>
        )}
        {error && <p id="where-loc-error" role="alert" className="text-[13px] font-medium text-danger">{error}</p>}
      </fieldset>
      )}
    </div>
  );
}
