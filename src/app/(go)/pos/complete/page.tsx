"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, MessageSquare, Printer } from "lucide-react";
import { Button, Modal, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { DEFAULT_SMS_TEMPLATE, renderSms } from "@/lib/sms";

const TODAY = "2026-07-29";

export default function CompletePage() {
  const router = useRouter();
  const toast = useToast();
  interface ReceiptLine { name: string; qty: number; amount: number; child?: boolean }
  interface Receipt { lines: ReceiptLine[]; subtotal: number; lineDiscountTotal: number; orderDiscount: number; tax: number; total: number }
  const [info, setInfo] = useState<{ code: string; change: number; balance?: number; receipt?: Receipt; payments?: { method: string; amount: number }[] } | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
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
        <h1 className="type-h1 text-2xl text-fg">Ticket issued</h1>
      </div>

      {info && (
        <>
          {/* The brand moment — a literal ticket stub with a perforated tear line. */}
          <div className="relative w-full">
            <div className="rounded-md bg-ink px-section pb-major pt-major text-paper">
              <p className="type-label text-[11px] text-faint">Booking reference</p>
              <p className="mt-tight break-all font-mono text-2xl tracking-tight sm:text-3xl">{info.code}</p>
            </div>
            {/* perforation */}
            <div className="relative flex items-center">
              <span className="absolute -left-2 h-4 w-4 rounded-full bg-surface" aria-hidden />
              <span className="absolute -right-2 h-4 w-4 rounded-full bg-surface" aria-hidden />
              <span className="mx-major flex-1 border-t-2 border-dashed border-paper/40" aria-hidden />
            </div>
            <div className="rounded-md bg-ink px-section pb-major pt-tight text-paper">
              <p className="font-mono text-[12px] text-faint">Present at the gate · scan to check in</p>
            </div>
          </div>

          {info.change > 0 && (
            <p className="type-body text-muted">
              Change due <span className="font-mono text-fg">{formatMoney(info.change)}</span>
            </p>
          )}
          {(info.balance ?? 0) > 0 && (
            <p className="type-body text-muted">
              Balance due at arrival <span className="font-mono text-fg">{formatMoney(info.balance!)}</span>
            </p>
          )}

          {/* Receipt step — Print · SMS · None */}
          <div className="flex w-full gap-tight">
            <button type="button" onClick={() => setPrintOpen(true)} className="flex h-14 flex-1 items-center justify-center gap-inline rounded-sm border border-line bg-card text-sm active:bg-ember/10"><Printer size={16} strokeWidth={1.5} /> Print</button>
            <button type="button" onClick={() => setSmsOpen(true)} className="flex h-14 flex-1 items-center justify-center gap-inline rounded-sm border border-line bg-card text-sm active:bg-ember/10"><MessageSquare size={16} strokeWidth={1.5} /> SMS</button>
            <button type="button" onClick={() => router.push("/pos")} className="h-14 flex-1 rounded-sm border border-line bg-card text-sm text-muted active:bg-ember/10">No receipt</button>
          </div>
        </>
      )}

      <Button size="lg" fullWidth onClick={() => router.push("/pos")}>New sale</Button>

      {/* Print preview — what comes off the thermal printer. Mode-locked ink/paper. */}
      <Modal open={printOpen} onClose={() => setPrintOpen(false)} title="Print preview" footer={<><Button variant="secondary" onClick={() => setPrintOpen(false)}>Cancel</Button><Button onClick={() => { setPrintOpen(false); toast.success("Sent to the counter printer."); }}>Print</Button></>}>
        <div className="mx-auto w-64 bg-white p-comfortable text-left font-mono text-[12px] text-black shadow-sm">
          <p className="text-center text-[13px] font-bold uppercase tracking-wider">{business}</p>
          <p className="mt-tight text-center text-[11px]">{TODAY}</p>
          <div className="my-tight border-t border-dashed border-black/40" />
          <p className="text-center text-[11px]">TICKET</p>
          <p className="my-tight text-center text-lg font-bold tracking-tight">{info?.code}</p>
          <div className="my-tight border-t border-dashed border-black/40" />
          {/* F11 — the receipt shows lines, discounts and the tax breakdown. */}
          {info?.receipt && (
            <>
              {info.receipt.lines.map((l, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">{l.child ? "  + " : ""}{l.qty > 1 ? `${l.qty}× ` : ""}{l.name}</span>
                  <span className="shrink-0">{formatMoney(l.amount)}</span>
                </div>
              ))}
              <div className="my-tight border-t border-dashed border-black/40" />
              <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(info.receipt.subtotal)}</span></div>
              {info.receipt.lineDiscountTotal > 0 && <div className="flex justify-between"><span>Line discounts</span><span>-{formatMoney(info.receipt.lineDiscountTotal)}</span></div>}
              {info.receipt.orderDiscount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{formatMoney(info.receipt.orderDiscount)}</span></div>}
              <div className="flex justify-between"><span>VAT</span><span>{formatMoney(info.receipt.tax)}</span></div>
              <div className="flex justify-between font-bold"><span>TOTAL</span><span>{formatMoney(info.receipt.total)}</span></div>
              {(info.payments ?? []).map((p, i) => (
                <div key={i} className="flex justify-between"><span>Paid {p.method}</span><span>{formatMoney(p.amount)}</span></div>
              ))}
              <div className="my-tight border-t border-dashed border-black/40" />
            </>
          )}
          {(info?.balance ?? 0) > 0 && <p>Balance at arrival: {formatMoney(info!.balance!)}</p>}
          <p className="mt-tight text-center text-[11px]">Present at the gate · scan to check in</p>
          <p className="mt-tight text-center text-[10px]">Powered by Counterfoil</p>
        </div>
      </Modal>

      {/* SMS preview — the exact message, rendered from the business template. */}
      <Modal open={smsOpen} onClose={() => setSmsOpen(false)} title="Send by SMS" footer={<><Button variant="secondary" onClick={() => setSmsOpen(false)}>Cancel</Button><Button onClick={() => { setSmsOpen(false); toast.success("SMS sent."); }}>Send SMS</Button></>}>
        <div className="rounded-md rounded-bl-xs border border-line bg-subtle p-comfortable text-left text-sm">{smsText}</div>
        <p className="mt-tight text-left text-[12px] text-faint">{smsText.length} characters · template editable in Settings → Business.</p>
      </Modal>
    </main>
  );
}
