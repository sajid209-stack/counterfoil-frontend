"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Sheet } from "@/components/ui";
import { listLocations } from "@/lib/api";
import { setActiveLocation, useActiveLocation } from "@/lib/activeLocation";
import { useApiQuery } from "@/lib/useApi";
import { cn } from "@/lib/cn";

/**
 * The venue picker the phone opens from the bar's second line and from the
 * menu's Venue row.
 *
 * The desktop bar has a dropdown; a phone's list of venues is a decision made
 * with a thumb, so it is a short sheet of 52px rows instead — the venue you are
 * on ticked, the ones that have stopped selling saying so. Choosing one applies
 * at once (`setActiveLocation` is the console's single source for it) and
 * closes the sheet.
 *
 * Mounted only while open (the kit `Sheet` returns nothing when closed, and the
 * list below is its child), so the venues are not queried on every phone page.
 */
export function VenueSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  return (
    <Sheet open={open} onClose={onClose} title={t("venueChoose")} closeLabel={tCommon("close")}>
      <VenueList onClose={onClose} />
    </Sheet>
  );
}

function VenueList({ onClose }: { onClose: () => void }) {
  const t = useTranslations("nav");
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const locations = locationsQ.data?.data ?? [];
  const { id } = useActiveLocation(locations);
  return (
    <ul role="list" aria-label={t("venue")} className="flex flex-col gap-1 p-tight">
      {locations.map((l) => {
        const on = l.id === id;
        return (
          <li key={l.id}>
            <button
              type="button"
              data-autofocus={on ? "" : undefined}
              aria-current={on ? "true" : undefined}
              onClick={() => {
                setActiveLocation(l.id);
                onClose();
              }}
              className={cn(
                "flex min-h-13 w-full items-center gap-comfortable rounded-md px-comfortable text-start transition-colors duration-quick active:bg-nav-selected",
                on ? "bg-nav-selected" : "hover:bg-nav-hover",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-md text-fg", on && "font-semibold")}>{l.name}</span>
                {l.status !== "active" && <span className="block truncate text-sm text-muted">{t("venueNotSelling")}</span>}
              </span>
              {on && <Check size={18} strokeWidth={2} aria-hidden className="shrink-0 text-fg" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
