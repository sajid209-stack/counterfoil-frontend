"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { Button, Sheet } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDay, formatMoney } from "@/lib/format";
import { MD, useMediaQuery } from "@/lib/useMedia";
import type { FinanceExtras, FinanceSummary } from "@/lib/api";
import { MetricStrip, type Metric } from "../../dashboard/_components/MetricStrip";

/**
 * The top of Finances: ONE row of four compact tiles, each a label, a figure
 * and one line of context. A money action sits on the tile it changes
 * (Withdraw on Withdrawn, Deposit on Deposited), the way Mercury, Stripe
 * Balances, Wise and Brex lay it out; detail (the payout estimate, the
 * clearing schedule) is behind an info button, never in the tile.
 *
 * 2 x 2 below 1280px, 1 x 4 from there. The two period tiles cover the
 * activity table's date range, so they and the table cannot disagree.
 *
 * **A phone gets a different shape, not a squeezed one:** the four balances as
 * a row of compact cards that scroll sideways (the way the dashboard's
 * figures do), and Withdraw and Deposit as one pair of buttons under it that
 * are always on screen. The tiles were 298px of a phone with the buttons buried
 * inside two of them; this is ~170px and the two actions are the first things
 * a thumb finds. The detail behind an "i" opens as a sheet, because a popover
 * inside a sideways scroller is clipped by it.
 */
