"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  PageShell,
  StatusPill,
  useToast,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOrder, listTickets, refundOrder } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-card p-major">
      <h2 className="type-label mb-section text-[12px] text-muted">{title}</h2>
      {children}
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const order = useApiQuery(() => getOrder(params.id), [params.id]);
  const ticketsQ = useApiQuery(() => listTickets({ pageSize: 100, filters: { orderId: params.id } }), [params.id]);
  const [confirm, setConfirm] = useState(false);
  const [refunding, setRefunding] = useState(false);

  if (!order.loading && (order.error || !order.data)) {
    return (
      <PageShell title="Order">
        <EmptyState title="Order not found" action={<Button onClick={() => router.push("/orders")}>Back to orders</Button>} />
      </PageShell>
    );
  }

  const o = order.data;
  const canRefund = o && (o.status === "paid" || o.status === "partial");

  const doRefund = async () => {
    setRefunding(true);
    const res = await refundOrder(params.id);
    setRefunding(false);
    setConfirm(false);
    if (res.ok) {
      toast.success("Order refunded.");
      order.reload();
    } else {
      toast.error(res.error.message);
    }
  };

  return (
    <PageShell
      title={o?.reference ?? "Order"}
      actions={
        o ? (
          <div className="flex items-center gap-tight">
            <StatusPill status={o.status} />
            {canRefund && (
              <Button variant="secondary" icon={<RotateCcw size={16} strokeWidth={1.5} />} onClick={() => setConfirm(true)}>
                Refund
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      <Link href="/orders" className="mb-section inline-flex items-center gap-inline text-[13px] text-faint hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.5} /> Orders
      </Link>

      {order.loading || !o ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : (
        <div className="flex flex-col gap-section pb-hero">
          <div className="grid gap-section sm:grid-cols-3">
            <Card title="Placed">
              <p className="text-sm">{formatDateTime(o.createdAt)}</p>
              <p className="mt-inline font-mono text-[12px] text-faint">{o.channel}{o.customerName ? ` · ${o.customerName}` : ""}</p>
            </Card>
            <Card title="Total">
              <p className="font-mono text-2xl">{formatMoney(o.total)}</p>
            </Card>
            <Card title="Paid">
              <p className="font-mono text-2xl">{formatMoney(o.payments.reduce((s, p) => s + p.amount, 0))}</p>
            </Card>
          </div>

          <Card title="Items">
            <table className="w-full text-sm">
              <tbody>
                {o.lines.map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-0">
                    <td className="py-tight">
                      <div className="font-medium">{l.productName}</div>
                      <div className="font-mono text-[11px] text-faint">{l.tierName}</div>
                    </td>
                    <td className="py-tight text-center font-mono text-[13px]">×{l.quantity}</td>
                    <td className="py-tight text-right font-mono text-[13px]">{formatMoney(l.unitPrice * l.quantity)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td className="pt-tight text-muted" colSpan={2}>Subtotal</td><td className="pt-tight text-right font-mono">{formatMoney(o.subtotal)}</td></tr>
                <tr><td className="text-muted" colSpan={2}>Tax</td><td className="text-right font-mono">{formatMoney(o.tax)}</td></tr>
                <tr><td className="font-medium" colSpan={2}>Total</td><td className="text-right font-mono font-medium">{formatMoney(o.total)}</td></tr>
              </tfoot>
            </table>
          </Card>

          <div className="grid gap-section sm:grid-cols-2">
            <Card title="Payments">
              {o.payments.length === 0 ? (
                <p className="text-[13px] text-faint">No payments recorded.</p>
              ) : (
                o.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border-b border-line py-tight text-sm last:border-0">
                    <span className="font-mono text-[12px] text-muted">{p.method}</span>
                    <span className="font-mono text-[13px]">{formatMoney(p.amount)}</span>
                  </div>
                ))
              )}
            </Card>
            <Card title={`Tickets (${ticketsQ.data?.data.length ?? 0})`}>
              {ticketsQ.loading ? (
                <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
              ) : (ticketsQ.data?.data.length ?? 0) === 0 ? (
                <p className="text-[13px] text-faint">No tickets issued.</p>
              ) : (
                ticketsQ.data!.data.map((t) => (
                  <div key={t.id} className="flex items-center justify-between border-b border-line py-tight text-sm last:border-0">
                    <span className="font-mono text-[12px]">{t.code}</span>
                    <StatusPill status={t.status === "issued" ? "confirmed" : t.status === "redeemed" ? "active" : "void"}>{t.status}</StatusPill>
                  </div>
                ))
              )}
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={doRefund}
        title="Refund this order?"
        message="This reverses the sale and voids its tickets."
        confirmLabel="Refund"
        loading={refunding}
      />
    </PageShell>
  );
}
