"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { PreviewChip } from "@/components/screens";
import { listLocations } from "@/lib/api";
import { useActiveLocation } from "@/lib/activeLocation";
import { useApiQuery } from "@/lib/useApi";
import { cn } from "@/lib/cn";
import { VenueSheet } from "./VenueSheet";

/**
 * The phone's header — the large-title pattern (docs/mobile.md section 8, rule 5).
 *
 *   top-level page                          record (an order, a customer)
 *   Page name                [＋ ⋯]         (←) Record title            [＋ ⋯]
 *   Venue name ▾
 *
 * Two pieces:
 *
 * 1. The HEADER, in the page's flow: the title at 28/700 (−0.02em) with the
 *    venue under it (14px muted, a chevron, opens the venue picker), and the
 *    page's actions to the right as 40px round icon buttons grouped in one white
 *    pill (`#os-page-actions-mobile`, which PageShell portals into). A page with
 *    a way back — a record — gets PageShell's 40px round back button
 *    (`#os-page-back-mobile`) and its own title at 22/700
 *    (`#os-page-title-mobile`) in place of the destination's name; a Settings
 *    section gets the round chevron that opens the list of sections. Which of
 *    these applies is read from the DOM by CSS (`group-has-`), so PageShell
 *    does not have to tell the shell anything.
 *
 * 2. The COMPACT bar, 44px (`--os-phone-bar`), sticky at the very top and
 *    overlapping the head of the header (it takes no height of its own). It is
 *    invisible and inert until the header has scrolled out of view; then it
 *    fades in with the title centred at 16/600, the back button if the page has
 *    one, and the hairline (`data-scrolled`) — Apple's rule that a bar gains its
 *    separator only when content passes under it. The state is a fact about the
 *    scroll position, so it is written straight onto the node from the
 *    IntersectionObserver callback: no React state to set.
 *
 * Anything sticky further down a phone page pins to `--os-phone-bar`.
 *
 * The titles are <p>s, not headings — the page's own <h1> renders in the content
 * below (or, on a record, stands down to a screen-reader-only heading).
 */

/* 28/700 with a 40px line, so a one-line title centres on the 40px action
   pill. A record (a back button in the header) or a Settings section steps down
   to 22 — no step on the scale, hence the exceptions. */
const TITLE = "min-w-0 truncate font-bold leading-10 tracking-title text-fg";
/* A record (an order, a customer: PageShell has filled the back slot) is not
   venue navigation, so the venue line under its title stands down. */
const ON_RECORD_HIDE = "group-has-[#os-page-back-mobile:not(:empty)]/head:hidden";
const TITLE_TOP = "text-3xl group-has-[#os-page-back-mobile:not(:empty)]/head:text-[22px]"; // ds-exception: 22px record title, docs/mobile.md section 8; no step between xl and 2xl
const TITLE_SECTION = "text-[22px]"; // ds-exception: 22px section title, docs/mobile.md section 8; no step between xl and 2xl

