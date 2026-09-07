"use client";

/* ── What was just sold ────────────────────────────────────────────────────
 *
 * v1 has its own completion screen and this does not touch it. Two reasons
 * for a second one rather than a shared one:
 *
 * - "New sale" has to come back to THIS till. A shared screen would have to
 *   remember which till sent it, which is state about a thing that has
 *   already finished.
 * - v2 has no cart, so when the sale completes the page it was assembled on
 *   is gone. That makes the receipt worth SHOWING rather than only offering
 *   to print — v1 already puts the lines in session storage and then never
 *   renders them.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleCheck, MessageSquare, Printer, Ticket as TicketIcon } from "lucide-react";
import { Button, Modal, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import { DEFAULT_SMS_TEMPLATE, renderSms } from "@/lib/sms";

interface ReceiptLine {
  name: string;
  qty: number;
  amount: number;
  child?: boolean;
}
interface Receipt {
  lines: ReceiptLine[];
  subtotal: number;
  lineDiscountTotal: number;
  orderDiscount: number;
  tax: number;
  total: number;
}
interface Info {
  orderId?: string;
  code: string;
  change: number;
  balance?: number;
  receipt?: Receipt;
  payments?: { method: string; amount: number }[];
}

export default function SellCompletePage() {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("pos");
  const ts = useTranslations("sell");
  const tk = useTranslations("ticket");
  const [smsOpen, setSmsOpen] = useState(false);

  /* Session storage is an external store, so it is read as one. Reading it in
     an effect and setState-ing the result is a cascading render AND a lint
     error in this codebase (react-hooks/set-state-in-effect); the sale has
     already landed by the time this page mounts, so the value never changes
     and the subscribe callback has nothing to subscribe to. */
  const raw = useSyncExternalStore(
    () => () => {},
    () => sessionStorage.getItem("sell_complete"),
    () => null,
  );
  const info = useMemo<Info | null>(() => (raw ? (JSON.parse(raw) as Info) : null), [raw]);
  const operatorQ = useApiQuery(() => getOperator(), []);
  const business = operatorQ.data?.name ?? "Counterfoil";
  const currency = operatorQ.data?.currency ?? "BDT";

  // Landing here without a sale means a refresh or a stray link. An effect
  // that only navigates sets no state, so it is not the pattern above.
  useEffect(() => {
    if (raw === null) router.replace("/sell");
  }, [raw, router]);

  const smsText = renderSms(operatorQ.data?.smsTemplate || DEFAULT_SMS_TEMPLATE, {
    business,
    code: info?.code ?? "",
    date: DEMO_TODAY,
  });

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-major px-section py-hero text-center">
      <div className="flex items-center gap-tight text-success">
        <CircleCheck size={28} strokeWidth={1.5} />
        <h1 className="type-h1 text-2xl text-fg">{t("complete.ticketIssued")}</h1>
      </div>

      {info && (
        <>
          <div className="relative w-full">
            <div className="rounded-go bg-ink px-section pb-major pt-major text-paper">
              <p className="type-label text-[13px] text-faint">{t("complete.bookingReference")}</p>
              <p className="mt-tight break-all font-mono text-2xl tracking-tight sm:text-3xl">{info.code}</p>
            </div>
            <div className="relative flex items-center">
              <span className="absolute -left-2 h-4 w-4 rounded-full bg-surface" aria-hidden />
              <span className="absolute -right-2 h-4 w-4 rounded-full bg-surface" aria-hidden />
              <span className="mx-major flex-1 border-t-2 border-dashed border-paper/40" aria-hidden />
            </div>
            <div className="rounded-go bg-ink px-section pb-major pt-tight text-paper">
              <p className="font-mono text-[13px] text-faint">{t("complete.presentAtGate")}</p>
            </div>
          </div>

          {info.change > 0 && (
            <p className="type-body text-muted">
              {t("complete.changeDue")}{" "}
              <span className="font-medium text-fg">{formatMoney(info.change, currency)}</span>
            </p>
          )}

          {/* The sale itself. The page it was built on is gone, so this is the
              only place it can still be read without going to Orders. */}
          {info.receipt && (
            <div className="w-full rounded-go border border-line bg-card p-comfortable text-left">
              <p className="mb-tight text-[14px] font-semibold">{ts("complete.whatWasSold")}</p>
              {info.receipt.lines.map((l, i) => (
                <div
                  key={i}
                  className={`flex items-baseline justify-between gap-comfortable py-inline text-[13px] ${l.child ? "pl-comfortable text-muted" : ""}`}
                >
                  <span className="min-w-0 break-words">
                    {l.qty > 1 ? `${l.qty} × ` : ""}
                    {l.name}
                  </span>
                  <span className="shrink-0 whitespace-nowrap tabular-nums">{formatMoney(l.amount, currency)}</span>
                </div>
              ))}
              <div className="mt-tight border-t border-line pt-tight">
                {info.receipt.orderDiscount > 0 && (
                  <div className="flex justify-between text-[13px] text-muted">
                    <span>{t("summary.discountFlat")}</span>
                    <span className="text-danger tabular-nums">−{formatMoney(info.receipt.orderDiscount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[13px] text-muted">
                  <span>{t("summary.vat")}</span>
                  <span className="tabular-nums">{formatMoney(info.receipt.tax, currency)}</span>
                </div>
                <div className="mt-inline flex items-baseline justify-between text-[15px] font-semibold">
                  <span>{t("summary.total")}</span>
                  <span className="tabular-nums">{formatMoney(info.receipt.total, currency)}</span>
                </div>
              </div>
            </div>
          )}

          <Button shape="pill" size="lg" fullWidth onClick={() => router.push("/sell")}>
            {t("complete.newSale")}
          </Button>

          <div className="flex w-full items-center gap-tight">
            <button
              type="button"
              disabled={!info.orderId}
              onClick={() => router.push(`/print/tickets/${info.orderId}`)}
              className="flex h-12 flex-1 items-center justify-center gap-inline rounded-full border border-line bg-card text-sm text-muted active:bg-ember/10 disabled:opacity-40"
            >
              <TicketIcon size={16} strokeWidth={1.5} /> {tk("printTickets")}
            </button>
            <button
              type="button"
              disabled={!info.orderId}
              onClick={() => router.push(`/print/receipt/${info.orderId}`)}
              className="flex h-12 flex-1 items-center justify-center gap-inline rounded-full border border-line bg-card text-sm text-muted active:bg-ember/10 disabled:opacity-40"
            >
              <Printer size={16} strokeWidth={1.5} /> {tk("printReceipt")}
            </button>
            <button
              type="button"
              onClick={() => setSmsOpen(true)}
              className="flex h-12 flex-1 items-center justify-center gap-inline rounded-full border border-line bg-card text-sm text-muted active:bg-ember/10"
            >
              <MessageSquare size={16} strokeWidth={1.5} /> {t("complete.sendSms")}
            </button>
          </div>
        </>
      )}

      <Modal
        open={smsOpen}
        onClose={() => setSmsOpen(false)}
        title={t("complete.smsTitle")}
        footer={
          <>
            <Button shape="pill" variant="secondary" onClick={() => setSmsOpen(false)}>
              {t("complete.cancel")}
            </Button>
            <Button
              shape="pill"
              onClick={() => {
                setSmsOpen(false);
                toast.success(t("complete.smsSent"));
              }}
            >
              {t("complete.sendSmsButton")}
            </Button>
          </>
        }
      >
        <div className="rounded-go rounded-bl-xs border border-line bg-subtle p-comfortable text-left text-sm">{smsText}</div>
        <p className="mt-tight text-left text-[13px] text-faint">{t("complete.smsMeta", { count: smsText.length })}</p>
      </Modal>
    </main>
  );
}
