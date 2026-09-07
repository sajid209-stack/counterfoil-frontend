"use client";

/* ── Flipping between till designs, in place ───────────────────────────────
 *
 * Comparing three designs from a chooser page means going home between every
 * look, by which time the thing being compared is a memory. This puts them one
 * tap apart, in the chrome, so the same catalogue can be seen three ways
 * without leaving the till.
 *
 * It appears ONLY on a till route. Everywhere else in Go it would be an offer
 * to change something the current screen is not.
 *
 * Hidden below `sm`, where the header has room for the logo and two 44px
 * controls and nothing else. The phone route in is More → Till design, which
 * is the same responsive-by-form-factor rule the nav itself follows.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TILLS, tillFor } from "@/lib/tills";

export function TillSwitcher() {
  const pathname = usePathname();
  const current = tillFor(pathname);
  if (!current) return null;

  return (
    <nav
      aria-label="Till design"
      className="hidden shrink-0 items-center gap-inline rounded-full bg-subtle p-inline sm:flex"
    >
      {TILLS.filter((t) => t.ready).map((t) => {
        const active = t.id === current.id;
        return (
          <Link
            key={t.id}
            href={t.href}
            aria-current={active ? "page" : undefined}
            title={t.name}
            className={`flex h-9 items-center rounded-full px-comfortable text-[13px] transition-colors duration-quick ${
              active ? "bg-card font-medium text-fg shadow-go" : "text-muted hover:text-fg"
            }`}
          >
            {t.short}
          </Link>
        );
      })}
    </nav>
  );
}
