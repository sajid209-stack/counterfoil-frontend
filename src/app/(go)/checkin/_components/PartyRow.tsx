"use client";

import { useTranslations } from "next-intl";
import { CalendarClock, HandCoins, RotateCcw } from "lucide-react";
import { ActionMenu, Button, type ActionMenuItem } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { RequestNotes } from "../../_components/RequestNotes";
import { T } from "../../_components/type";
import type { Party } from "../_lib/parties";

/**
 * The columns of a desktop party row. The list's group headers do not use it,
 * but the row does, and so does anything that wants to line up with it: a fixed
 * grid, so the status, the one primary action and the "..." menu sit in the
 * same place on every row whatever the row happens to hold.
 *
 *   [ name + code ] [ people ] [ status ] [ primary action ] [ menu ]
 */
const RAIL_COLS = "rail:grid rail:grid-cols-[minmax(0,1fr)_5.5rem_9rem_9rem_2.25rem] rail:items-center rail:gap-x-comfortable";

/**
 * One party at the door (docs/pos-desktop.md section 8, "the arrivals list").
 *
 * Desktop: one 52px line on white with a hairline above it, in fixed columns.
 * The session time is NOT repeated here (the group header above says it). The
 * right-most column is always the "..." menu and the one before it always holds
 * the one primary action, in a fixed width, so a steward's eye and hand learn
 * both places once. When a party is fully in (or did not come) the primary slot
 * is left empty but kept, so the menu still lines up.
 *
 * Phone: the same facts stacked for width. Name and status on the first line,
 * the code and head count under it, then the action full width with the menu
 * beside it.
 *
 * The name leads and WRAPS on a phone (it is what a steward matches against the
 * person in front of them); on a desktop it truncates and the full name is in
 * the title. The primary button says the money when money is owed
 * ("Take 1,537.50"), otherwise "Check in" ("Check in 2" for a party of more) or
 * "+1" when part of the party is already in.
 */
