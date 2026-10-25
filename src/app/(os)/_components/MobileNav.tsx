"use client";

import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getStaff, listLocations, listRoles } from "@/lib/api";
import { useActiveLocation } from "@/lib/activeLocation";
import { DEMO_STAFF_ID } from "@/lib/session";
import { cn } from "@/lib/cn";
import { useWaitingTotal } from "./navBadges";
import { MenuBody } from "./mobile/MenuBody";
import { BusinessTile, PhoneSheet, PhoneSheetHead } from "./mobile/PhoneSheet";
import { initialsOf } from "./mobile/shared";

/**
 * The phone's way around — a round menu button at the bottom-left, and the
 * full-height sheet it opens.
 *
 * It replaces the old five-tab bar and its More sheet. Shopify admin's phone
 * app has the same shape: the top bar says where you are, and everything else
 * — every destination, the other apps, Settings, the account — is one thumb
 * reach away in a single sheet, rather than four favourite pages on a bar and
 * the rest behind a fifth button.
 *
 * The button is 52px, frosted (the chrome at 90% over a blur) with a hairline
 * ring and a soft float, and sits 12px off the corner plus the device's safe
 * area, so a home indicator never covers it. Its top is 68px up — exactly where
 * the sticky save bars already sit — and every page reserves `--os-fab-clear`
 * at its foot, so it never covers a last row either. When a refund or a
 * write-off is waiting at the venue it wears a small ink dot, and its name says
 * so: a menu you can see needs something from you is a menu you open.
 *
 * It is on the LEFT because the right-hand side of a phone's bottom edge is
 * where a page's own floating action lands, and a thumb reaching for the menu
 * should not have to pass one.
 */
export function MenuButton({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  const t = useTranslations("nav");
  const waiting = useWaitingTotal();
  /* It rides over the start of list rows, so it steps aside while the page is
     being read: hidden on a scroll DOWN, back on a scroll UP and at either end
     of the page. The state is worked out in the scroll handler (never in an
     effect body); the effect only subscribes. On a phone the window scrolls;
     the frame's own scroller is md and up, where this button is not drawn. */
  const [away, setAway] = useState(false);
  const lastY = useRef(0);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const doc = document.documentElement;
      const atTop = y < 24;
      const atBottom = y + window.innerHeight >= doc.scrollHeight - 24;
      const dy = y - lastY.current;
      /* While it holds the focus it stays: a keyboard user scrolling with it
         focused must not lose it. */
      if (atTop || atBottom || document.activeElement === ref.current) setAway(false);
      else if (dy > 6) setAway(true);
      else if (dy < -6) setAway(false);
      if (Math.abs(dy) > 6 || atTop || atBottom) lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      onFocus={() => setAway(false)}
      aria-label={waiting > 0 ? t("menuWaiting", { count: waiting }) : t("menu")}
      aria-haspopup="dialog"
      aria-expanded={open}
      data-menu-button
      data-away={away || undefined}
      data-waiting={waiting > 0 ? waiting : undefined}
      className={cn(
        "fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-[calc(12px+env(safe-area-inset-left))] z-30 flex h-13 w-13 items-center justify-center rounded-full bg-chrome/90 text-fg shadow-float ring-1 ring-line backdrop-blur transition-[transform,opacity] duration-standard active:scale-95 motion-reduce:transition-none md:hidden",
        away && !open && "pointer-events-none translate-y-[calc(100%+24px)] opacity-0 focus-visible:pointer-events-auto",
      )}
    >
      <Menu size={24} strokeWidth={1.5} aria-hidden />
      {/* Something is waiting. Ink, not orange — orange means act, and this only
          says there is something to look at; the ring cuts it out of the button. */}
      {waiting > 0 && <span aria-hidden data-menu-dot className="absolute right-2 top-2 h-2 w-2 rounded-full bg-fg ring-2 ring-chrome" />}
    </button>
  );
}

/**
 * The sheet. Mounted by the shell, but its body only exists while it is open,
 * so the account queries are not paid for on every page of every phone.
 */
export function MobileNav({ open, onClose, business }: { open: boolean; onClose: () => void; business?: string }) {
  if (!open) return null;
  return <MenuSurface onClose={onClose} business={business} />;
}

function MenuSurface({ onClose, business }: { onClose: () => void; business?: string }) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const [venuesOpen, setVenuesOpen] = useState(false);

  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const locations = locationsQ.data?.data ?? [];
  const { location } = useActiveLocation(locations);
  const meQ = useApiQuery(() => getStaff(DEMO_STAFF_ID), []);
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const me = meQ.data;
  const role = me ? rolesQ.data?.data.find((r) => r.id === me.roleId)?.name : undefined;

  return (
    <PhoneSheet
      open
      /* Escape closes the top layer: the venue picker if it is up, else the menu. */
      onClose={() => (venuesOpen ? setVenuesOpen(false) : onClose())}
      label={t("menu")}
      /* Full height: the menu is a place you go, not a note over the page. */
      className="h-[calc(100dvh-0.5rem)]"
      head={
        <PhoneSheetHead
          tile={<BusinessTile initials={initialsOf(business)} />}
          title={business ?? "Counterfoil"}
          sub={locationsQ.data ? t("menuHeadSub", { count: locations.length }) : <Skeleton className="h-3 w-28" />}
          onClose={onClose}
          closeLabel={tCommon("close")}
        />
      }
    >
      <MenuBody
        data={{ locations, location, me, role }}
        onClose={onClose}
        venuesOpen={venuesOpen}
        setVenuesOpen={setVenuesOpen}
      />
    </PhoneSheet>
  );
}
