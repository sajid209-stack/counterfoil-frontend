"use client";

import { useTranslations } from "next-intl";
import { ChevronRight, Search, SearchX } from "lucide-react";
import { Button, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatClockOf, formatMoney } from "@/lib/format";
import type { FinanceDay, FinanceFilter } from "@/lib/api";
import { amountTone, groupDay, rowAmounts, rowStatus, signed, useDayLabel, useLineText, type DisplayRow } from "./lineParts";

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

const longDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  const wd = new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(d);
  const rest = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(d);
  return `${wd}, ${rest}`;
};

/** Money in a cell: a dash for nothing, so a column of zeros does not shout. */
const cellMoney = (minor: number) => (minor === 0 ? "—" : formatMoney(minor));

function StatusChip({ status }: { status: ReturnType<typeof rowStatus> }) {
  const t = useTranslations("finances");
  return <StatusPill tone={status.tone}>{t(`status.${status.key}`)}</StatusPill>;
}

/** The words a display row is read by: label and reference. */
function useRowText() {
  const t = useTranslations("finances");
  const describe = useLineText();
  return (row: DisplayRow): { text: string; ref?: string } => {
    if (row.type === "onlineFees") return { text: t("line.onlineFees"), ref: row.line.orderReference };
    if (row.type === "counterFees") return { text: t("line.counterFees", { count: row.lines.length }) };
    return describe(row.line);
  };
}

function useDayInfo() {
  const t = useTranslations("finances");
  const label = useDayLabel();
  return (day: FinanceDay) => {
    const tag = label(day.date);
    return {
      rows: groupDay(day.lines),
      tag: tag === t("day.today") || tag === t("day.yesterday") ? tag : null,
      clearing: day.lines.some((l) => l.status === "pending" || l.status === "processing"),
    };
  };
}

function DayStatus({ clearing }: { clearing: boolean }) {
  const t = useTranslations("finances");
  return <StatusPill tone={clearing ? "warning" : "success"}>{t(clearing ? "day.clearing" : "day.settled")}</StatusPill>;
}

/** The chevron button (the keyboard's way in) and the day, said in full. */
function DateCell({ day, open, tag }: { day: FinanceDay; open: boolean; tag: string | null }) {
  return (
    <span className="flex items-center gap-x-comfortable">
      <button
        type="button"
        data-day={day.date}
        aria-expanded={open}
        aria-label={longDay(day.date)}
        className="flex h-11 w-11 shrink-0 items-center justify-center text-muted md:h-8 md:w-6"
      >
        <ChevronRight size={16} strokeWidth={1.75} aria-hidden className={cn("transition-transform duration-quick", open && "rotate-90")} />
      </button>
      <span className="min-w-0">
        <span className="font-semibold text-fg">{longDay(day.date)}</span>
        {tag && <span className="ml-tight inline-block rounded-full px-tight py-inline text-[12px] font-medium text-muted ring-1 ring-line">{tag}</span>}
      </span>
    </span>
  );
}

type Totals = { credit: number; debit: number; net: number };
type ListProps = {
  days: FinanceDay[];
  isOpen: (d: string, i: number) => boolean;
  onToggle: (d: string, now: boolean) => void;
  onPick: (r: DisplayRow) => void;
  totals: Totals;
};

const RECESSED = "bg-muted-wash/35 hover:bg-muted-wash/70";

