import type { Order, OrderLine } from "@/lib/api/types";

/**
 * A made-up sale for the receipt preview in Settings: two lines (one booked
 * for a time), one line discount, 15% VAT and a cash payment with change.
 * The figures are minor units and add up: 3,000 + 500 − 100 discount = 3,400
 * taxable, VAT 450 + 60, total 3,910.
 */
export function buildSampleOrder(labels: { product: string; adult: string; permit: string; customer: string }, today: string): Order {
  const base = { admits: 1, refundedQuantity: 0, refundedAmount: 0, allocatedOrderDiscount: 0, taxClass: "standard" as const, taxRate: 0.15 };
  const entry: OrderLine = {
    ...base,
    id: "sample-1",
    productId: "sample-product",
    productName: labels.product,
    tierId: "sample-tier",
    tierName: labels.adult,
    quantity: 2,
    unitPrice: 150000,
    subtotal: 300000,
    lineDiscount: 0,
    taxableAmount: 300000,
    taxAmount: 45000,
    total: 345000,
    booking: { date: today, startTime: "10:00", endTime: "11:00" },
  };
  const permit: OrderLine = {
    ...base,
    id: "sample-2",
    productId: "sample-permit",
    productName: labels.permit,
    tierName: labels.permit,
    quantity: 1,
    unitPrice: 50000,
    subtotal: 50000,
    lineDiscount: 10000,
    taxableAmount: 40000,
    taxAmount: 6000,
    total: 46000,
  };
  const at = `${today}T10:24:00+06:00`;
  return {
    id: "sample-order",
    reference: "CF-2026-000123",
    status: "paid",
    channel: "counter",
    locationId: "sample-location",
    counterId: null,
    staffId: null,
    customerName: labels.customer,
    lines: [entry, permit],
    payments: [{ id: "sample-pay", method: "cash", amount: 391000, tendered: 400000, change: 9000, status: "confirmed", createdAt: at }],
    subtotal: 350000,
    lineDiscountTotal: 10000,
    orderDiscount: 0,
    discountTotal: 10000,
    taxTotal: 51000,
    total: 391000,
    createdAt: at,
    updatedAt: at,
  };
}
