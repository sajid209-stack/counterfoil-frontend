"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { MD, useMediaQuery } from "@/lib/useMedia";

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
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Words only — ids stay out. Each crumb carries the path up to it, so the
  // trail can lead back up: a settings record's crumb returns to its list,
  // which is where someone who opened the record came from.
  const crumbs = pathname
    .split("/")
    .flatMap((s, i, parts) => (s && /^[a-z-]+$/.test(s) ? [{ label: s.replace(/-/g, " "), href: parts.slice(0, i + 1).join("/") }] : []));

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
  // The slots are read the same way, and for the same reason: they are DOM
  // rendered by OsShell above this in the tree, they exist for the life of the
  // shell, and they never change identity — so subscribe is a no-op and the
  // snapshot is just the node. getElementById returns the same object on every
  // call, which is what keeps the snapshot stable enough for the hook.
  const slot = useSyncExternalStore(noSubscribe, () => document.getElementById("os-page-header"), () => null);
  const actionSlot = useSyncExternalStore(noSubscribe, () => document.getElementById("os-page-actions"), () => null);

  // Text only. The actions travel separately on desktop, because sharing a row
  // with the title squeezed it to 275px and wrapped the operator's name onto
  // two lines.
  // Below md the OS bar names the page, so the trail would say it twice — and
  // the trail is the more expensive of the two, costing a whole line on the
  // screen with the least of them. Desktop keeps it: there the bar carries the
  // title rather than the destination, so the path is the only thing saying
  // where in Settings you are.
  const headerText = (
    <div className="min-w-0">
      {/* Only with two or more levels. A one-word trail — DASHBOARD, ORDERS,
          CALENDAR — restates the rail item that is lit up beside it and costs
          the bar a whole line to do it. A deeper trail (SETTINGS / DEVICES)
          says where in a section you are, and its crumbs link back up. */}
      {wide && crumbs.length > 1 && (
        <p className="mb-inline font-mono text-[12px] uppercase tracking-wide text-muted">
          {crumbs.map((c, i) => (
            <span key={c.href}>
              {i > 0 && " / "}
              {/* Linked only inside Settings, where every level of the path is a
                  real page; elsewhere a word in a path (/reports) need not be. */}
              {c.href !== pathname && (c.href === "/settings" || c.href.startsWith("/settings/")) ? (
                <Link href={c.href} className="transition-colors duration-quick hover:text-fg hover:underline">
                  {c.label}
                </Link>
              ) : (
                c.label
              )}
            </span>
          ))}
        </p>
      )}
      {/* References and long names must wrap, never bleed out of the header.
          22px below sm: the bar above already names the destination, so the
          heading here is a second statement of it at the top of a screen that
          has the least room for one. */}
      <h1 className="type-h1 break-words text-[22px] sm:text-[28px]">{title}</h1>
      {description && (
        /* Orientation prose, read once. On a phone it was costing two lines
           above the fold on every visit, so it is kept for a screen reader and
           shown from sm, where there is room for it. */
        <p className="type-body mt-inline max-w-2xl text-[13px] text-muted max-sm:sr-only">
          {description}
        </p>
      )}
    </div>
  );

  return (
    /* The page edge is the gutter token — 16 on a phone, 20 from sm — and
       the desktop bar above uses the same token, so the title and the cards
       share one left edge. */
    <div className="px-gutter pb-gutter pt-section md:pt-0">
      {/* Desktop: both blocks portal into the sticky bar. Below md they render
          here instead — one copy, either way. */}
      {wide && slot && createPortal(headerText, slot)}
      {wide && actions && actionSlot && createPortal(actions, actionSlot)}
      {!wide && (
        <div className="flex flex-col gap-tight">
          {headerText}
          {actions && <div className="flex flex-wrap items-center gap-tight">{actions}</div>}
        </div>
      )}
      <div className="mt-section md:mt-gutter">{children}</div>
    </div>
  );
}