export function PhoneBar({
  pageName,
  isSettings,
  venueScoped,
}: {
  pageName: string;
  isSettings: boolean;
  venueScoped: boolean;
}) {
  const t = useTranslations("nav");
  const bar = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const [venuesOpen, setVenuesOpen] = useState(false);

  useEffect(() => {
    const barEl = bar.current;
    const headEl = head.current;
    if (!barEl || !headEl) return;
    /* The bar is 44px tall (--os-phone-bar): the header is "out of view" once
       its bottom edge has passed under it. rootMargin shrinks the viewport's top
       by that much, so isIntersecting flips exactly there. */
    const io = new IntersectionObserver(
      ([e]) => {
        const compact = !e.isIntersecting && e.boundingClientRect.top < 44;
        barEl.toggleAttribute("data-compact", compact);
        barEl.toggleAttribute("data-scrolled", compact);
        barEl.inert = !compact;
      },
      { rootMargin: "-44px 0px 0px 0px" },
    );
    io.observe(headEl);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {/* The compact bar. Sticky, with a negative bottom margin the height of
          itself: it floats over the header's first 44px instead of pushing the
          page down. */}
      <div
        ref={bar}
        data-os-bar="phone-compact"
        inert
        className="group/compact sticky top-0 z-30 -mb-11 grid h-[var(--os-phone-bar)] shrink-0 grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-tight border-b border-transparent bg-card/90 px-gutter opacity-0 backdrop-blur-md transition-[opacity,border-color] duration-standard motion-reduce:transition-none data-[compact]:border-hairline data-[compact]:opacity-100 md:hidden dark:bg-surface/90"
      >
        <div id="os-page-back-compact" className="col-start-1 flex items-center empty:hidden" />
        <p
          aria-hidden
          className="col-start-2 min-w-0 truncate text-center text-md font-semibold text-fg"
        >
          <span id="os-page-title-compact" className="empty:hidden" />
          <span className="group-has-[#os-page-title-compact:not(:empty)]/compact:hidden">{pageName}</span>
        </p>
      </div>

      <div
        ref={head}
        data-os-bar="phone"
        className="group/head flex shrink-0 items-start gap-tight bg-card px-gutter pb-2 pt-2 md:hidden dark:bg-surface"
      >
        {/* A page with a way back puts it here (PageShell's BarBack), and
            Settings' section chevron steps aside — see `peer`. */}
        <div id="os-page-back-mobile" className="peer flex shrink-0 items-center empty:hidden" />
        {isSettings && (
          <Link
            href="/settings"
            aria-label={t("settingsSections")}
            data-settings-back-phone
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-card text-fg transition-colors duration-quick before:absolute before:-inset-0.5 before:content-[''] active:bg-muted-wash peer-[:not(:empty)]:hidden"
          >
            <ChevronLeft size={22} strokeWidth={1.75} aria-hidden />
          </Link>
        )}

        <BarTitle pageName={pageName} isSettings={isSettings} venueScoped={venueScoped} onOpenVenues={() => setVenuesOpen(true)} />

        {/* A phone has no picker in the bar: this says a preview is running, and ends it. */}
        <PreviewChip />
        <div
          id="os-page-actions-mobile"
          className="flex shrink-0 items-center rounded-full border border-line bg-card p-px empty:hidden"
        />
      </div>
      {/* Outside both bars: the compact bar is a z-30 stacking context and the
          dock is z-30 too, later in the page — a sheet inside would sit under it. */}
      {venueScoped && <VenueSheet open={venuesOpen} onClose={() => setVenuesOpen(false)} />}
    </>
  );
}

/**
 * The title block: the destination's name (or, on a record, the record's own
 * title, portalled into `#os-page-title-mobile`), and on a venue-scoped page the
 * venue the console is looking at.
 *
 * With two or more venues the venue line is one 44px button that opens the
 * picker — a real target, not a 16px line stretched by a pseudo-element (which
 * a hit test and a thumb both miss); the 44px is paid for with negative margins,
 * so it takes 20px of the header. With one venue the name is just said (a
 * chooser with one option is furniture). Until the venues have arrived the line
 * holds its height so the title does not jump.
 */
function BarTitle({
  pageName,
  isSettings,
  venueScoped,
  onOpenVenues,
}: {
  pageName: string;
  isSettings: boolean;
  venueScoped: boolean;
  onOpenVenues: () => void;
}) {
  const t = useTranslations("nav");
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const locations = locationsQ.data?.data ?? [];
  const { location } = useActiveLocation(locations);
  const size = cn(TITLE, isSettings ? TITLE_SECTION : TITLE_TOP);
  const title = (
    <>
      {/* A record's own title, when PageShell has one to put here; the
          destination's name stands in until then and on every other page. */}
      <p id="os-page-title-mobile" className={cn(size, "empty:hidden")} />
      <p className={cn(size, "group-has-[#os-page-title-mobile:not(:empty)]/head:hidden")}>{pageName}</p>
    </>
  );
  if (!venueScoped) return <div className="flex min-w-0 flex-1 flex-col justify-center">{title}</div>;
  if (!location || locations.length < 2) {
    return (
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {title}
        {location ? <p className={cn("truncate text-base leading-5 text-muted", ON_RECORD_HIDE)}>{location.name}</p> : <span aria-hidden className={cn("block h-5", ON_RECORD_HIDE)} />}
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col items-start justify-center">
      {title}
      <button
        type="button"
        onClick={onOpenVenues}
        aria-haspopup="dialog"
        data-bar-venue
        className={cn("-my-3 flex min-h-11 max-w-full items-center rounded-md text-left text-base leading-5 text-muted transition-colors duration-quick active:text-fg", ON_RECORD_HIDE)}
      >
        <span className="sr-only">{t("venueNow", { name: location.name })}</span>
        <span aria-hidden className="truncate">{location.name}</span>
        <ChevronDown size={14} strokeWidth={2} aria-hidden className="ml-1 shrink-0" />
      </button>
    </div>
  );
}
