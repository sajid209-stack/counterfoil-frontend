"use client";

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listLocations } from "@/lib/api";
import { setActiveLocation, useActiveLocation } from "@/lib/activeLocation";
import { cn } from "@/lib/cn";

/**
 * Which venue the console is looking at — in the bar, on every page that has a
 * venue dimension.
 *
 * It is a lens rather than a filter, which is why it sits with the page's name
 * instead of among its controls: the status, the date range and the search
 * belong to the screen and change with it, and the venue belongs to the session
 * and does not. Every mature multi-site admin puts it here for that reason.
 *
 * **There is no "All venues".** A figure summed across three attractions is one
 * nobody can act on, and every screen behind this was quietly showing that sum.
 *
 * It draws nothing at all for an operator with one venue: a chooser with one
 * option is furniture.
 */
export function LocationSwitcher({ compact = false, full = false }: { compact?: boolean; full?: boolean }) {
  const t = useTranslations("nav");
  /* Every venue that still exists, not only the ones selling.
     A venue that has stopped selling has not stopped having stock, past orders
     or a roster — and a manager looking into why it stopped needs to be able to
     look at it. Archived is the one that is gone, and `listLocations` hides
     those unless asked. The row says which are not selling. */
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const locations = locationsQ.data?.data ?? [];
  const { id } = useActiveLocation(locations);

  if (locations.length < 2) return null;

  const select = (
    <Select
      aria-label={t("venue")}
      value={id}
      onChange={setActiveLocation}
      /* 44px at BOTH sizes: `compact` only ever renders below md, where this
         is pressed with a thumb — `sm` is 36px and the mobile audit caught it
         on every venue-scoped route. Compact means narrower and smaller type,
         not a smaller target. */
      size="md"
      /* The glyph does the naming on a phone, where the bar has room for a
         venue name and not for a label in front of it. */
      icon={<MapPin size={15} strokeWidth={1.75} aria-hidden />}
      /* On a desktop the control is as wide as the venue's name: the bar has
         plenty of room, and "Ahsan Manzil Mus..." beside an empty bar read as
         a fault. The cap is what makes it truncate, and it is a share of the
         window so a narrow one gives up the name before it gives up the title. */
      className={full ? "w-full" : compact ? undefined : "w-max max-w-[min(24rem,34vw)]"}
      triggerClassName={cn("min-w-0", full ? "w-full" : compact && "max-w-[9rem] text-[0.8125rem]")}
      options={locations.map((l) => ({
        value: l.id,
        label: l.name,
        /* Said, not implied: a venue that is not selling looks exactly like one
           that is until the figures come back at zero. */
        note: l.status === "active" ? undefined : t("venueNotSelling"),
      }))}
    />
  );

  /* `full` is the phone's menu sheet: the venue at the top of it, with a label
     because there is no bar around it to say what the control is. */
  return full ? (
    <div>
      <p className="pb-1 text-[12px] font-medium text-muted">{t("venue")}</p>
      {select}
    </div>
  ) : (
    select
  );
}
