"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarCheck, CalendarDays, ChevronDown } from "lucide-react";
import { DatePicker, Sheet } from "@/components/ui";
import { formatDay } from "@/lib/format";

/* ── The day the wall is selling for ──────────────────────────────────────
 *
 * Shopify POS has no sale-date control: it sells retail goods, now. Attraction
 * and venue tills (ROLLER, Gateway Galaxy, Clorian) put a date selector at the
 * top of the sell screen, defaulting to today, so a cashier can sell tickets
 * for another day. Counterfoil sells bookings, so it follows them.
 *
 * Today it is one quiet pill reading "Today · Wed 29 Jul". Another day turns
 * it into a strip across the wall — "Selling for Fri 31 Jul" with Back to
 * today — because a till quietly set to Friday is how somebody sells Friday's
 * tickets to a guest who is here today.
 *
 * It only ever opens the calendar the app already has, in its touch shape, and
 * past days cannot be chosen.
 */
export function SellDateBar({
  value,
  today,
  onChange,
}: {
  value: string;
  today: string;
  onChange: (iso: string) => void;
}) {
  const t = useTranslations("pos");
  const [open, setOpen] = useState(false);
  const away = value !== today;
  const day = formatDay(value, { weekday: true });

  const choose = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  return (
    <>
      {away ? (
        <div className="flex w-full items-center gap-tight rounded-go bg-ember-solid p-1 pl-comfortable text-white" data-sell-date="away">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className="flex min-h-11 min-w-0 flex-1 items-center gap-tight text-left text-[0.9375rem] font-semibold"
          >
            <CalendarCheck size={18} strokeWidth={2} className="shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{t("sellDate.sellingFor", { day })}</span>
          </button>
          <button
            type="button"
            onClick={() => choose(today)}
            className="flex h-11 shrink-0 items-center rounded-full bg-card px-comfortable text-[0.9375rem] font-semibold text-fg active:scale-[0.98]"
          >
            {t("sellDate.backToToday")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          data-sell-date="today"
          className="go-surface flex h-[52px] shrink-0 items-center gap-tight rounded-full px-section text-[0.9375rem] font-semibold text-fg active:bg-muted-wash"
        >
          <CalendarDays size={18} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
          <span className="whitespace-nowrap">{t("sellDate.todayDay", { day })}</span>
          <ChevronDown size={16} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
        </button>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={t("sellDate.choose")} closeLabel={t("cash.close")}>
        {/* The calendar's weekday letters are 12px in the shared picker, under
            the till's floor of 13, and its Today link is as wide as its word —
            41px in Bangla. Both are fixed here rather than in the shared file,
            which the other tills use. */}
        <div className="mx-auto w-max max-w-full pb-comfortable [&>div>button:last-child]:min-w-11 [&_.type-label]:text-[0.8125rem]">
          <DatePicker
            value={value}
            today={today}
            min={today}
            shape="go"
            autoFocus
            onChange={choose}
            labels={{ previousMonth: t("sellDate.previousMonth"), nextMonth: t("sellDate.nextMonth"), today: t("sellDate.today") }}
          />
        </div>
      </Sheet>
    </>
  );
}
