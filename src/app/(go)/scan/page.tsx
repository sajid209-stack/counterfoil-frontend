"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { findTicketByCode, getOperator, listTickets, peekOrders, peekProducts, redeemTicket, scanMembership, ticketAdmits } from "@/lib/api";
import { formatMoney } from "@/lib/format";

export default function ScanPage() {
  const router = useRouter();
  const t = useTranslations("scan");
  const [code, setCode] = useState("");
  const samplesQ = useApiQuery(() => listTickets({ pageSize: 4 }), []);
  const opQ = useApiQuery(() => getOperator(), []);
  const currency = opQ.data?.currency ?? "BDT";

  const submit = async (value: string) => {
    const c = value.trim();
    if (!c) return;
    let outcome: {
      accept: boolean;
      code: string;
      reason: string;
      group?: { ticketId: string; tierName: string; admits: number; admitted: number };
      balance?: { orderId: string; ticketId: string; amount: number; amountLabel: string; currency: string };
    };

    // A membership card scans at the same gate as a ticket (§16.10), so the
    // one input takes both. Membership codes are CF-M-…; anything else falls
    // through to the ticket path.
    if (/^cf-m-/i.test(c)) {
      const res = await scanMembership(c);
      if (!res.ok) {
        outcome = { accept: false, code: c, reason: t("notFound") };
      } else {
        const { membership, admitted, reason } = res.data;
        const visits =
          membership.visitsLeft == null
            ? t("memberUnlimited")
            : t("memberVisitsLeft", { count: membership.visitsLeft });
        outcome = admitted
          ? {
              accept: true,
              code: membership.code,
              reason: `${membership.customerName} · ${membership.tierName} · ${visits}`,
            }
          : { accept: false, code: membership.code, reason: reason ?? t("notFound") };
      }
      sessionStorage.setItem("scan_result", JSON.stringify(outcome));
      router.push("/scan/result");
      return;
    }

    const ticket = findTicketByCode(c);
    if (!ticket) outcome = { accept: false, code: c, reason: t("notFound") };
    else if (ticket.status === "redeemed") outcome = { accept: false, code: ticket.code, reason: t("alreadyRedeemed") };
    else if (ticket.status === "void") outcome = { accept: false, code: ticket.code, reason: t("voidRefunded") };
    else {
      const admits = ticketAdmits(ticket);
      const productName = peekProducts().find((p) => p.id === ticket.productId)?.name ?? "";

      // Tickets are issued at checkout regardless of how much was actually
      // paid, so a deposit booking turns up at the gate holding a valid one.
      // Admitting it would be giving the balance away — the gate has to ask.
      const order = peekOrders().find((o) => o.id === ticket.orderId);
      const due = order ? Math.max(0, order.total - order.payments.reduce((sum, p) => sum + p.amount, 0)) : 0;
      if (due > 0 && order) {
        outcome = {
          accept: false,
          code: ticket.code,
          reason: [productName, ticket.tierName].filter(Boolean).join(" · "),
          balance: {
            orderId: order.id,
            ticketId: ticket.id,
            amount: due,
            amountLabel: formatMoney(due, currency),
            currency,
          },
          ...(admits > 1 ? { group: { ticketId: ticket.id, tierName: ticket.tierName, admits, admitted: ticket.admitted ?? 0 } } : {}),
        };
        sessionStorage.setItem("scan_result", JSON.stringify(outcome));
        router.push("/scan/result");
        return;
      }

      if (admits > 1) {
        // Group ticket (a Family admits 4): the result screen takes the count.
        outcome = { accept: true, code: ticket.code, reason: `${productName} · ${ticket.tierName}`, group: { ticketId: ticket.id, tierName: ticket.tierName, admits, admitted: ticket.admitted ?? 0 } };
      } else {
        await redeemTicket(ticket.id);
        outcome = { accept: true, code: ticket.code, reason: [productName, ticket.tierName].filter(Boolean).join(" · ") || t("validTicket") };
      }
    }
    sessionStorage.setItem("scan_result", JSON.stringify(outcome));
    router.push("/scan/result");
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-section px-section py-hero">
      <div>
        <p className="type-label text-[13px] text-brand-foreground">{t("gateLabel")}</p>
        <h1 className="type-h1 mt-tight text-2xl">{t("title")}</h1>
      </div>

      <div className="flex h-40 flex-col items-center justify-center gap-tight rounded-go border border-dashed border-line text-faint">
        <ScanLine size={40} strokeWidth={1.5} />
        <span className="text-[13px]">{t("cameraHint")}</span>
      </div>

      <div className="flex min-w-0 gap-tight">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(code)}
          placeholder={t("codePlaceholder")}
          className="h-12 w-full min-w-0 flex-1 rounded-go-sm border border-line bg-card px-comfortable font-mono text-sm outline-none focus:border-inverse"
        />
        <Button shape="pill" size="lg" className="shrink-0" onClick={() => submit(code)}>{t("check")}</Button>
      </div>

      {samplesQ.data && samplesQ.data.data.length > 0 && (
        <div className="flex flex-col gap-inline">
          <span className="type-label text-[13px] text-faint">{t("trySample")}</span>
          <div className="flex flex-wrap gap-inline">
            {samplesQ.data.data.map((t) => (
              <button key={t.id} type="button" onClick={() => submit(t.code)} className="rounded-full border border-line bg-card px-tight py-inline font-mono text-[13px] active:bg-ember/10">
                {t.code}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
