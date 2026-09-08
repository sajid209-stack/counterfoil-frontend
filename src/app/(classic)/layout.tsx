import type { Viewport } from "next";

import { ClassicShell } from "./_components/ClassicShell";

/**
 * The till keeps the zoom lock; OS does not.
 *
 * Go runs as a kiosk app — an accidental pinch mid-transaction is a real
 * incident at a counter, and the surface is built for touch at every width
 * with a 44px floor rather than relying on the browser's zoom. The back
 * office has no such excuse, so `maximumScale` lives here and on
 * `(classic)` rather than at the root, where it was also locking every
 * admin screen and failing WCAG 2.1 SC 1.4.4.
 *
 * Viewport objects merge shallowly from the root down and a key the child
 * omits is INHERITED, not dropped — measured: declaring an OS viewport
 * without `maximumScale` still served `maximum-scale=1`. So the lock has to
 * be added by the surfaces that want it, never removed by the one that
 * does not. That is also why this layout is a server component with the
 * interactive shell underneath: a "use client" file cannot export viewport.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function ClassicLayout({ children }: { children: React.ReactNode }) {
  return <ClassicShell>{children}</ClassicShell>;
}
