"use client";

import { useState } from "react";
import { Check, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { AffixInput, Button, SegmentedControl } from "@/components/ui";
import {
  isVoidedOrder,
  orderNetPaid,
  orderReceived,
  orderRefundedOut,
  orderWrittenOff,
  type Order,
  type PaymentMethod,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import { Section } from "./Section";

/** "1537.5" → 153750. Null for anything that is not an amount of money. */
export function parseTaka(text: string): number | null {
  const s = text.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{0,2})?$|^\.\d{1,2}$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

/**
 * Money: what the sale came to, what has been taken, what is still due — and,
 * while something is, the form to collect it, right here.
 *
 * Researched against Shopify's order page (a payment card with a "Collect
 * payment" button), Stripe's payment detail (a timeline, refunds as their own
 * rows, the amount that can still be refunded stated beside the button) and
 * Square's transaction detail (the tender, how it was paid, in the summary).
 * What they share, and what this takes: one figure carries the page — the
 * balance — and the action that clears it is beside it, not behind a menu and
 * a dialog.
 *
 * The lead figure is **Still due** while there is a balance, in warning, and
 * what was paid once there is not. Collecting refuses an amount above what is
 * due, in words and before the button is pressed: money taken in error is
 * somebody's afternoon to put right.
 *
 * Money is Inter with tabular figures; the rows line up on the decimal point.
 */
export function MoneyCard({
  o,
  due,
  methods,
  onCollect,
  hideLead = false,
  className,
}: {
  o: Order;
  due: number;
  methods: PaymentMethod[];
  onCollect: (method: PaymentMethod, amount: number) => Promise<boolean>;
  /** Leave the big figure out — on a phone the card above already says it, and
   *  a second "Still due ৳460.00" two inches below the first is just noise. */
  hideLead?: boolean;
  className?: string;
}) {
  const t = useTranslations("orders.money");
  const voided = isVoidedOrder(o);
  const received = orderReceived(o);
  const captured = o.payments.find((p) => p.amount > 0)?.amount ?? 0;
  const since = received - captured;
  const refunded = orderRefundedOut(o);
  const writtenOff = orderWrittenOff(o);
  const paid = orderNetPaid(o);

  const row = (key: string, label: string, value: string, tone?: "danger") => (
    <div key={key} data-row={key} className="flex items-baseline justify-between gap-tight py-1">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("shrink-0 tabular-nums", tone === "danger" && "text-danger")}>{value}</dd>
    </div>
  );

  return (
    <Section title={t("title")} className={className} id="order-money">
      {/* The lead figure. */}
      {!hideLead && (
      <div className="mb-section">
        <p className="text-sm font-medium text-muted">{due > 0 ? t("stillDue") : voided ? t("nothingDue") : t("paid")}</p>
        <p
          data-figure={due > 0 ? "due" : "paid"}
          data-amount={due > 0 ? due : paid}
          className={cn("type-figure mt-inline text-3xl font-semibold leading-tight", due > 0 && "text-warning", voided && due === 0 && "text-muted")}
        >
          {formatMoney(due > 0 ? due : paid)}
        </p>
        {due === 0 && (
          <p className="mt-inline flex items-center gap-inline text-sm text-muted">
            {!voided && <Check size={14} strokeWidth={2} aria-hidden className="text-success" />}
            {voided ? (o.status === "cancelled" ? t("noteCancelled") : t("noteRefunded")) : t("settled")}
          </p>
        )}
      </div>
      )}

      <dl className={cn("pt-tight text-sm", !hideLead && "border-t border-hairline")}>
        {row("total", t("total"), formatMoney(o.total))}
        {row("captured", t("captured"), formatMoney(captured))}
        {since > 0 && row("since", t("since"), formatMoney(since))}
        {refunded > 0 && row("refunded", t("refunded"), `−${formatMoney(refunded)}`, "danger")}
        {writtenOff > 0 && row("writtenOff", t("writtenOff"), `−${formatMoney(writtenOff)}`)}
      </dl>

      {due > 0 && !voided && (
        <CollectForm key={`${o.id}:${due}`} due={due} methods={methods} onCollect={onCollect} />
      )}
    </Section>
  );
}

/** Method chips, an amount that starts as everything that is due, and the button. */
function CollectForm({ due, methods, onCollect }: { due: number; methods: PaymentMethod[]; onCollect: (method: PaymentMethod, amount: number) => Promise<boolean> }) {
  const t = useTranslations("orders.money");
  const enumL = useEnumLabels();
  const [method, setMethod] = useState<PaymentMethod>(methods.includes("cash") ? "cash" : (methods[0] ?? "cash"));
  const [text, setText] = useState((due / 100).toFixed(2));
  const [touched, setTouched] = useState(false);
  const [paying, setPaying] = useState(false);

  const amount = parseTaka(text);
  const over = amount !== null && amount > due;
  const invalid = amount === null || amount <= 0;
  const message = over
    ? t("over", { extra: formatMoney(amount - due), due: formatMoney(due) })
    : touched && invalid
      ? t("invalid")
      : null;

  const submit = async () => {
    setTouched(true);
    if (amount === null || amount <= 0 || over) return;
    setPaying(true);
    await onCollect(method, amount);
    setPaying(false);
  };

  return (
    <form
      data-collect
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="mt-section border-t border-hairline pt-section"
    >
      <h3 className="mb-tight text-md font-semibold text-fg" id="collect-title">{t("collect")}</h3>

      {/* How it is being paid: one of the venue's own methods. A segmented
          choice, not chips: it is one-of-many, and a solid orange chip beside
          the orange Collect button would put two primaries on one card. */}
      <SegmentedControl
        aria-labelledby="collect-title"
        value={method}
        onChange={(v) => setMethod(v as typeof method)}
        options={methods.map((m) => ({ value: m, label: enumL.method(m) }))}
        className="max-w-full flex-wrap"
      />

      <div className="mt-section flex flex-col gap-tight">
        <label htmlFor="collect-amount" className="text-sm font-medium text-muted">{t("amount")}</label>
        <AffixInput
          id="collect-amount"
          data-collect-amount
          type="text"
          inputMode="decimal"
          autoComplete="off"
          prefix="৳"
          value={text}
          onChange={(e) => { setText(e.target.value); setTouched(true); }}
          invalid={!!message}
          aria-describedby="collect-msg"
          inputClassName="tabular-nums"
        />
        <p id="collect-msg" aria-live="polite" className={cn("text-xs", message ? "text-danger" : "text-muted")}>
          {message ?? t("help", { amount: formatMoney(due) })}
        </p>
      </div>

      <Button
        type="submit"
        fullWidth
        className="mt-section"
        loading={paying}
        disabled={over || (touched && invalid)}
        icon={<Wallet size={16} strokeWidth={1.5} />}
      >
        {t("button", { amount: amount !== null && amount > 0 && !over ? formatMoney(amount) : formatMoney(due) })}
      </Button>
    </form>
  );
}
