/* F11 — the order-of-operations engine. ONE implementation shared by the POS
   cart, checkout(), counter add-ons and the seed generator, so every order in
   the system is built by the same math.

   Per line (exact order):
     1. subtotal = unitPrice × quantity
     2. apply lineDiscount
     3. allocate orderDiscount pro rata on (subtotal − lineDiscount)
     4. taxableAmount = subtotal − lineDiscount − allocatedOrderDiscount
     5. taxAmount = round(taxableAmount × taxRate)   — per line
     6. total = taxableAmount + taxAmount

   Order totals are sums of line values. The order's tax is the SUM OF LINE
   TAXES — never computed on the order total. */
import type { Minor, OrderLine, OrderLineBooking, TaxClass } from "@/lib/api/types";

export interface LineInput {
  productId: string;
  productName: string;
  tierId?: string;
  tierName: string;
  admits?: number; // people per unit; 0 for add-ons — defaults to 1
  quantity: number;
  unitPrice: Minor;
  lineDiscount?: Minor; // absolute, already resolved from amount-or-percent
  taxClass?: TaxClass;
  taxRate?: number; // fraction (0.15); defaults 0
  /** Index into the SAME input array of this add-on's parent line. */
  parentIndex?: number;
  booking?: OrderLineBooking;
}

/** Largest-remainder allocation of an integer discount across integer bases.
 *  floor(discount × base / totalBase) each, then the leftover units go one at
 *  a time to the largest fractional remainders. Sums EXACTLY to `discount`. */
export function allocateOrderDiscount(bases: number[], discount: Minor): Minor[] {
  const totalBase = bases.reduce((s, b) => s + Math.max(0, b), 0);
  if (discount <= 0 || totalBase <= 0) return bases.map(() => 0);
  const raw = bases.map((b) => (discount * Math.max(0, b)) / totalBase);
  const alloc = raw.map(Math.floor);
  let left = discount - alloc.reduce((s, a) => s + a, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) alloc[order[k].i] += 1;
  const sum = alloc.reduce((s, a) => s + a, 0);
  if (sum !== discount) throw new Error(`allocation invariant broken: ${sum} !== ${discount}`);
  return alloc;
}

export interface OrderTotals {
  subtotal: Minor;
  lineDiscountTotal: Minor;
  orderDiscount: Minor;
  discountTotal: Minor;
  taxTotal: Minor;
  total: Minor;
}

/** Build final OrderLines (ids `${refPrefix}-L{n}`) + order totals. */
export function buildOrderLines(
  inputs: LineInput[],
  orderDiscount: Minor,
  refPrefix: string,
): { lines: OrderLine[]; totals: OrderTotals } {
  const subtotals = inputs.map((l) => l.unitPrice * l.quantity);
  const lineDiscounts = inputs.map((l, i) => Math.min(Math.max(0, l.lineDiscount ?? 0), Math.max(0, subtotals[i])));
  const bases = subtotals.map((s, i) => s - lineDiscounts[i]);
  const allocated = allocateOrderDiscount(bases, Math.max(0, orderDiscount));

  const lines: OrderLine[] = inputs.map((l, i) => {
    const taxableAmount = subtotals[i] - lineDiscounts[i] - allocated[i];
    const taxRate = l.taxRate ?? 0;
    const taxAmount = Math.round(taxableAmount * taxRate);
    return {
      id: `${refPrefix}-L${i}`,
      parentLineId: l.parentIndex != null ? `${refPrefix}-L${l.parentIndex}` : undefined,
      productId: l.productId,
      productName: l.productName,
      tierId: l.tierId,
      tierName: l.tierName,
      admits: l.admits ?? 1,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      subtotal: subtotals[i],
      lineDiscount: lineDiscounts[i],
      allocatedOrderDiscount: allocated[i],
      taxableAmount,
      taxClass: l.taxClass ?? "standard",
      taxRate,
      taxAmount,
      total: taxableAmount + taxAmount,
      booking: l.booking,
      refundedQuantity: 0,
      refundedAmount: 0,
    };
  });

  const sum = (f: (l: OrderLine) => number) => lines.reduce((s, l) => s + f(l), 0);
  const lineDiscountTotal = sum((l) => l.lineDiscount);
  const totals: OrderTotals = {
    subtotal: sum((l) => l.subtotal),
    lineDiscountTotal,
    orderDiscount: Math.max(0, orderDiscount),
    discountTotal: lineDiscountTotal + Math.max(0, orderDiscount),
    taxTotal: sum((l) => l.taxAmount),
    total: sum((l) => l.total),
  };
  return { lines, totals };
}

/** Tax fraction for a class against the business rates (percent inputs). */
export function taxRateOf(taxClass: TaxClass | undefined, standardPct: number, reducedPct: number): number {
  if (taxClass === "exempt") return 0;
  if (taxClass === "reduced") return reducedPct / 100;
  return standardPct / 100;
}

/* ── Unit test — the allocation invariant, executed at module load outside
   production builds so a regression fails loudly in dev/CI. ─────────────── */
function selfTest() {
  const cases: [number[], number][] = [
    [[100, 100, 100], 100], // 33/33/34 — remainder distribution
    [[333, 333, 334], 1000],
    [[1, 1, 1], 2],
    [[2500, 200, 1300], 400], // the §8 worked example
    [[999999, 1], 777],
    [[0, 500], 250], // zero-base line gets nothing
  ];
  for (const [bases, d] of cases) {
    const a = allocateOrderDiscount(bases, d);
    const sum = a.reduce((s, x) => s + x, 0);
    if (sum !== d) throw new Error(`orderMath selfTest: sum(${a}) !== ${d} for bases ${bases}`);
    if (a.some((x) => x < 0)) throw new Error(`orderMath selfTest: negative allocation for bases ${bases}`);
  }
  // Order of operations: line discount before allocation, tax per line.
  const { lines, totals } = buildOrderLines(
    [
      { productId: "a", productName: "A", tierName: "T", quantity: 2, unitPrice: 500, lineDiscount: 100, taxRate: 0.15 },
      { productId: "b", productName: "B", tierName: "T", quantity: 1, unitPrice: 300, taxRate: 0.075 },
    ],
    120,
    "TEST",
  );
  if (totals.subtotal !== 1300) throw new Error("orderMath selfTest: subtotal");
  if (lines[0].allocatedOrderDiscount + lines[1].allocatedOrderDiscount !== 120) throw new Error("orderMath selfTest: allocation");
  if (totals.taxTotal !== lines[0].taxAmount + lines[1].taxAmount) throw new Error("orderMath selfTest: tax must sum from lines");
  if (totals.total !== totals.subtotal - totals.discountTotal + totals.taxTotal) throw new Error("orderMath selfTest: total identity");
}
if (process.env.NODE_ENV !== "production") selfTest();
