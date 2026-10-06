"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { cn } from "@/lib/cn";
import { useBarTitle } from "@/lib/barTitle";
import { Button } from "./Button";

/**
 * A page's one create action.
 *
 * Separate from `actions` because the two want different room. On a phone a
 * full-width "Add to your catalog" is 151px of a 358px line, on a page that
 * already spends 451px before its first row — so the primary moves into the
 * top bar as a plus, beside the account button, and its words become its
 * accessible name. Secondary controls stay on the page, which is
 * `overflow-menu`: cram nothing into a bar that cannot hold it.
 *
 * A page declares it rather than PageShell guessing which of its buttons is
 * the important one.
 */
export interface PagePrimary {
  label: string;
  /** Defaults to a plus, which is what every one of these is. */
  icon?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  /** Passed through to the desktop button — a keyboard shortcut hint. */
  title?: string;
  keyShortcut?: string;
}

// Standard page frame for OS screens: breadcrumb (derived from the path),
// title, optional description, actions slot.
//
// On desktop the header block is PORTALLED into the sticky glass bar
// (#os-page-header, rendered by OsShell) rather than drawn under it. The Aura
// reference puts the page title inside its sticky header, and Counterfoil was
// spending 183px on a 56px bar whose left 737px were empty plus a separate
// header beneath it. Same content, one bar.
//
// Below md the bar is a 40px logo strip with no room for a three-line header,
// so the block renders inline there instead. Both branches render the SAME
// JSX from the same props — the header has one definition, shown in one of two
// places depending on how much room the viewport has.
/** A store that never changes: subscribing to it is a no-op. */
const noSubscribe = () => () => {};

