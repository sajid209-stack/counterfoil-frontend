"use client";

import { usePathname } from "next/navigation";
import PosScreen from "./PosScreen";

/** The till is mounted HERE, not in `page.tsx`.
 *
 *  `/pos` and `/pos/cart` are two real routes over one sale. A Next layout
 *  stays mounted while you move between its child routes; a page is unmounted
 *  and rebuilt. The sale — the lines, the customer, the discount, the coupon,
 *  the pass, the points, the advance, and the capacity this till is currently
 *  holding — is one component's worth of state, derivation and checkout, so
 *  mounting it once here is what lets the cart be a route rather than a popup
 *  without that state having to survive an unmount.
 *
 *  The honest cost: `pos/page.tsx` and `pos/cart/page.tsx` exist to declare
 *  the routes and render nothing. The alternative is lifting the sale into a
 *  provider, which is a refactor of the money path rather than of routing, and
 *  which can happen later without these URLs moving again.
 *
 *  `/pos/complete` and `/pos/payment` are ordinary child routes and are
 *  rendered normally. */
export default function PosLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/pos" || path === "/pos/cart") {
    return <PosScreen view={path === "/pos/cart" ? "cart" : "grid"} />;
  }
  return <>{children}</>;
}