export function PartyRow({
  party: p,
  pending,
  refundAsked,
  writeOffAsked,
  moveAsked,
  menu,
  menuLabel,
  onTake,
  onCheckIn,
  rail = false,
  highlighted = false,
}: {
  party: Party;
  pending: boolean;
  refundAsked: boolean;
  writeOffAsked: boolean;
  moveAsked: boolean;
  menu: ActionMenuItem[];
  menuLabel: string;
  onTake: () => void;
  onCheckIn: (count: number) => void;
  /** The desktop line: one 52px row in fixed columns. */
  rail?: boolean;
  /** The guest a scan just found. */
  highlighted?: boolean;
}) {
  const t = useTranslations("checkin");
  const tr = useTranslations("refunds");
  const remaining = p.size - p.arrived;
  /* Never the booking code as a title: a party with no name is a "Guest" (or a
     "Walk-in" when no order stands behind it) and the code sits under it. */
  const name = p.name || (p.order ? t("guestDefault") : t("walkInDefaultName"));
  const showCode = !!p.reference;

  /* One pill per party. Money owed outranks the arrival state: it is the thing
     a steward has to act on before anyone walks through. */
  const pill = (tone: string, text: string) => (
    <span data-status className={cn("inline-flex max-w-full items-center truncate rounded-full px-comfortable py-inline", T.status, tone)}>{text}</span>
  );
  const status =
    p.state === "noshow"
      ? pill("bg-danger-wash text-danger", p.booking.noShowReason ? t("noShowTagReason", { reason: p.booking.noShowReason }) : t("noShowTag"))
      : p.due > 0
        ? pill("bg-warning-wash text-fg", t("owes", { amount: formatMoney(p.due) }))
        : p.state === "in"
          ? pill("bg-success-wash text-success", t("allIn"))
          : p.state === "partial"
            ? pill("bg-warning-wash text-fg", t("inOfTotal", { done: p.arrived, total: p.size }))
            : pill("bg-subtle text-muted", t("filterNotIn"));

  const marks = (refundAsked || writeOffAsked || moveAsked) && (
    <>
      {refundAsked && (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning-wash px-tight font-medium text-fg">
          <RotateCcw size={12} strokeWidth={2.25} aria-hidden />
          {t("refundAsked")}
        </span>
      )}
      {writeOffAsked && (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning-wash px-tight font-medium text-fg">
          <HandCoins size={12} strokeWidth={2.25} aria-hidden />
          {tr("pos.markers.writeOffAsked")}
        </span>
      )}
      {moveAsked && (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning-wash px-tight font-medium text-fg">
          <CalendarClock size={12} strokeWidth={2.25} aria-hidden />
          {t("moveAsked")}
        </span>
      )}
    </>
  );

  /* The one primary action, or nothing. */
  /* On a desktop a list of these sits one per row, so a solid orange fill on every
     row would be ten primaries on one screen: there it is a 36px neutral button with
     brand words. The phone keeps its solid, full-width button. */
  /* The phone is the same: a 40px neutral button with brand words for the
     ordinary check-in; the solid orange is kept for the one thing that is
     money owed ("Take ..."), so a list of ten still has no ten orange blocks. */
  const primaryCls = rail ? "w-full font-semibold text-brand-foreground" : "h-10 w-full font-semibold text-brand-foreground md:h-10";
  const look = { variant: "secondary", size: "sm" } as const;
  const takeLook = rail ? look : ({ variant: "primary", size: "sm" } as const);
  const primary =
    p.state === "noshow" ? null : p.due > 0 ? (
      <Button {...takeLook} data-primary="take" className={rail ? primaryCls : "h-10 w-full md:h-10"} onClick={onTake}>
        {t("takeAmount", { amount: formatMoney(p.due) })}
      </Button>
    ) : p.state === "in" ? null : p.state === "partial" ? (
      <Button {...look} data-primary="plusone" className={primaryCls} loading={pending} aria-label={t("plusOneLabel")} onClick={() => onCheckIn(p.arrived + 1)}>
        {t("plusOne")}
      </Button>
    ) : (
      <Button {...look} data-primary="checkin" className={primaryCls} loading={pending} onClick={() => onCheckIn(p.size)}>
        {p.size > 1 ? t("checkInCount", { count: remaining }) : t("checkIn")}
      </Button>
    );

  const menuBtn = menu.length > 0 ? <ActionMenu shape="go" items={menu} label={menuLabel} /> : null;

  const justScanned = highlighted && <span className="shrink-0 rounded-full bg-ember-solid px-tight text-sm font-semibold text-on-solid">{t("justScanned")}</span>;

  if (rail) {
    return (
      <li
        data-party
        data-state={p.state}
        data-scanned={highlighted ? "" : undefined}
        className={cn(
          RAIL_COLS,
          "min-h-13 border-t border-line bg-card px-card py-tight first:border-t-0 hover:bg-nav-hover",
          highlighted && "bg-ember-wash ring-2 ring-inset ring-ember hover:bg-ember-wash",
        )}
      >
        <div className="min-w-0">
          <p className={cn("flex min-w-0 items-center gap-tight", T.item)}>
            <span className="min-w-0 truncate" title={name}>{name}</span>
            {justScanned}
          </p>
          <p className={cn("flex min-w-0 flex-wrap items-center gap-x-tight", T.meta)}>
            {showCode && <span className="truncate font-mono font-normal">{p.reference}</span>}
            {marks}
          </p>
          <RequestNotes variant="row" orderId={p.booking.orderId} bookingId={p.booking.id} className="mt-inline flex flex-col gap-inline" />
        </div>
        <span className={cn("whitespace-nowrap", T.meta)}>{t("guests", { count: p.size })}</span>
        <div className="flex min-w-0 justify-start">{status}</div>
        <div className="flex">{primary}</div>
        <div className="flex size-9 items-center justify-center rail:[&_button[aria-haspopup=menu]]:size-9!">{menuBtn}</div>
      </li>
    );
  }

  return (
    <li
      data-party
      data-state={p.state}
      data-scanned={highlighted ? "" : undefined}
      className={cn("flex flex-col gap-tight border-t border-line bg-card px-comfortable py-comfortable first:border-t-0", highlighted && "bg-ember-wash ring-2 ring-inset ring-ember")}
    >
      <div className="flex items-start justify-between gap-tight">
        <div className="min-w-0 flex-1">
          <p className={cn("flex flex-wrap items-center gap-x-tight break-words", T.item)}>
            <span>{name}</span>
            {justScanned}
          </p>
          <p className={cn("mt-inline flex flex-wrap items-center gap-x-tight gap-y-inline", T.meta)}>
            <span>{t("guests", { count: p.size })}</span>
            {p.arrived > 0 && p.state !== "in" && p.due > 0 && <span>· {t("inOfTotal", { done: p.arrived, total: p.size })}</span>}
            {/* The code only when there is no name to go by; otherwise it is in search. */}
            {p.nameIsReference && showCode && <span className="break-all font-mono font-normal">· {p.reference}</span>}
            {marks}
          </p>
          <RequestNotes variant="row" orderId={p.booking.orderId} bookingId={p.booking.id} className="mt-inline flex flex-col gap-inline" />
        </div>
        <div className="shrink-0">{status}</div>
      </div>
      {(primary || menuBtn) && (
        <div className="flex items-center gap-tight">
          <div className="flex min-w-0 flex-1">{primary}</div>
          <div className="flex size-10 shrink-0 items-center justify-center [&_button[aria-haspopup=menu]]:size-10!">{menuBtn}</div>
        </div>
      )}
    </li>
  );
}