export function Balances({
  summary,
  extras,
  periodLabel,
  onWithdraw,
  onDeposit,
  onViewPayouts,
}: {
  summary: FinanceSummary | undefined;
  extras: FinanceExtras | undefined;
  /** The table's range, in words: "Last 30 days" or "3 Jul – 12 Jul 2026". */
  periodLabel: string;
  onViewPayouts: () => void;
  onWithdraw: () => void;
  onDeposit: () => void;
}) {
  const t = useTranslations("finances");
  const wide = useMediaQuery(MD);
  const reasonId = useId();
  const available = summary?.available ?? 0;
  const owing = available < 0;
  const noBank = !!summary && !summary.destination;
  // Why Withdraw is off, in words: it is the button's title and its description.
  const reason = owing ? t("available.owingBlock") : available === 0 ? t("available.nothingToWithdraw") : noBank ? t("available.noBank") : "";
  const canWithdraw = !!summary && !reason;

  const next = summary?.nextPayout;
  const nextLine = owing
    ? t("available.owe")
    : next
      ? summary?.destination
        ? t("available.next", { date: formatDay(next.date, { weekday: true }), bank: shortBank(summary.destination) })
        : t("available.nextNoBank", { date: formatDay(next.date, { weekday: true }) })
      : t("available.none");
  // What clears before the payout, so the figure can be reconciled with the balance.
  const clearing = next && !owing ? next.amount - available : 0;
  const aboutLine =
    next && !owing
      ? clearing > 0
        ? t("available.nextAbout", { amount: formatMoney(next.amount), clearing: formatMoney(clearing) })
        : t("available.nextAboutPlain", { amount: formatMoney(next.amount) })
      : "";
  const lastPayout = owing ? null : extras?.lastPayout;
  const hasBalanceInfo = !!aboutLine || !!lastPayout;

  const p = summary?.period;
  // Never restate the figure: when all of it went one way, say how many times.
  const withdrawnLine = !p
    ? ""
    : p.paidOut === 0
      ? t("withdrawn.none")
      : p.withdrawn === 0
        ? t("withdrawn.autoOnly", { count: p.payoutCount })
        : p.payouts === 0
          ? t("withdrawn.byYouOnly", { count: p.withdrawals })
          : t("withdrawn.split", { auto: formatMoney(p.payouts), byYou: formatMoney(p.withdrawn) });
  const depositedLine = !p ? "" : p.deposits === 0 ? t("deposited.none") : t("deposited.count", { count: p.deposits });

  // What the two "i" buttons say - one definition for both shapes.
  const availableInfo = (
    <div className="flex flex-col gap-tight">
      {aboutLine && <p>{aboutLine}</p>}
      {lastPayout && (
        <p className="flex flex-wrap items-center gap-x-inline">
          <span>{t("available.lastPayout", { amount: formatMoney(lastPayout.amount), date: formatDay(lastPayout.date, { weekday: true }) })}</span>
          <button
            type="button"
            data-close
            onClick={onViewPayouts}
            className="-my-2 inline-flex h-11 items-center text-[13px] font-medium text-brand-foreground underline underline-offset-2 hover:opacity-80 md:h-9"
          >
            {t("available.view")}
          </button>
        </p>
      )}
    </div>
  );
  const unsettledInfo = (
    <div className="flex flex-col gap-tight">
      <p>{t("unsettled.info")}</p>
      <ClearingSchedule extras={extras} />
    </div>
  );
  const unsettledLine = summary ? (summary.clearsBy ? t("unsettled.clearsBy", { date: formatDay(summary.clearsBy, { weekday: true }) }) : t("unsettled.none")) : "";

  if (!wide) {
    const loading = !summary;
    const items: Metric[] = [
      {
        key: "available",
        label: t("available.label"),
        value: loading ? "" : formatMoney(available),
        tone: owing ? "danger" : undefined,
        context: summary ? nextLine : undefined,
        contextTone: owing ? "font-medium text-danger" : undefined,
        action: hasBalanceInfo ? <PhoneInfo label={t("available.infoLabel")}>{availableInfo}</PhoneInfo> : undefined,
      },
      {
        key: "unsettled",
        label: t("unsettled.label"),
        value: loading ? "" : formatMoney(summary?.unsettled ?? 0),
        context: unsettledLine,
        action: <PhoneInfo label={t("unsettled.infoLabel")}>{unsettledInfo}</PhoneInfo>,
      },
      {
        key: "withdrawn",
        label: t("withdrawn.label"),
        value: loading ? "" : formatMoney(p?.paidOut ?? 0),
        context: summary ? `${periodLabel} · ${withdrawnLine}` : undefined,
      },
      {
        key: "deposited",
        label: t("deposited.label"),
        value: loading ? "" : formatMoney(p?.deposited ?? 0),
        context: summary ? `${periodLabel} · ${depositedLine}` : undefined,
      },
    ];
    return (
      <div className="flex flex-col gap-tight">
        <MetricStrip grid items={items} loading={loading} label={t("balances")} />
        {/* The two actions are not behind a scroll: they are what a thumb came
            for. The one that fixes the balance, if it is below zero, leads. */}
        <div className="grid grid-cols-2 gap-tight">
          <Button variant={canWithdraw ? "primary" : "secondary"} disabled={!canWithdraw} onClick={onWithdraw} title={reason || undefined} aria-describedby={reason ? reasonId : undefined}>
            {t("available.withdraw")}
          </Button>
          <Button variant={owing ? "primary" : "secondary"} disabled={!summary} onClick={onDeposit}>
            {t("available.deposit")}
          </Button>
        </div>
        {reason && (
          <p id={reasonId} className="text-[12px] text-muted">
            {reason}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-tight md:gap-section xl:grid-cols-4">
      {/* Available balance */}
      <Tile labelId="fin-available" label={t("available.label")}>
        {hasBalanceInfo && (
          <TileInfo label={t("available.infoLabel")} align="left">
            {availableInfo}
          </TileInfo>
        )}
        <Figure value={summary ? available : undefined} danger={owing} live />
        <Line tone={owing ? "danger" : "muted"}>{summary ? nextLine : ""}</Line>
      </Tile>

      {/* Unsettled funds */}
      <Tile labelId="fin-unsettled" label={t("unsettled.label")}>
        <TileInfo label={t("unsettled.infoLabel")} align="right">
          {unsettledInfo}
        </TileInfo>
        <Figure value={summary?.unsettled} />
        <Line>{unsettledLine}</Line>
      </Tile>

      {/* Withdrawn: what went to the bank in the table's dates, and the button that sends more. */}
      <Tile labelId="fin-withdrawn" label={t("withdrawn.label")}>
        <div className="col-span-2 row-start-5 md:col-span-1 md:col-start-2 md:row-span-2 md:row-start-3 md:self-end md:justify-self-end md:pl-tight max-md:mt-2 max-md:self-end">
          <Button
            variant={canWithdraw ? "primary" : "secondary"}
            size="sm"
            disabled={!canWithdraw}
            onClick={onWithdraw}
            title={reason || undefined}
            aria-describedby={reason ? reasonId : undefined}
            className="max-md:w-full"
          >
            {t("available.withdraw")}
          </Button>
          {reason && (
            <span id={reasonId} className="sr-only">
              {reason}
            </span>
          )}
        </div>
        <Figure value={p?.paidOut} />
        <Line action>{withdrawnLine}</Line>
        <Period action>{summary ? periodLabel : ""}</Period>
      </Tile>

      {/* Deposited */}
      <Tile labelId="fin-deposited" label={t("deposited.label")}>
        <div className="col-span-2 row-start-5 md:col-span-1 md:col-start-2 md:row-span-2 md:row-start-3 md:self-end md:justify-self-end md:pl-tight max-md:mt-2 max-md:self-end">
          <Button variant={owing ? "primary" : "secondary"} size="sm" disabled={!summary} onClick={onDeposit} className="max-md:w-full">
            {t("available.deposit")}
          </Button>
        </div>
        <Figure value={p?.deposited} />
        <Line action>{depositedLine}</Line>
        <Period action>{summary ? periodLabel : ""}</Period>
      </Tile>
    </div>
  );
}

/** One tile: a grid so a button can sit beside the label on a wide tile and
 *  under everything, full width, on a phone. Children place themselves. */
function Tile({ labelId, label, children }: { labelId: string; label: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={labelId} className="group card-surface relative grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto_auto_auto_1fr] items-center p-card">
      <h2 id={labelId} className="col-start-1 row-start-1 text-[13px] font-medium leading-[18px] text-muted">
        {label}
      </h2>
      {children}
    </section>
  );
}

/** The figure: 28px/600 on a wide tile, a step smaller on a phone so a seven-digit amount still fits. */
function Figure({ value, danger, live }: { value: number | undefined; danger?: boolean; live?: boolean }) {
  return (
    <p
      aria-live={live ? "polite" : undefined}
      className={cn("col-span-2 row-start-2 mt-1.5 text-xl font-semibold leading-[1.15] tracking-[-0.4px] tabular-nums md:text-[28px] md:tracking-[-0.5px]", danger ? "text-danger" : "text-fg")}
    >
      {value === undefined ? <span className="inline-block h-6 w-28 animate-pulse rounded-sm bg-line md:h-8 md:w-40" aria-hidden /> : formatMoney(value)}
    </p>
  );
}

/** The one line of context under the figure. */
function Line({ tone = "muted", action, children }: { tone?: "muted" | "danger"; action?: boolean; children: React.ReactNode }) {
  return <p className={cn("col-span-2 row-start-3", action && "md:col-span-1", "mt-0.5 min-h-[18px] text-[13px] leading-[18px]", tone === "danger" ? "font-medium text-danger" : "text-muted")}>{children}</p>;
}

/** Which dates a period tile covers; quiet, because the table's picker owns the choice. */
function Period({ action, children }: { action?: boolean; children: React.ReactNode }) {
  return <p className={cn("col-span-2 row-start-4 mt-0.5 min-h-3.5 text-[12px] leading-[14px] text-muted", action && "md:col-span-1")}>{children}</p>;
}

/** A small "i" that opens a note. A button rather than a hover tip, so a phone
 *  can open it too. Escape closes it and returns focus to the button; a click
 *  elsewhere closes it. The note hangs from the tile (the nearest positioned
 *  ancestor), not from the button, so it has room on a narrow tile. */
function TileInfo({ label, align, children }: { label: string; align: "left" | "right"; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = () => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <span ref={wrap} className="col-start-2 row-start-1 justify-self-end">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="-m-3 flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-[color,opacity] duration-quick hover:text-fg aria-expanded:opacity-100 md:-m-2 md:h-9 md:w-9 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
      >
        <Info size={16} strokeWidth={1.5} aria-hidden />
      </button>
      {open && (
        <div
          id={id}
          role="group"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("[data-close]")) close();
          }}
          aria-label={label}
          className={cn(
            "absolute top-full z-30 mt-inline w-[min(20rem,calc(100vw-2rem))] rounded-md border border-line bg-card p-comfortable text-[13px] leading-snug text-fg shadow-lg",
            align === "left" ? "left-0" : "right-0 xl:left-0 xl:right-auto",
          )}
        >
          {children}
        </div>
      )}
    </span>
  );
}

