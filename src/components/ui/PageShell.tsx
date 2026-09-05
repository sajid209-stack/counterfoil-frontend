"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
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
  const crumbs = pathname
    .split("/")
    .filter((s) => s && /^[a-z-]+$/.test(s)) // words only — ids stay out
    .map((s) => s.replace(/-/g, " "));

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
  const headerText = (
    <div className="min-w-0">
      {crumbs.length > 0 && (
        <p className="mb-inline font-mono text-[12px] uppercase tracking-wide text-muted">
          {["os", ...crumbs].join(" / ")}
        </p>
      )}
      {/* References and long names must wrap, never bleed out of the header. */}
      <h1 className="type-h1 break-words text-[28px]">{title}</h1>
      {description && (
        <p className="type-body mt-inline max-w-2xl text-[13px] text-muted">
          {description}
        </p>
      )}
    </div>
  );

  return (
    <div className="px-section pb-section pt-section sm:px-major sm:pb-major md:pt-0">
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
      <div className="mt-section md:mt-major">{children}</div>
    </div>
  );
}
