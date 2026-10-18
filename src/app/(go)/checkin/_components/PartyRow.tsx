"use client";

import { useTranslations } from "next-intl";
import { CalendarClock, RotateCcw, User, Users } from "lucide-react";
import { ActionMenu, Button, type ActionMenuItem } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { Thumb } from "../../_components/Thumb";
import type { Party } from "../_lib/parties";

/**
 * One party at the door.
 *
 * The name leads and WRAPS — it is what a steward matches against the person in
 * front of them, so it is never cut off. Under it, quietly: how many people and
 * how many are in, then the booking code in mono on its own line (it is an
 * identifier, and after a "·" it wrapped to a line starting with a dot).
 *
 * The right-most thing in the row is ONE orange button, on every row, in the
 * same place — the till's rule: the button that moves things on is bottom-right.
 * It says the money when money is owed ("Take ৳1,537.50"), otherwise "Check in"
 * (or "+1" when part of the party is already in). Everything else is behind the
 * menu to its left, so a steward who cannot read the words still learns "orange,
 * on the right" once.
 */
export function PartyRow({
  party: p,
  pending,
  refundAsked,
  moveAsked,
  menu,
  menuLabel,
  onTake,
  onCheckIn,
}: {
  party: Party;
  pending: boolean;
  refundAsked: boolean;
  moveAsked: boolean;
  menu: ActionMenuItem[];
  menuLabel: string;
  onTake: () => void;
  onCheckIn: (count: number) => void;
}) {
  const t = useTranslations("checkin");
  const remaining = p.size - p.arrived;

  return (
    <li data-party data-state={p.state} className="card-surface flex flex-wrap items-center gap-x-comfortable gap-y-tight p-comfortable">
      <Thumb
        glyph={p.size > 1 ? <Users strokeWidth={1.5} /> : <User strokeWidth={1.5} />}
        className={p.state === "in" ? "bg-success-wash text-success" : undefined}
      />
      {/* On the narrowest phones the actions drop under the name, right-aligned
          — still the last thing on the row — instead of squeezing the name into
          a column three letters wide. */}
      <div className="min-w-24 flex-1">
        <p className={cn("break-words text-md font-semibold text-fg", p.nameIsReference && "font-mono text-base")}>{p.name || t("walkInDefaultName")}</p>
        <p className="mt-inline flex flex-wrap items-center gap-x-tight gap-y-inline text-sm text-muted">
          <span>{t("guests", { count: p.size })}</span>
          {p.arrived > 0 && p.state !== "in" && <span>· {t("inOfTotal", { done: p.arrived, total: p.size })}</span>}
          {refundAsked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-wash px-tight font-medium text-fg">
              <RotateCcw size={12} strokeWidth={2.25} aria-hidden />
              {t("refundAsked")}
            </span>
          )}
          {moveAsked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-wash px-tight font-medium text-fg">
              <CalendarClock size={12} strokeWidth={2.25} aria-hidden />
              {t("moveAsked")}
            </span>
          )}
        </p>
        {/* The code on its own line: it is what a guest reads off their phone. */}
        {!p.nameIsReference && p.reference && <p className="mt-inline break-all font-mono text-sm text-muted">{p.reference}</p>}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-tight">
        {menu.length > 0 && <ActionMenu shape="go" items={menu} label={menuLabel} />}
        {p.state === "noshow" ? (
          <span className="rounded-full bg-danger-wash px-comfortable py-inline text-sm font-semibold text-danger">
            {p.booking.noShowReason ? t("noShowTagReason", { reason: p.booking.noShowReason }) : t("noShowTag")}
          </span>
        ) : p.due > 0 ? (
          <Button data-primary="take" onClick={onTake}>
            {t("takeAmount", { amount: formatMoney(p.due) })}
          </Button>
        ) : p.state === "in" ? (
          <span className="inline-flex items-center rounded-full bg-success-wash px-comfortable py-inline text-sm font-semibold text-success">{t("allIn")}</span>
        ) : p.state === "partial" ? (
          <Button data-primary="plusone" loading={pending} aria-label={t("plusOneLabel")} onClick={() => onCheckIn(p.arrived + 1)}>
            {t("plusOne")}
          </Button>
        ) : (
          <Button data-primary="checkin" loading={pending} onClick={() => onCheckIn(p.size)}>
            {p.size > 1 ? t("checkInCount", { count: remaining }) : t("checkIn")}
          </Button>
        )}
      </div>
    </li>
  );
}
