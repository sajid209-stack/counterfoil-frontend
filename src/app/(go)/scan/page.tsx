"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { findTicketByCode, listTickets, peekProducts, redeemTicket, ticketAdmits } from "@/lib/api";

export default function ScanPage() {
  const router = useRouter();
  const t = useTranslations("scan");
  const [code, setCode] = useState("");
  const samplesQ = useApiQuery(() => listTickets({ pageSize: 4 }), []);

  const submit = async (value: string) => {
    const c = value.trim();
    if (!c) return;
    const ticket = findTicketByCode(c);
    let outcome: { accept: boolean; code: string; reason: string; group?: { ticketId: string; tierName: string; admits: number; admitted: number } };
    if (!ticket) outcome = { accept: false, code: c, reason: t("notFound") };
    else if (ticket.status === "redeemed") outcome = { accept: false, code: ticket.code, reason: t("alreadyRedeemed") };
    else if (ticket.status === "void") outcome = { accept: false, code: ticket.code, reason: t("voidRefunded") };
    else {
      const admits = ticketAdmits(ticket);
      const productName = peekProducts().find((p) => p.id === ticket.productId)?.name ?? "";
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
        <p className="type-label text-[13px] text-ember">{t("gateLabel")}</p>
        <h1 className="type-h1 mt-tight text-2xl">{t("title")}</h1>
      </div>

      <div className="flex h-40 flex-col items-center justify-center gap-tight rounded-sm border border-dashed border-line text-faint">
        <ScanLine size={40} strokeWidth={1.5} />
        <span className="text-[12px]">{t("cameraHint")}</span>
      </div>

      <div className="flex min-w-0 gap-tight">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(code)}
          placeholder={t("codePlaceholder")}
          className="h-12 w-full min-w-0 flex-1 rounded-sm border border-line bg-card px-comfortable font-mono text-sm outline-none focus:border-inverse"
        />
        <Button size="lg" className="shrink-0" onClick={() => submit(code)}>{t("check")}</Button>
      </div>

      {samplesQ.data && samplesQ.data.data.length > 0 && (
        <div className="flex flex-col gap-inline">
          <span className="type-label text-[11px] text-faint">{t("trySample")}</span>
          <div className="flex flex-wrap gap-inline">
            {samplesQ.data.data.map((t) => (
              <button key={t.id} type="button" onClick={() => submit(t.code)} className="rounded-xs border border-line bg-card px-tight py-inline font-mono text-[11px] active:bg-ember/10">
                {t.code}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