function RowTable({ days, isOpen, onToggle, onPick, totals }: ListProps) {
  const t = useTranslations("finances");
  const info = useDayInfo();
  const rowText = useRowText();
  const th = "sticky top-[61px] z-10 border-b border-line bg-card py-comfortable text-[12px] font-medium text-muted";
  const num = "text-right tabular-nums";
  return (
    <table className="table-inset w-full table-fixed border-collapse text-[14px]">
      <colgroup>
        <col className="w-[28%]" />
        <col className="w-[25%]" />
        <col className="w-[12%]" />
        <col className="w-[11%]" />
        <col className="w-[11%]" />
        <col className="w-[13%]" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col" className={cn(th, "text-left")}>{t("table.date")}</th>
          <th scope="col" className={cn(th, "px-tight text-left")}>{t("table.details")}</th>
          <th scope="col" className={cn(th, "px-tight text-left")}>{t("table.status")}</th>
          <th scope="col" className={cn(th, num, "px-tight")}>{t("table.credit")}</th>
          <th scope="col" className={cn(th, num, "px-tight")}>{t("table.debit")}</th>
          <th scope="col" className={cn(th, num)}>{t("table.net")}</th>
        </tr>
      </thead>
      {days.map((d, i) => {
        const open = isOpen(d.date, i);
        const x = info(d);
        return (
          <tbody key={d.date} className="border-t border-hairline">
            <tr onClick={() => onToggle(d.date, !open)} className="cursor-pointer transition-colors duration-quick hover:bg-muted-wash/40">
              <td className="py-comfortable pr-tight"><DateCell day={d} open={open} tag={x.tag} /></td>
              <td className="px-tight py-comfortable text-muted">{t("day.transactions", { count: x.rows.length })}</td>
              <td className="px-tight py-comfortable"><DayStatus clearing={x.clearing} /></td>
              <td className={cn(num, "px-tight py-comfortable")}>{cellMoney(d.moneyIn)}</td>
              <td className={cn(num, "px-tight py-comfortable")}>{cellMoney(d.moneyOut)}</td>
              <td className={cn(num, "py-comfortable font-semibold", amountTone(d.net))}>{signed(d.net)}</td>
            </tr>
            {open &&
              x.rows.map((r) => {
                const a = rowAmounts(r);
                const rt = rowText(r);
                return (
                  <tr key={r.id} onClick={() => onPick(r)} className={cn("cursor-pointer border-t border-hairline transition-colors duration-quick", RECESSED)}>
                    <td className="py-comfortable pl-[calc(var(--spacing-card)+36px)] pr-tight text-[13px] text-muted">
                      <button type="button" className="min-h-8 text-left outline-none focus-visible:underline" aria-label={`${rt.text}${rt.ref ? " " + rt.ref : ""}`}>
                        {formatClockOf(r.line.at)}
                      </button>
                    </td>
                    <td className="px-tight py-comfortable text-fg">
                      <span className="break-words">{rt.text}</span>
                      {rt.ref && <span className="font-mono text-[13px]"> · {rt.ref}</span>}
                    </td>
                    <td className="px-tight py-comfortable"><StatusChip status={rowStatus(r)} /></td>
                    <td className={cn(num, "px-tight py-comfortable")}>{cellMoney(a.credit)}</td>
                    <td className={cn(num, "px-tight py-comfortable")}>{cellMoney(a.debit)}</td>
                    <td className={cn(num, "py-comfortable font-medium", amountTone(r.amount))}>{signed(r.amount)}</td>
                  </tr>
                );
              })}
          </tbody>
        );
      })}
      <tfoot>
        <tr className="border-t-2 border-line bg-subtle/60 font-semibold">
          <td colSpan={3} className="py-comfortable text-fg">{t("table.total", { count: days.length })}</td>
          <td className={cn(num, "px-tight py-comfortable")}>{formatMoney(totals.credit)}</td>
          <td className={cn(num, "px-tight py-comfortable")}>{formatMoney(totals.debit)}</td>
          <td className={cn(num, "py-comfortable", amountTone(totals.net))}>{signed(totals.net)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

/** A labelled figure: on a phone the same data, with its column named. */
function Fig({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-[12px] text-muted">{label}</span>
      <span className={cn("block text-[13px] tabular-nums", tone ?? "text-fg")}>{value}</span>
    </span>
  );
}

function RowList({ days, isOpen, onToggle, onPick, totals }: ListProps) {
  const t = useTranslations("finances");
  const info = useDayInfo();
  const rowText = useRowText();
  return (
    <div>
      {days.map((d, i) => {
        const open = isOpen(d.date, i);
        const x = info(d);
        return (
          <div key={d.date} className="border-t border-hairline first:border-t-0">
            <div role="presentation" onClick={() => onToggle(d.date, !open)} className="cursor-pointer px-card py-comfortable">
              <div className="flex items-start justify-between gap-tight">
                <DateCell day={d} open={open} tag={x.tag} />
                <DayStatus clearing={x.clearing} />
              </div>
              <p className="mt-inline pl-[calc(44px+0.75rem)] text-[13px] text-muted">{t("day.transactions", { count: x.rows.length })}</p>
              <div className="mt-tight grid grid-cols-3 gap-tight pl-[calc(44px+0.75rem)]">
                <Fig label={t("table.credit")} value={cellMoney(d.moneyIn)} />
                <Fig label={t("table.debit")} value={cellMoney(d.moneyOut)} />
                <Fig label={t("table.net")} value={signed(d.net)} tone={cn("font-semibold", amountTone(d.net))} />
              </div>
            </div>
            {open && (
              <ul className="border-t border-hairline bg-muted-wash/35">
                {x.rows.map((r) => {
                  const a = rowAmounts(r);
                  const rt = rowText(r);
                  return (
                    <li key={r.id} className="border-t border-hairline first:border-t-0">
                      <button type="button" onClick={() => onPick(r)} className="block min-h-[60px] w-full px-card py-comfortable text-left transition-colors duration-quick hover:bg-muted-wash/70">
                        <span className="flex items-start justify-between gap-tight">
                          <span className="min-w-0 text-[14px] text-fg">
                            <span className="break-words">{rt.text}</span>
                            {rt.ref && <span className="font-mono text-[13px]"> · {rt.ref}</span>}
                          </span>
                          <StatusChip status={rowStatus(r)} />
                        </span>
                        <span className="mt-inline block text-[12px] text-muted">{formatClockOf(r.line.at)}</span>
                        <span className="mt-tight grid grid-cols-3 gap-tight">
                          <Fig label={t("table.credit")} value={cellMoney(a.credit)} />
                          <Fig label={t("table.debit")} value={cellMoney(a.debit)} />
                          <Fig label={t("table.net")} value={signed(r.amount)} tone={cn("font-medium", amountTone(r.amount))} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
      <div className="border-t-2 border-line bg-subtle/60 px-card py-comfortable">
        <p className="text-[14px] font-semibold">{t("table.total", { count: days.length })}</p>
        <div className="mt-tight grid grid-cols-3 gap-tight">
          <Fig label={t("table.credit")} value={formatMoney(totals.credit)} />
          <Fig label={t("table.debit")} value={formatMoney(totals.debit)} />
          <Fig label={t("table.net")} value={signed(totals.net)} tone={cn("font-semibold", amountTone(totals.net))} />
        </div>
      </div>
    </div>
  );
}

/** Loading, drawn in the shape of what is coming. */
function Skeleton({ wide }: { wide: boolean }) {
  const t = useTranslations("finances");
  const bar = "animate-pulse rounded-sm bg-line/60";
  return (
    <div role="status" aria-label={t("activity.loading")} className="px-card py-section">
      {[0, 1, 2, 3, 4].map((i) =>
        wide ? (
          <div key={i} className="flex items-center gap-section border-b border-hairline py-comfortable last:border-b-0">
            <div className={cn(bar, "h-4 w-[24%]")} />
            <div className={cn(bar, "h-4 w-[20%]")} />
            <div className={cn(bar, "h-5 w-[9%] rounded-full")} />
            <div className={cn(bar, "ml-auto h-4 w-[9%]")} />
            <div className={cn(bar, "h-4 w-[9%]")} />
            <div className={cn(bar, "h-4 w-[11%]")} />
          </div>
        ) : (
          <div key={i} className="border-b border-hairline py-comfortable last:border-b-0">
            <div className={cn(bar, "h-4 w-3/5")} />
            <div className={cn(bar, "mt-tight h-8 w-full")} />
          </div>
        ),
      )}
    </div>
  );
}

export function ActivityTable({
  days,
  total,
  loading,
  loadingMore,
  wide,
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
  wide: boolean;
  isOpen: (date: string, index: number) => boolean;
  onToggle: (date: string, now: boolean) => void;
  onPick: (r: DisplayRow) => void;
  onMore: () => void;
  filtered: boolean;
  onClear: () => void;
}) {
  const t = useTranslations("finances");
  if (loading && days.length === 0) return <Skeleton wide={wide} />;
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
  const totals = days.reduce((s, d) => ({ credit: s.credit + d.moneyIn, debit: s.debit + d.moneyOut, net: s.net + d.net }), { credit: 0, debit: 0, net: 0 });
  const props = { days, isOpen, onToggle, onPick, totals };
  return (
    <div className={cn(loading && "opacity-60 transition-opacity")} aria-busy={loading}>
      {wide ? <RowTable {...props} /> : <RowList {...props} />}
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
