"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleCheck, MessageSquare, Printer, Ticket as TicketIcon } from "lucide-react";
import { Button, Modal, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { DEFAULT_SMS_TEMPLATE, renderSms } from "@/lib/sms";

const TODAY = "2026-07-29";

export default function CompletePage() {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("pos");
  const tk = useTranslations("ticket");
  interface ReceiptLine { name: string; qty: number; amount: number; child?: boolean }
  interface Receipt { lines: ReceiptLine[]; subtotal: number; lineDiscountTotal: number; orderDiscount: number; tax: number; total: number }
  const [info, setInfo] = useState<{ orderId?: string; code: string; change: number; balance?: number; receipt?: Receipt; payments?: { method: string; amount: number }[] } | null>(null);
  const [smsOpen, setSmsOpen] = useState(false);
  const operatorQ = useApiQuery(() => getOperator(), []);
  const business = operatorQ.data?.name ?? "Counterfoil";

  useEffect(() => {
    const raw = sessionStorage.getItem("pos_complete");
    if (raw) setInfo(JSON.parse(raw));
    else router.replace("/pos");
  }, [router]);

  const smsText = renderSms(operatorQ.data?.smsTemplate || DEFAULT_SMS_TEMPLATE, {
    business,
    code: info?.code ?? "",
    date: TODAY,
  });

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-major px-section py-hero text-center">
      <div className="flex items-center gap-tight text-success">
        <CircleCheck size={28} strokeWidth={1.5} />
        <h1 className="type-h1 text-2xl text-fg">{t("complete.ticketIssued")}</h1>
      </div>

      {info && (
        <>
          {/* The brand moment — a literal ticket stub with a perforated tear line. */}
          <div className="relative w-full">
            <div className="rounded-md bg-ink px-section pb-major pt-major text-paper">
              <p className="type-label text-[11px] text-faint">{t("complete.bookingReference")}</p>
              <p className="mt-tight break-all font-mono text-2xl tracking-tight sm:text-3xl">{info.code}</p>
            </div>
            {/* perforation */}
            <div className="relative flex items-center">
              <span className="absolute -left-2 h-4 w-4 rounded-full bg-surface" aria-hidden />
              <span className="absolute -right-2 h-4 w-4 rounded-full bg-surface" aria-hidden />
              <span className="mx-major flex-1 border-t-2 border-dashed border-paper/40" aria-hidden />
            </div>
            <div className="rounded-md bg-ink px-section pb-major pt-tight text-paper">
              <p className="font-mono text-[12px] text-faint">{t("complete.presentAtGate")}</p>
            </div>
          </div>

          {info.change > 0 && (
            <p className="type-body text-muted">
              {t("complete.changeDue")} <span className="font-mono text-fg">{formatMoney(info.change)}</span>
            </p>
          )}
          {(info.balance ?? 0) > 0 && (
            <p className="type-body text-muted">
              {t("complete.balanceDueAtArrival")} <span className="font-mono text-fg">{formatMoney(info.balance!)}</span>
            </p>
          )}

          {/* New sale is the primary, always-visible action. */}
          <Button size="lg" fullWidth onClick={() => router.push("/pos")}>{t("complete.newSale")}</Button>

          {/* Real print (opens the browser print dialog on a clean layout) + SMS. */}
          <div className="flex w-full items-center gap-tight">
            <button type="button" disabled={!info.orderId} onClick={() => router.push(`/print/tickets/${info.orderId}`)} className="flex h-12 flex-1 items-center justify-center gap-inline rounded-sm border border-line bg-card text-sm text-muted active:bg-ember/10 disabled:opacity-40"><TicketIcon size={16} strokeWidth={1.5} /> {tk("printTickets")}</button>
            <button type="button" disabled={!info.orderId} onClick={() => router.push(`/print/receipt/${info.orderId}`)} className="flex h-12 flex-1 items-center justify-center gap-inline rounded-sm border border-line bg-card text-sm text-muted active:bg-ember/10 disabled:opacity-40"><Printer size={16} strokeWidth={1.5} /> {tk("printReceipt")}</button>
            <button type="button" onClick={() => setSmsOpen(true)} className="flex h-12 flex-1 items-center justify-center gap-inline rounded-sm border border-line bg-card text-sm text-muted active:bg-ember/10"><MessageSquare size={16} strokeWidth={1.5} /> {t("complete.sendSms")}</button>
          </div>
        </>
      )}

      {/* SMS preview — the exact message, rendered from the business template. */}
      <Modal open={smsOpen} onClose={() => setSmsOpen(false)} title={t("complete.smsTitle")} footer={<><Button variant="secondary" onClick={() => setSmsOpen(false)}>{t("complete.cancel")}</Button><Button onClick={() => { setSmsOpen(false); toast.success(t("complete.smsSent")); }}>{t("complete.sendSmsButton")}</Button></>}>
        <div className="rounded-md rounded-bl-xs border border-line bg-subtle p-comfortable text-left text-sm">{smsText}</div>
        <p className="mt-tight text-left text-[12px] text-faint">{t("complete.smsMeta", { count: smsText.length })}</p>
      </Modal>
    </main>
  );
}
