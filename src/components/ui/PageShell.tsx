"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { cn } from "@/lib/cn";
import { useBarTitle } from "@/lib/barTitle";

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
  const actionSlot = useSyncExternalStore(noSubscribe, () => document.getElementById("os-page-actions"), () => null);

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
    <div className="px-gutter pb-gutter pt-section md:pt-0">
      {/* Desktop: both blocks portal into the sticky bar. Below md they render
          here instead — one copy, either way. */}
      {wide && slot && createPortal(headerText, slot)}
      {wide && actions && actionSlot && createPortal(actions, actionSlot)}
      {!wide && (
        /* The gap goes with the heading: a flex gap between an empty box and
           the page's actions is 8px of stray space. */
        <div className={cn("flex flex-col gap-tight", echoesBar && "max-sm:gap-0")}>
          {headerText}
          {actions && <div className="flex flex-wrap items-center gap-tight">{actions}</div>}
        </div>
      )}
      <div className="mt-section md:mt-gutter">{children}</div>
    </div>
  );
}
