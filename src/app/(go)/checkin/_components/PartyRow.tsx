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
 * The action slot sizes to its content and is right-aligned, so a short "Check in"
 * button and a long "Take ৳1,537.50" both sit against the menu.
 * ONE right-hand slot: the action when there is something to do ("Check in 2",
 * "+1", "Take ৳1,537.50"), the status when there is not ("All in", "No-show").
 * A "Not in yet" pill beside a "Check in" button said the same thing twice and
 * cost the name 9rem, which is what truncated the booking code. The avatar
 * carries the state at a glance; a part-arrived party says "1 of 2 in" under
 * its name. The head count left its own column for the same reason.
 */
const RAIL_COLS = "rail:grid rail:grid-cols-[2.5rem_minmax(0,1fr)_auto_2.25rem] rail:items-center rail:gap-x-comfortable";

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
 * The row sits inside one white card that the parent draws, with the session
 * subheaders; rows are separated by hairlines and carry no background of their
 * own. The session time is not repeated here (the subheader says it).
 *
 * Desktop: one line in fixed columns: avatar, name with facts, the one primary
 * action (auto width, right-aligned) and the "..." menu. When a party is fully in
 * (or did not come) the action slot shows quiet status text instead.
 *
 * Phone: one line too: avatar, name with facts, then the check-in or +1 button
 * (or the status text), then the menu. Only when money is owed does the "Take"
 * button, whose label is wide, move to a second line under the text, full width.
 *
 * The name leads and wraps on a phone (it is what a steward matches against the
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

  /* Quiet status text, not a pill. Money owed outranks the arrival state: it is
     the thing a steward has to act on before anyone walks through. */
  const quiet = (tone: string, text: string, icon?: React.ReactNode, clip?: boolean) => (
    <span data-status className={cn("inline-flex items-center gap-inline whitespace-nowrap text-sm font-medium", clip && "max-w-full", tone)}>
      {icon}
      {clip ? <span className="truncate">{text}</span> : text}
    </span>
  );
  const status =
    p.state === "noshow"
      ? quiet("text-danger", p.booking.noShowReason ? t("noShowTagReason", { reason: p.booking.noShowReason }) : t("noShowTag"), undefined, true)
      : p.due > 0
        ? quiet("text-fg-secondary", t("owes", { amount: formatMoney(p.due) }))
        : p.state === "in"
          ? quiet("text-success", t("allIn"), <Check size={14} strokeWidth={2.5} aria-hidden />)
          : p.state === "partial"
            ? quiet("text-fg-secondary", t("inOfTotal", { done: p.arrived, total: p.size }))
            : quiet("text-fg-secondary", t("filterNotIn"));

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

  /* The one primary action, or nothing. Auto width everywhere: on a desktop a
     list of these sits one per row, so each is a neutral button with brand
     words; on a phone it shares the line with the name. Only "Take" (money owed,
     a wide label) is solid and, on a phone, full width on its own line. */
  const primaryCls = rail ? "h-9 min-w-28 px-comfortable font-semibold text-brand-foreground" : "h-11 shrink-0 px-comfortable font-semibold text-brand-foreground";
  const look = { variant: "secondary", size: "sm" } as const;
  const takeLook = rail ? look : ({ variant: "primary", size: "sm" } as const);
  const primary =
    p.state === "noshow" ? null : p.due > 0 ? (
      <Button {...takeLook} data-primary="take" className={rail ? primaryCls : "h-11 w-full"} onClick={onTake}>
        {t("takeAmount", { amount: formatMoney(p.due) })}
      </Button>
    ) : p.state === "in" ? null : p.state === "partial" ? (
      <Button {...look} data-primary="plusone" className={primaryCls} loading={pending} aria-label={t("plusOneLabel")} onClick={() => onCheckIn(p.arrived + 1)}>
        {t("checkInCount", { count: 1 })}
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
              : "bg-subtle text-fg-secondary ring-1 ring-inset ring-line",
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
          "min-h-16 border-t border-hairline px-section py-comfortable first:border-t-0 hover:bg-nav-hover",
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
        <div data-slot className="flex justify-end">{slot}</div>
        <div className="flex size-9 items-center justify-center rail:[&_button[aria-haspopup=menu]]:size-9!">{menuBtn}</div>
      </li>
    );
  }

  const takeOnOwnLine = p.due > 0 && p.state !== "noshow";
  return (
    <li
      data-party
      data-state={p.state}
      data-scanned={highlighted ? "" : undefined}
      className={cn("flex flex-col gap-comfortable border-t border-hairline px-section py-comfortable first:border-t-0", highlighted && "bg-ember-wash ring-2 ring-inset ring-ember")}
    >
      <div className="flex flex-wrap items-center gap-comfortable">
        {avatar}
        <div className="min-w-24 flex-1">
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
        {/* The check-in / +1 button, or the status, on the same line; the
            "Take" button has a wide label and drops to its own line below. */}
        {/* Slot and menu travel together; on a narrow phone they wrap under the
            name, right-aligned, instead of squeezing it to a word a line. */}
        <div className="ml-auto flex shrink-0 items-center gap-comfortable">
          {!takeOnOwnLine && <div data-slot className="flex shrink-0 items-center">{slot}</div>}
          {menuBtn && <div className="flex size-11 shrink-0 items-center justify-center [&_button[aria-haspopup=menu]]:size-11!">{menuBtn}</div>}
        </div>
      </div>
      {takeOnOwnLine && (
        <div data-slot className="flex pl-13">
          {primary}
        </div>
      )}
    </li>
  );
}
