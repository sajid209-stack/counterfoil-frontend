"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Search, SearchX } from "lucide-react";
import { Button, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatClockOf, formatMoney } from "@/lib/format";
import type { FinanceDay, FinanceFilter, FinanceLine } from "@/lib/api";
import { KindDisc, amountTone, groupDay, isInFlight, signed, useDayLabel, useLineText, type DisplayRow } from "./lineParts";

export const FILTERS: FinanceFilter[] = ["all", "sales", "fees", "refunds", "payouts", "deposits"];

/** The kinds of money, as one segmented control. It wraps into rows on a phone
 *  rather than scrolling, so every choice is on screen. */
export function FilterSegments({ value, onChange }: { value: FinanceFilter; onChange: (f: FinanceFilter) => void }) {
  const t = useTranslations("finances");
  return (
    <div role="group" aria-label={t("activity.filterLabel")} className="grid grid-cols-3 gap-inline rounded-sm bg-line/60 p-inline sm:flex sm:w-auto">
      {FILTERS.map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={value === f}
          onClick={() => onChange(f)}
          className={cn(
            "h-11 rounded-xs px-comfortable text-[13px] font-medium transition-colors duration-quick sm:h-9",
            value === f ? "bg-ember-solid text-white" : "text-fg/80 hover:text-fg",
          )}
        >
          {t(`filter.${f}`)}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("finances");
  return (
    <label className="relative min-w-0 flex-1 basis-48 md:max-w-80">
      <Search size={15} strokeWidth={1.5} aria-hidden className="pointer-events-none absolute left-comfortable top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("activity.search")}
        aria-label={t("activity.search")}
        className="h-11 w-full rounded-sm border border-line bg-card pl-8 pr-comfortable text-[13px] outline-none placeholder:text-muted focus:border-inverse md:h-9"
      />
    </label>
  );
}

/** What happened that day, in a few plain words: "3 sales · 1 payout · fees". */
function useDaySummary() {
  const t = useTranslations("finances");
  return (lines: FinanceLine[]) => {
    const rows = groupDay(lines);
    const n = (type: DisplayRow["type"]) => rows.filter((r) => r.type === type).length;
    const k = (...kinds: FinanceLine["kind"][]) => lines.filter((l) => kinds.includes(l.kind)).length;
    const parts: string[] = [];
    if (n("sale")) parts.push(t("day.sales", { count: n("sale") }));
    if (k("refund")) parts.push(t("day.refunds", { count: k("refund") }));
    if (k("payout", "withdrawal")) parts.push(t("day.payouts", { count: k("payout", "withdrawal") }));
    if (k("deposit")) parts.push(t("day.deposits", { count: k("deposit") }));
    if (n("onlineFees")) parts.push(t("day.fees"));
    if (n("counterFees")) parts.push(t("day.counterFees"));
    return parts.join(" · ");
  };
}

function Chip({ status }: { status: FinanceLine["status"] }) {
  const t = useTranslations("finances");
  if (!isInFlight(status)) return null;
  return <StatusPill tone={status === "pending" ? "warning" : "info"}>{t(status === "pending" ? "day.clearing" : "day.onItsWay")}</StatusPill>;
}

function LineRow({ row, onPick }: { row: DisplayRow; onPick: (r: DisplayRow) => void }) {
  const t = useTranslations("finances");
  const describe = useLineText();
  const line = row.line;
  const d = describe(line);
  let text = d.text;
  let ref = d.ref;
  let feeRef: string | undefined;
  if (row.type === "onlineFees") {
    text = t("line.onlineFees");
    ref = line.orderReference;
  } else if (row.type === "counterFees") {
    text = t("line.counterFees", { count: row.lines.length });
    ref = undefined;
  } else if (line.kind === "platform_fee" || line.kind === "processing_fee") {
    feeRef = line.orderReference;
  }
  const kind = row.type === "counterFees" || row.type === "onlineFees" ? "platform_fee" : line.kind;
  return (
    <li className="border-t border-hairline first:border-t-0">
      <button
        type="button"
        onClick={() => onPick(row)}
        className="flex min-h-[60px] w-full items-center gap-comfortable py-comfortable pl-card pr-card text-left transition-colors duration-quick hover:bg-subtle md:pl-[calc(var(--spacing-card)+28px)]"
      >
        <KindDisc kind={kind} />
        <span className="min-w-0 flex-1">
          <span className="block break-words text-[14px] text-fg">
            {text}
            {ref && (
              <>
                {" · "}
                <span className="font-mono text-[13px]">{ref}</span>
              </>
            )}
          </span>
          <span className="mt-inline flex flex-wrap items-center gap-x-tight gap-y-inline text-[12px] text-muted">
            <span>{formatClockOf(line.at)}</span>
            {feeRef && <span className="font-mono">{feeRef}</span>}
            {row.fees !== undefined && row.paid !== undefined && (
              <span>{t("line.paidFees", { paid: formatMoney(row.paid), fees: formatMoney(row.fees) })}</span>
            )}
            <Chip status={line.status} />
          </span>
        </span>
        <span className={cn("shrink-0 text-[14px] font-semibold", amountTone(row.amount))}>{signed(row.amount)}</span>
      </button>
    </li>
  );
}

function DayBlock({ day, open, onToggle, onPick }: { day: FinanceDay; open: boolean; onToggle: () => void; onPick: (r: DisplayRow) => void }) {
  const t = useTranslations("finances");
  const label = useDayLabel();
  const summarize = useDaySummary();
  const panel = useId();
  const clearing = day.lines.some((l) => l.status === "pending");
  const onItsWay = !clearing && day.lines.some((l) => l.status === "processing");
  return (
    <div className="border-t border-hairline first:border-t-0">
      <button
        type="button"
        data-day={day.date}
        aria-expanded={open}
        aria-controls={panel}
        onClick={onToggle}
        className="flex min-h-14 w-full items-center gap-comfortable px-card py-comfortable text-left transition-colors duration-quick hover:bg-subtle"
      >
        <ChevronRight size={16} strokeWidth={1.75} aria-hidden className={cn("shrink-0 text-muted transition-transform duration-quick", open && "rotate-90")} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-tight gap-y-inline">
            <span className="text-[15px] font-semibold">{label(day.date)}</span>
            {(clearing || onItsWay) && <StatusPill tone={clearing ? "warning" : "info"}>{t(clearing ? "day.clearing" : "day.onItsWay")}</StatusPill>}
          </span>
          <span className="mt-inline block text-[13px] text-muted">{summarize(day.lines)}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className={cn("block text-[15px] font-semibold", amountTone(day.net))}>{signed(day.net)}</span>
          <span className="mt-inline hidden text-[12px] text-muted md:block">
            {t("day.in", { amount: formatMoney(day.moneyIn) })} · {t("day.out", { amount: formatMoney(day.moneyOut) })}
          </span>
        </span>
      </button>
      {open && (
        <ul id={panel} className="border-t border-hairline bg-subtle/40">
          {groupDay(day.lines).map((r) => (
            <LineRow key={r.id} row={r} onPick={onPick} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function ActivityDays({
  days,
  total,
  loading,
  loadingMore,
  isOpen,
  onToggle,
  onPick,
  onMore,
  filtered,
  onClear,
}: {
  days: FinanceDay[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  isOpen: (date: string, index: number) => boolean;
  onToggle: (date: string, now: boolean) => void;
  onPick: (r: DisplayRow) => void;
  onMore: () => void;
  filtered: boolean;
  onClear: () => void;
}) {
  const t = useTranslations("finances");
  if (loading && days.length === 0) {
    return (
      <div className="flex flex-col gap-section px-card py-section" role="status" aria-label={t("activity.loading")}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-sm bg-line/60" />
        ))}
      </div>
    );
  }
  if (days.length === 0) {
    return (
      <div className="flex flex-col items-center gap-tight px-card py-major text-center">
        <SearchX size={28} strokeWidth={1.25} aria-hidden className="text-muted" />
        <p className="text-[15px] font-semibold">{filtered ? t("empty.title") : t("empty.none")}</p>
        {filtered && (
          <>
            <p className="text-[13px] text-muted">{t("empty.text")}</p>
            <Button variant="secondary" onClick={onClear} className="mt-tight">
              {t("empty.clear")}
            </Button>
          </>
        )}
      </div>
    );
  }
  return (
    <div className={cn(loading && "opacity-60 transition-opacity")} aria-busy={loading}>
      {days.map((d, i) => {
        const open = isOpen(d.date, i);
        return <DayBlock key={d.date} day={d} open={open} onToggle={() => onToggle(d.date, !open)} onPick={onPick} />;
      })}
      {days.length < total && (
        <div className="flex flex-col items-center gap-tight border-t border-hairline px-card py-section">
          <Button variant="secondary" loading={loadingMore} onClick={onMore}>
            {t("activity.showMore")}
          </Button>
          <p className="text-[12px] text-muted">{t("activity.showing", { shown: days.length, total })}</p>
        </div>
      )}
    </div>
  );
}