/** The phone's "i": the same note as the tile's popover, in a sheet. A popover
 *  inside the sideways scroller would be clipped by it. */
function PhoneInfo({ label, children }: { label: string; children: React.ReactNode }) {
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="-my-3 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-muted active:bg-muted-wash"
      >
        <Info size={16} strokeWidth={1.5} aria-hidden />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label} closeLabel={tc("close")}>
        <div
          className="p-card text-[13px] leading-snug text-fg"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("[data-close]")) setOpen(false);
          }}
        >
          {children}
        </div>
      </Sheet>
    </>
  );
}

/** When the clearing money lands: up to three days, the rest folded into "Later". */
function ClearingSchedule({ extras }: { extras: FinanceExtras | undefined }) {
  const t = useTranslations("finances");
  if (!extras || extras.clearing.length === 0) return null;
  const rows: { key: string; label: string; amount: number }[] = extras.clearing.map((c) => ({ key: c.date, label: formatDay(c.date, { weekday: true }), amount: c.amount }));
  const shown = rows.length > 3 ? [...rows.slice(0, 2), { key: "later", label: t("unsettled.later"), amount: rows.slice(2).reduce((s, r) => s + r.amount, 0) }] : rows;
  return (
    <div>
      <p className="text-[13px] font-medium">{t("unsettled.availableOn")}</p>
      <ul className="mt-inline divide-y divide-hairline" aria-label={t("unsettled.availableOn")}>
        {shown.map((r) => (
          <li key={r.key} className="flex items-baseline justify-between gap-section py-tight text-[13px]">
            <span>{r.label}</span>
            <span className="font-medium tabular-nums">{formatMoney(r.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "BRAC Bank ••4821" → "••4821": the masked number is what tells one account
 *  from another at a glance, and the bank's name made the line wrap. */
function shortBank(destination: string): string {
  const m = destination.match(/••\s*\d+/);
  return m ? m[0].replace(/\s+/, "") : destination;
}
