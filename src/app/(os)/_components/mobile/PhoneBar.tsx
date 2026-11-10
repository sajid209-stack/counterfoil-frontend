"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Bell, ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { PreviewChip } from "@/components/screens";
import { cn } from "@/lib/cn";
import { useWaitingTotal } from "../navBadges";
import { getStaff } from "@/lib/api";
import { useApiQuery } from "@/lib/useApi";
import { DEMO_STAFF_ID } from "@/lib/session";
import { initialsOf } from "./shared";

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
 *    venue under it (14px muted, a chevron, opens the venue picker), and to the
 *    right the bell (activity) and your profile, two 40px circles. The page's
 *    own actions are NOT here (v8): PageShell puts them at the right end of the
 *    page's first toolbar row (`PhoneActionsSlot`). A page with
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
const TITLE_TOP = "text-3xl group-has-[#os-page-back-mobile:not(:empty)]/head:text-[22px]"; // ds-exception: 22px record title, docs/mobile.md section 8; no step between xl and 2xl
const TITLE_SECTION = "text-[22px]"; // ds-exception: 22px section title, docs/mobile.md section 8; no step between xl and 2xl

export function PhoneBar({ pageName, isSettings }: { pageName: string; isSettings: boolean }) {
  const t = useTranslations("nav");
  const bar = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const waiting = useWaitingTotal();
  const meQ = useApiQuery(() => getStaff(DEMO_STAFF_ID), []);
  const me = meQ.data;

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

      {/* The header (docs/mobile.md section 8, v7): one row — the way back on a
          record, the page's title, then the bell and the page's orange action.
          No search and no venue here: the venue is chosen in the menu, and a
          phone header that carries three tools before the title is the
          clutter it was asked to lose. */}
      <div
        ref={head}
        data-os-bar="phone"
        className="group/head flex min-h-14 shrink-0 items-center gap-tight bg-card px-gutter pb-2 pt-2 md:hidden dark:bg-surface"
      >
        {/* A page with a way back puts it here (PageShell's BarBack), and
            Settings' section chevron steps aside — see `peer`. */}
        <div id="os-page-back-mobile" className="peer flex shrink-0 items-center empty:hidden" />
        {isSettings && (
          <Link
            href="/settings"
            aria-label={t("settingsSections")}
            data-settings-back-phone
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-card border border-line bg-card text-fg transition-colors duration-quick before:absolute before:-inset-0.5 before:content-[''] active:bg-muted-wash peer-[:not(:empty)]:hidden"
          >
            <ChevronLeft size={22} strokeWidth={1.75} aria-hidden />
          </Link>
        )}
        <BarTitle pageName={pageName} isSettings={isSettings} />
        {/* A phone has no picker in the bar: this says a preview is running, and ends it. */}
        <PreviewChip />
        {/* What has happened lately, as a bell (it is the activity log): an ember
            dot when something waits for a decision (a refund or a write-off). */}
        <Link
          href="/activity"
          aria-label={waiting > 0 ? t("activityWaiting", { count: waiting }) : t("activityLog")}
          data-bar-activity
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-card text-fg transition-colors duration-quick before:absolute before:-inset-0.5 before:content-[''] active:bg-muted-wash"
        >
          <Bell size={20} strokeWidth={1.75} aria-hidden />
          {waiting > 0 && <span aria-hidden className="absolute right-2 top-2 h-2 w-2 rounded-full bg-ember-solid ring-2 ring-card" />}
        </Link>
        {/* You: your profile, the same size as the bell. A page's own actions are
            not up here; they end its first toolbar row (PhoneActionsSlot). */}
        <Link
          href="/settings/profile"
          aria-label={me ? t("profileOf", { name: me.name }) : t("myProfile")}
          data-bar-profile
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-inverse text-sm font-semibold text-inverse-fg transition-opacity duration-quick before:absolute before:-inset-0.5 before:content-[''] active:opacity-80"
        >
          {me ? initialsOf(me.name) : ""}
        </Link>
      </div>
      {/* Outside both bars: the compact bar is a z-30 stacking context and the
          dock is z-30 too, later in the page — a sheet inside would sit under it. */}
    </>
  );
}

/** The page's title: the destination's name, or a record's own title portalled into `#os-page-title-mobile`. */
function BarTitle({ pageName, isSettings }: { pageName: string; isSettings: boolean }) {
  const size = cn(TITLE, isSettings ? TITLE_SECTION : TITLE_TOP);
  return (
    <div className="min-w-0 flex-1">
      <p id="os-page-title-mobile" className={cn(size, "empty:hidden")} />
      <p className={cn(size, "group-has-[#os-page-title-mobile:not(:empty)]/head:hidden")}>{pageName}</p>
    </div>
  );
}
