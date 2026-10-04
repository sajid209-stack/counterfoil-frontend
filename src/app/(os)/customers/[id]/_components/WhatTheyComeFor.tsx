"use client";

import { useTranslations } from "next-intl";
import { CalendarDays, CreditCard, Users } from "lucide-react";
import { formatDay } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import type { CustomerProfile } from "@/lib/customerProfile";
import { Panel } from "./Panel";

/**
 * What they come for — worked out from what they have bought and booked, never
 * typed in. The three bookings they buy most, then what the history agrees on:
 * a usual day and time, a usual group, a usual way to pay.
 *
 * It says so when there is not enough to go on. A "usually Fridays" drawn from
 * two bookings is a coincidence stated as a fact.
 */
export function WhatTheyComeFor({ profile }: { profile: CustomerProfile }) {
  const t = useTranslations("customers");
  const enumL = useEnumLabels();

  const u = profile.usualTime;
  const usualLine = u
    ? u.weekday != null && u.part
      ? t("usuallyDayPart", {
          day: t(`weekdayPlural_${u.weekday}` as "weekdayPlural_0"),
          part: t(`partPlural_${u.part}` as "partPlural_morning"),
        })
      : u.weekday != null
        ? t("usuallyDay", { day: t(`weekdayPlural_${u.weekday}` as "weekdayPlural_0") })
        : t("usuallyPart", { part: t(`partPlural_${u.part}` as "partPlural_morning") })
    : null;

  const facts: { key: string; icon: React.ReactNode; text: string }[] = [];
  if (usualLine) facts.push({ key: "when", icon: <CalendarDays size={16} strokeWidth={1.6} aria-hidden />, text: usualLine });
  if (profile.usualParty != null)
    facts.push({ key: "party", icon: <Users size={16} strokeWidth={1.6} aria-hidden />, text: t("usuallyParty", { count: profile.usualParty }) });
  if (profile.usualPayment)
    facts.push({ key: "pay", icon: <CreditCard size={16} strokeWidth={1.6} aria-hidden />, text: t("usuallyPays", { method: enumL.method(profile.usualPayment) }) });

  return (
    <Panel title={t("comeFor")}>
      {profile.favourites.length > 0 && (
        <ol className="flex flex-col">
          {profile.favourites.map((f, i) => (
            <li key={f.productId} className="flex items-baseline gap-comfortable border-b border-hairline py-comfortable first:pt-0 last:border-0">
              <span aria-hidden className="w-4 shrink-0 text-sm font-semibold text-muted">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 break-words text-sm font-medium text-fg">{f.name}</span>
              <span className="shrink-0 whitespace-nowrap text-right text-[0.8125rem] text-muted">
                {t("timesBought", { count: f.times })} · {t("lastBought", { date: formatDay(f.lastAt.slice(0, 10)) })}
              </span>
            </li>
          ))}
        </ol>
      )}

      {facts.length > 0 && (
        <ul className="mt-comfortable flex flex-col gap-tight border-t border-hairline pt-comfortable">
          {facts.map((f) => (
            <li key={f.key} className="flex items-center gap-comfortable text-sm text-fg">
              <span className="text-muted">{f.icon}</span>
              {f.text}
            </li>
          ))}
        </ul>
      )}

      {!profile.enoughForPattern && (
        <p className={profile.favourites.length > 0 || facts.length > 0 ? "mt-comfortable text-sm text-muted" : "text-sm text-muted"}>
          {t("needMore")}
        </p>
      )}
    </Panel>
  );
}
