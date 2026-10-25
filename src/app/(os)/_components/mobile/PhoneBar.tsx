"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { PreviewChip } from "@/components/screens";
import { listLocations } from "@/lib/api";
import { useActiveLocation } from "@/lib/activeLocation";
import { useApiQuery } from "@/lib/useApi";
import { VenueSheet } from "./VenueSheet";

/**
 * The phone's top bar — where you are, which venue you are looking at, then the
 * page's own actions (docs/mobile.md §7, rule 1).
 *
 *   [←|glyph]  Page name                       [actions]
 *              Venue name ▾
 *
 * Left, the page's glyph in a 32px soft tile — or, on a record, the back arrow
 * PageShell portals into `#os-page-back-mobile`, which takes the glyph's place
 * (the `peer`). On a Settings page the tile is the chevron that opens the list
 * of sections. Then two lines: the destination's name, and on a venue-scoped
 * page the venue, which opens the venue picker — Shopify's mobile admin always
 * says which store you are in, and an operator with three attractions has to be
 * told which one these figures belong to.
 *
 * It stays exactly 53px: sticky headers further down the page (the activity
 * log's day headings) pin themselves to that. At rest it has no line under it;
 * once the window has scrolled, `data-scrolled` is written onto the node and the
 * hairline appears — Apple's rule that a bar gains its separator only when
 * content passes under it. The attribute is written from the scroll listener
 * straight onto the node: it is a fact about the page's scroll position, not
 * something the render depends on, so there is no state to set.
 *
 * The title is a <p>, not a heading — the page's own <h1> renders in the
 * content below it.
 */
export function PhoneBar({
  pageName,
  PageIcon,
  isSettings,
  venueScoped,
  onOpenSettings,
}: {
  pageName: string;
  PageIcon: LucideIcon;
  isSettings: boolean;
  venueScoped: boolean;
  onOpenSettings: () => void;
}) {
  const t = useTranslations("nav");
  const bar = useRef<HTMLDivElement>(null);
  const [venuesOpen, setVenuesOpen] = useState(false);

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const read = () => {
      if (window.scrollY > 4) el.setAttribute("data-scrolled", "");
      else el.removeAttribute("data-scrolled");
    };
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, []);

  return (
    <>
      <div
        ref={bar}
        data-os-bar="phone"
        className="glass-navbar sticky top-0 z-30 flex h-[53px] shrink-0 items-center gap-tight border-b border-transparent bg-chrome px-gutter transition-colors duration-quick data-scrolled:border-hairline md:hidden"
      >
        {/* A page with a way back puts it here as an arrow (PageShell's BarBack),
            and the glyph or chevron beside it steps aside — see `peer`. */}
        <div id="os-page-back-mobile" className="peer flex shrink-0 items-center empty:hidden" />
        {isSettings ? (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={t("settingsSections")}
            aria-haspopup="dialog"
            data-settings-back-phone
            className="-ml-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-full text-fg-secondary transition-colors duration-quick active:bg-muted-wash peer-[:not(:empty)]:hidden"
          >
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-sm bg-muted-wash">
              <ChevronLeft size={18} strokeWidth={1.75} />
            </span>
          </button>
        ) : (
          <span
            aria-hidden
            className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-muted-wash text-fg-secondary peer-[:not(:empty)]:hidden"
          >
            <PageIcon size={18} strokeWidth={1.5} />
          </span>
        )}

        <BarTitle pageName={pageName} venueScoped={venueScoped} onOpenVenues={() => setVenuesOpen(true)} />

        {/* A phone has no picker in the bar: this says a preview is running, and ends it. */}
        <PreviewChip />
        <div id="os-page-actions-mobile" className="flex shrink-0 items-center gap-0.5 empty:hidden" />
      </div>
      {/* Outside the bar, not inside it: the bar is a z-30 stacking context and
          the menu button is z-30 too, later in the page — a sheet inside the bar
          would sit under the button. */}
      {venueScoped && <VenueSheet open={venuesOpen} onClose={() => setVenuesOpen(false)} />}
    </>
  );
}

/**
 * The title block: the destination's name, and on a venue-scoped page the venue
 * the console is looking at.
 *
 * With two or more venues the WHOLE block is one 44px button that opens the
 * picker — a real target, not a 16px line stretched by a pseudo-element (which
 * a hit test and a thumb both miss). With one venue the name is just said (a
 * chooser with one option is furniture). Until the venues have arrived the
 * second line holds its height so the title does not jump.
 */
function BarTitle({ pageName, venueScoped, onOpenVenues }: { pageName: string; venueScoped: boolean; onOpenVenues: () => void }) {
  const t = useTranslations("nav");
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const locations = locationsQ.data?.data ?? [];
  const { location } = useActiveLocation(locations);
  const name = <p className="truncate text-md font-semibold leading-5 text-fg">{pageName}</p>;
  if (!venueScoped) return <div className="flex min-w-0 flex-1 flex-col justify-center">{name}</div>;
  if (!location || locations.length < 2) {
    return (
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {name}
        {location ? <p className="truncate text-xs leading-4 text-muted">{location.name}</p> : <span aria-hidden className="block h-4" />}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpenVenues}
      aria-haspopup="dialog"
      data-bar-venue
      className="-mx-1.5 flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center rounded-md px-1.5 text-left transition-colors duration-quick active:bg-muted-wash"
    >
      {name}
      <span className="flex max-w-full items-center gap-1 text-xs leading-4 text-muted">
        <span className="sr-only">{t("venueNow", { name: location.name })}</span>
        <span aria-hidden className="truncate">{location.name}</span>
        <ChevronDown size={12} strokeWidth={2} aria-hidden className="shrink-0" />
      </span>
    </button>
  );
}
