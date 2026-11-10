"use client";

import { useTranslations } from "next-intl";
import { Ban, CalendarClock, Check, HandCoins, RotateCcw } from "lucide-react";
import { ActionMenu, Button, type ActionMenuItem } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { RequestNotes } from "../../_components/RequestNotes";
import { T } from "../../_components/type";
import type { Party } from "../_lib/parties";

/**
 * The columns of a desktop party row: a fixed grid, so the status, the one
 * primary action and the "..." menu sit in the same place on every row
 * whatever the row happens to hold (docs/pos-desktop.md section 8, v2).
 *
 *   [ who ] [ name / size · place · code ] [ action OR status ] [ menu ]
 *
 * ONE right-hand slot: the action when there is something to do ("Check in 2",
 * "+1", "Take ৳1,537.50"), the status when there is not ("All in", "No-show").
 * A "Not in yet" pill beside a "Check in" button said the same thing twice and
 * cost the name 9rem, which is what truncated the booking code. The avatar
 * carries the state at a glance; a part-arrived party says "1 of 2 in" under
 * its name. The head count left its own column for the same reason.
 */
const RAIL_COLS = "rail:grid rail:grid-cols-[2.5rem_minmax(0,1fr)_9.5rem_2.25rem] rail:items-center rail:gap-x-comfortable";

/** Initials for the avatar; a party with no name gets none (the glyph shows). */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

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
  place,
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
  /** Where in the session they are: the lane, field or court, when there is one. */
  place?: string | null;
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

  /* Who, at a glance: the party's initials, and once they are in, a tick in
     the success tint, so a steward scanning the list sees who is through
     before reading a word. A no-show is the danger tint with a stop. */
  const ini = initials(p.name && !p.nameIsReference ? p.name : "");
  const avatar = (
    <span
      aria-hidden
      data-avatar={p.state}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold",
        p.state === "in"
          ? "bg-success-wash text-success"
          : p.state === "noshow"
            ? "bg-danger-wash text-danger"
            : p.state === "partial"
              ? "bg-warning-wash text-fg"
              : "bg-subtle text-fg-secondary",
      )}
    >
      {p.state === "in" ? <Check size={18} strokeWidth={2.5} /> : p.state === "noshow" ? <Ban size={16} strokeWidth={2} /> : ini || "·"}
    </span>
  );

  /* One line of facts under the name, in the order a steward asks them: how
     many, where, which booking. */
  const facts = [
    t("guests", { count: p.size }),
    p.state === "partial" ? t("inOfTotal", { done: p.arrived, total: p.size }) : null,
    place,
  ]
    .filter(Boolean)
    .join(" · ");
  /* The right-hand slot: the action, else the status. */
  const slot = primary ?? status;

  if (rail) {
    return (
      <li
        data-party
        data-state={p.state}
        data-scanned={highlighted ? "" : undefined}
        className={cn(
          RAIL_COLS,
          "min-h-16 border-t border-hairline bg-card px-section py-comfortable first:border-t-0 hover:bg-nav-hover",
          (p.state === "in" || p.state === "noshow") && !highlighted && "[&_[data-name]]:text-fg-secondary",
          highlighted && "bg-ember-wash ring-2 ring-inset ring-ember hover:bg-ember-wash",
        )}
      >
        {avatar}
        <div className="min-w-0">
          <p className={cn("flex min-w-0 items-center gap-tight", T.item)}>
            <span data-name className="min-w-0 truncate" title={name}>{name}</span>
            {justScanned}
          </p>
          {/* One line: the facts never wrap, the code gives way (it truncates,
              and search still finds it). Request marks get their own line. */}
          <p className={cn("mt-0.5 flex min-w-0 items-center gap-x-tight", T.meta)}>
            <span className="shrink-0 whitespace-nowrap">{facts}</span>
            {showCode && (
              <span className="min-w-0 truncate font-mono font-normal" title={p.reference}>
                · {p.reference}
              </span>
            )}
          </p>
          {marks && <p className={cn("mt-inline flex min-w-0 flex-wrap items-center gap-tight", T.meta)}>{marks}</p>}
          <RequestNotes variant="row" orderId={p.booking.orderId} bookingId={p.booking.id} className="mt-inline flex flex-col gap-inline" />
        </div>
        <div data-slot className="flex min-w-0 justify-end">{slot}</div>
        <div className="flex size-9 items-center justify-center rail:[&_button[aria-haspopup=menu]]:size-9!">{menuBtn}</div>
      </li>
    );
  }

  return (
    <li
      data-party
      data-state={p.state}
      data-scanned={highlighted ? "" : undefined}
      className={cn("flex flex-col gap-comfortable border-t border-hairline bg-card px-section py-section first:border-t-0", highlighted && "bg-ember-wash ring-2 ring-inset ring-ember")}
    >
      <div className="flex items-start gap-comfortable">
        {avatar}
        <div className="min-w-0 flex-1">
          <p className={cn("flex flex-wrap items-center gap-x-tight break-words", T.item)}>
            <span data-name>{name}</span>
            {justScanned}
          </p>
          <p className={cn("mt-0.5 flex flex-wrap items-center gap-x-tight gap-y-inline", T.meta)}>
            <span>{facts}</span>
            {/* The code only when there is no name to go by; otherwise it is in search. */}
            {p.nameIsReference && showCode && <span className="break-all font-mono font-normal">· {p.reference}</span>}
            {marks}
          </p>
          <RequestNotes variant="row" orderId={p.booking.orderId} bookingId={p.booking.id} className="mt-inline flex flex-col gap-inline" />
        </div>
        {/* Nothing to do: the status and the menu share the first line, so a
            party that is all in is one line, not a line and a lone "...". */}
        {!primary && (
          <div className="flex shrink-0 items-center gap-tight">
            {status}
            {menuBtn && <div className="flex size-10 items-center justify-center [&_button[aria-haspopup=menu]]:size-10!">{menuBtn}</div>}
          </div>
        )}
      </div>
      {primary && (
        <div className="flex items-center gap-tight pl-13">
          <div data-slot className="flex min-w-0 flex-1">{primary}</div>
          {menuBtn && <div className="flex size-10 shrink-0 items-center justify-center [&_button[aria-haspopup=menu]]:size-10!">{menuBtn}</div>}
        </div>
      )}
    </li>
  );
}
