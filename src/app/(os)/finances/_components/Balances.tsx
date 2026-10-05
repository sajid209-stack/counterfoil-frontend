"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDay, formatMoney } from "@/lib/format";
import type { FinanceExtras, FinanceSummary } from "@/lib/api";

/** The two boxes. The balance is the hero: a bigger figure, the two buttons,
 *  and one quiet ember rule along its top so it reads as the primary. */
export function Balances({
  summary,
  extras,
  onWithdraw,
  onDeposit,
  onViewPayouts,
  menu,
}: {
  summary: FinanceSummary | undefined;
  extras: FinanceExtras | undefined;
  onViewPayouts: () => void;
  onWithdraw: () => void;
  onDeposit: () => void;
  /** The overflow menu, drawn in the box on a phone (the bar holds it on a desktop). */
  menu?: React.ReactNode;
}) {
  const t = useTranslations("finances");
  const reasonId = useId();
  const available = summary?.available ?? 0;
  const owing = available < 0;
  const empty = available <= 0;
  const noBank = !!summary && !summary.destination;
  // Why Withdraw is off, in words: it is the button's title and its description.
  const reason = empty ? t("available.nothingToWithdraw") : noBank ? t("available.noBank") : "";

  const next = summary?.nextPayout;
  const nextLine = owing
    ? t("available.owe")
    : next
      ? summary?.destination
        ? t("available.next", { date: formatDay(next.date, { weekday: true }), bank: summary.destination })
        : t("available.nextNoBank", { date: formatDay(next.date, { weekday: true }) })
      : t("available.none");
  // What clears before the payout, so the figure can be reconciled with the balance.
  const clearing = next && !owing ? next.amount - available : 0;
  const aboutLine = next && !owing
    ? clearing > 0
      ? t("available.nextAbout", { amount: formatMoney(next.amount), clearing: formatMoney(clearing) })
      : t("available.nextAboutPlain", { amount: formatMoney(next.amount) })
    : "";

  const withdraw = (
    <Button
      variant={empty ? "secondary" : "primary"}
      disabled={!summary || !!reason}
      onClick={onWithdraw}
      title={reason || undefined}
      aria-describedby={reason ? reasonId : undefined}
      className="max-md:flex-1 md:min-w-32"
    >
      {t("available.withdraw")}
    </Button>
  );
  const deposit = (
    <Button variant={empty ? "primary" : "secondary"} disabled={!summary} onClick={onDeposit} className="max-md:flex-1 md:min-w-32">
      {t("available.deposit")}
    </Button>
  );

  return (
    <div className="grid gap-section md:grid-cols-2">
      <section aria-labelledby="fin-available" className="card-surface relative overflow-hidden p-card">
        {/* The one ambient touch: a thin ember rule and a breath of tint. */}
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-ember-solid" />
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ember/[0.06] to-transparent" />
        <div className="relative flex h-full flex-col">
          <div className="flex items-start justify-between gap-tight">
            <h2 id="fin-available" className="text-base font-semibold tracking-[-0.4px]">{t("available.label")}</h2>
            {menu && <div className="-mr-2 -mt-3 md:hidden">{menu}</div>}
          </div>
          <p className="mt-tight text-[32px] font-semibold leading-tight tracking-[-0.5px]" aria-live="polite">
            {summary ? formatMoney(available) : <span className="inline-block h-9 w-44 animate-pulse rounded-sm bg-line" aria-hidden />}
          </p>
          <p className={cn("mt-inline min-h-5 text-[14px]", owing ? "font-medium text-warning" : "text-muted")}>{summary ? nextLine : ""}</p>
          {aboutLine && <p className="text-[13px] text-muted">{aboutLine}</p>}
          {extras?.lastPayout && (
            <p className="flex flex-wrap items-center gap-x-inline text-[13px] text-muted">
              <span>{t("available.lastPayout", { amount: formatMoney(extras.lastPayout.amount), date: formatDay(extras.lastPayout.date, { weekday: true }) })}</span>
              <button type="button" onClick={onViewPayouts} className="-my-2 inline-flex h-11 items-center px-tight text-[13px] font-medium text-brand-foreground underline underline-offset-2 hover:opacity-80 md:h-9">
                {t("available.view")}
              </button>
            </p>
          )}
          <div className="mt-section flex flex-wrap gap-tight pt-tight md:mt-auto">
            {withdraw}
            {deposit}
          </div>
          {reason && <span id={reasonId} className="sr-only">{reason}</span>}
        </div>
      </section>

      <section aria-labelledby="fin-unsettled" className="card-surface p-card">
        <div className="flex items-center gap-inline">
          <h2 id="fin-unsettled" className="text-base font-semibold tracking-[-0.4px]">{t("unsettled.label")}</h2>
          <InfoTip label={t("unsettled.infoLabel")} text={t("unsettled.info")} />
        </div>
        <p className="mt-tight text-[32px] font-semibold leading-tight tracking-[-0.5px]">
          {summary ? formatMoney(summary.unsettled) : <span className="inline-block h-9 w-44 animate-pulse rounded-sm bg-line" aria-hidden />}
        </p>
        <ClearingSchedule summary={summary} extras={extras} />
      </section>
    </div>
  );
}

/** A small "i" that opens a short note. A button rather than a hover tip, so a
 *  phone can open it too; Escape or a click elsewhere closes it. */
function InfoTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <span ref={wrap} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="-my-3 flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:text-fg md:-my-2 md:h-9 md:w-9"
      >
        <Info size={16} strokeWidth={1.5} aria-hidden />
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className="absolute left-0 top-full z-20 mt-inline block w-64 rounded-md border border-line bg-card p-comfortable text-[13px] leading-snug text-fg shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}

/** When the clearing money lands: up to three days, the rest folded into "Later". */
function ClearingSchedule({ summary, extras }: { summary: FinanceSummary | undefined; extras: FinanceExtras | undefined }) {
  const t = useTranslations("finances");
  if (!summary || !extras) return <p className="mt-inline min-h-5" />;
  if (extras.clearing.length === 0) return <p className="mt-inline min-h-5 text-[14px] text-muted">{t("unsettled.none")}</p>;
  const rows: { key: string; label: string; amount: number }[] = extras.clearing.map((c) => ({ key: c.date, label: formatDay(c.date, { weekday: true }), amount: c.amount }));
  const shown = rows.length > 3 ? [...rows.slice(0, 2), { key: "later", label: t("unsettled.later"), amount: rows.slice(2).reduce((s, r) => s + r.amount, 0) }] : rows;
  return (
    <div className="mt-section">
      <p className="text-[13px] text-muted">{t("unsettled.availableOn")}</p>
      <ul className="mt-inline divide-y divide-hairline" aria-label={t("unsettled.availableOn")}>
        {shown.map((r) => (
          <li key={r.key} className="flex items-baseline justify-between gap-section py-tight text-[14px]">
            <span>{r.label}</span>
            <span className="font-medium tabular-nums">{formatMoney(r.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