export function PageShell({
  title,
  description,
  actions,
  primary,
  back,
  status,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  primary?: PagePrimary;
  /** A way back to the list this page belongs to. Left of the header row. */
  back?: { href: string; label: string };
  /** The record's state (an order's pill). Beside the back link, left of the header row. */
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Resolved after mount: the slot lives in OsShell, above this in the tree,
  // so it exists by the time effects run. Null on the first paint and on any
  // page that renders a PageShell outside the OS shell — which is why the
  // mobile copy is the unconditional one and this is the enhancement.

  // Gated on the media query, not just on the slot existing. The desktop bar
  // is display:none below md but still IN the DOM, so portalling whenever the
  // slot resolves rendered a second, invisible copy of every control on a
  // phone — harmless to look at (display:none is out of the a11y tree too) but
  // it is a real duplicate node, and it is the FIRST one in document order, so
  // anything selecting "the location select" got the hidden one. Matching the
  // md breakpoint means exactly one copy exists at any width.
  // Server snapshot false: assume narrow, so the header ships in the document.
  const wide = useMediaQuery(MD);
  const router = useRouter();
  /* The phone's bar names the page; this heading repeats it unless the page
     is a sub-page the bar only knows the section of. */
  const barTitle = useBarTitle();
  const echoesBar = !!barTitle && barTitle.trim() === title.trim();
  // The slots are read the same way, and for the same reason: they are DOM
  // rendered by OsShell above this in the tree, they exist for the life of the
  // shell, and they never change identity — so subscribe is a no-op and the
  // snapshot is just the node. getElementById returns the same object on every
  // call, which is what keeps the snapshot stable enough for the hook.
  const slot = useSyncExternalStore(noSubscribe, () => document.getElementById("os-page-header"), () => null);
  const barSlot = useSyncExternalStore(noSubscribe, () => document.getElementById("os-page-actions-mobile"), () => null);

  const hasRow = !!(back || status || actions || (wide && primary));
  const icon = primary?.icon ?? <Plus size={16} strokeWidth={1.75} />;
  /* Desktop: the words, because there is room for them and a labelled button
     is always the better one. */
  const widePrimary = primary && (
    <Button
      icon={icon}
      /* `Button` is a <button>; an anchor inside one is invalid markup, so a
         destination is pushed. The phone's copy IS a Link, where a long-press
         to open in a new tab is a thing people do. */
      onClick={primary.onClick ?? (primary.href ? () => router.push(primary.href!) : undefined)}
      disabled={primary.disabled}
      title={primary.title}
      aria-keyshortcuts={primary.keyShortcut}
    >
      {primary.label}
    </Button>
  );
  /* Phone: the glyph, in the bar, with the words as its name. 44px, and the
     same corner as the account button it sits beside, so the two read as one
     pair rather than two unrelated controls. */
  const narrowPrimary = primary
    ? (() => {
        const cls = cn(
          "flex h-11 w-11 items-center justify-center rounded-sm bg-ember-solid text-white transition-opacity duration-quick active:opacity-80",
          primary.disabled && "pointer-events-none opacity-40",
        );
        const body = <Plus size={20} strokeWidth={2} aria-hidden />;
        return primary.href && !primary.disabled ? (
          <Link href={primary.href} aria-label={primary.label} className={cls}>
            {body}
          </Link>
        ) : (
          <button type="button" onClick={primary.onClick} aria-label={primary.label} disabled={primary.disabled} className={cls}>
            {body}
          </button>
        );
      })()
    : null;

  // Text only. The actions travel separately on desktop, because sharing a row
  // with the title squeezed it to 275px and wrapped the operator's name onto
  // two lines.
  const headerText = (
    <div className="min-w-0">
      {/* The page's name, and nothing else in the bar.

          The trail went with the owner's review: a one-word trail restated the
          rail item lit beside it, and a two-word one (CATALOG / NEW) restated
          the heading directly under it — for a whole line of the bar, on every
          page. Where a page is somewhere you can go back to, it carries its own
          link back, which a crumb could only duplicate.

          The description went the same way, and stays for a screen reader:
          orientation prose is read once and then scrolls past forever, but it
          is what tells someone arriving by keyboard what this page is for. */}
      {/* On a phone the bar above already says this, so saying it again costs
          77px before any page's own content — on thirty routes. It stands down
          ONLY when the two are the same word: on a sub-page the bar names the
          section ("Catalog") while this names the page ("Add to your
          catalog"), and that one has to stay. It stays in the document either
          way, because a page needs its heading. */}
      <h1 className={cn("type-h1 break-words text-[1.375rem] sm:text-[1.75rem]", echoesBar && "max-sm:sr-only")}>{title}</h1>
      {description && <p className="sr-only">{description}</p>}
    </div>
  );

  return (
    /* The page edge is the gutter token — 16 on a phone, 20 from sm — and
       the desktop bar above uses the same token, so the title and the cards
       share one left edge. */
    <div className={cn("px-gutter pb-gutter pt-section", hasRow ? "md:pt-gutter" : "md:pt-0")}>
      {/* Desktop: the title portals into the sticky bar. Below md they render
          here instead — one copy, either way. */}
      {wide && slot && createPortal(headerText, slot)}
      {/* The plus lives in the phone's bar, beside the account button. */}
      {!wide && narrowPrimary && barSlot && createPortal(narrowPrimary, barSlot)}
      {/* Phone: the heading, unless the bar already said it. */}
      {!wide && <div className={echoesBar ? "max-sm:sr-only" : undefined}>{headerText}</div>}
      {/* The page header row. The bar above is app chrome (page name, venue,
          account); everything that acts on THIS page — its back link, its
          status, its buttons — sits here, at the top of the content, on one
          row that wraps. Back and status on the left, actions and the page's
          create button on the right. On a phone the create button is the bar's
          plus instead, and the actions wrap onto their own line. */}
      {hasRow && (
        <div className={cn("flex flex-wrap items-center justify-between gap-x-major gap-y-tight", !wide && !echoesBar && "mt-tight")}>
          {(back || status) && (
            <div className="flex min-w-0 flex-wrap items-center gap-x-major gap-y-tight">
              {back && (
                <Link href={back.href} className="inline-flex min-h-11 items-center gap-inline text-[13px] text-muted hover:text-fg">
                  <ArrowLeft size={14} strokeWidth={1.5} aria-hidden /> {back.label}
                </Link>
              )}
              {status}
            </div>
          )}
          {(actions || (wide && widePrimary)) && (
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-tight max-md:ml-0 max-md:w-full max-md:justify-start">
              {actions}
              {wide && widePrimary}
            </div>
          )}
        </div>
      )}
      <div className={hasRow ? "mt-gutter" : "mt-section md:mt-gutter"}>{children}</div>
    </div>
  );
}
