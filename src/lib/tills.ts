/* ── The till variants ─────────────────────────────────────────────────────
 *
 * Three designs for the same job, kept side by side so they can be compared on
 * the same catalogue, the same seed and the same money engine rather than from
 * screenshots. They differ in SHAPE, not in what they can sell: each one builds
 * a `CheckoutLine[]` and hands it to the same `checkout()`.
 *
 * One list, read by everything that offers a choice between them — the picker
 * at /tills, the switcher in the Go header, the More sheet and the home page.
 * A variant added here appears in all four; a variant that is not `ready` is
 * shown but not offered, which is better than a link to a page that 404s.
 */

export interface Till {
  id: string;
  /** Two syllables at most — this label sits in a segmented control. */
  short: string;
  name: string;
  /** What is different about it, in the operator's terms. */
  blurb: string;
  href: string;
  ready: boolean;
}

export const TILLS: Till[] = [
  {
    id: "cart",
    short: "Cart",
    name: "Cart till",
    blurb:
      "A wall of bookings with a cart beside it. Each booking opens a sheet over the wall to ask its questions, and the answer lands in the cart — a drawer on a phone, a panel on a tablet.",
    href: "/pos",
    ready: true,
  },
  {
    id: "scroll",
    short: "Scroll",
    name: "Scrolling till",
    blurb:
      "No cart. The sale is the page: each booking stays as a block where it was configured, finished blocks collapse to a line, and the total sits in a bar that never scrolls away.",
    href: "/sell",
    ready: true,
  },
  {
    id: "classic",
    short: "Classic",
    name: "Classic till",
    blurb:
      "The earlier design — bookings as a dense row list with a thumbnail and the price inline, and the chrome, buttons and cards as they were before the September redesign.",
    href: "/classic",
    ready: false,
  },
];

/** Which variant a path belongs to, or null off the tills entirely. */
export function tillFor(pathname: string): Till | null {
  return (
    TILLS.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`)) ?? null
  );
}
