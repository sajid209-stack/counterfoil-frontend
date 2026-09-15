import type { ComponentProps } from "react";
import { OrderLinesDetail } from "@/components/OrderLinesDetail";
import { ReceiptFooter, ReceiptHeader } from "@/components/ReceiptParts";
import type { Order } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";

type Header = ComponentProps<typeof ReceiptHeader>;

/** An order's receipt: the business, the reference and date, every line with its VAT, and the footer message. */
export function ReceiptSheet({
  order,
  operator,
  place,
  tax,
  footer,
  className,
}: {
  order: Order;
  operator: Header["operator"];
  place: Header["place"];
  tax: Header["tax"];
  footer?: ComponentProps<typeof ReceiptFooter>["message"];
  className?: string;
}) {
  return (
    // Its own width, so the receipt prints the same size alone or ahead of the tickets.
    <div className={cn("mx-auto w-full max-w-md card-surface p-major print:border-0", className)}>
      <ReceiptHeader operator={operator} place={place} tax={tax}>
        <p className="mt-inline font-mono text-[12px] text-muted">
          {order.reference} · {formatDate(order.createdAt)}
        </p>
      </ReceiptHeader>
      <OrderLinesDetail order={order} />
      <ReceiptFooter message={footer} />
    </div>
  );
}
