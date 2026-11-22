import type { Location, Operator, Order, ReceiptSettings, TaxConfig } from "@/lib/api/types";
import { LOGO_WIDTH_MM, PAPER_WIDTH_MM } from "@/lib/receipt";

export type ReceiptOperator = Pick<Operator, "name" | "contactPhone" | "website" | "logo" | "receiptFooter">;
export type ReceiptPlace = Pick<Location, "name" | "addressLine1" | "city"> | null | undefined;
export type ReceiptTax = Pick<TaxConfig, "taxName" | "registrationNumber" | "showOnReceipts"> | null | undefined;
export type ReceiptPaper = ReceiptSettings["paper"];

/** Everything one receipt prints, whatever paper it prints on. */
export interface ReceiptData {
  order: Order;
  operator: ReceiptOperator;
  place?: ReceiptPlace;
  tax?: ReceiptTax;
  /** The settings after any one-off override from the print screen. */
  settings: ReceiptSettings;
  /** The team member who made the sale. */
  cashier?: string | null;
  counter?: string | null;
  /** The customer record's phone, when the order is attached to one. */
  customerPhone?: string | null;
}

/** The type scale of each paper: a roll is read at arm's length, an A4 page on a desk. */
export function receiptType(paper: ReceiptPaper) {
  if (paper === "58mm") return { body: "text-xs", meta: "text-2xs", name: "text-base", total: "text-md", title: "text-sm" };
  if (paper === "a4") return { body: "text-base", meta: "text-sm", name: "text-xl", total: "text-xl", title: "text-2xl" };
  return { body: "text-sm", meta: "text-xs", name: "text-md", total: "text-lg", title: "text-base" };
}

/** The logo's printed width in millimetres: its size setting, never wider than the paper. */
export const logoWidthMm = (settings: ReceiptSettings) => Math.min(LOGO_WIDTH_MM[settings.logoSize], PAPER_WIDTH_MM[settings.paper]);

/** The width of the receipt column in millimetres and the paper's side margin on screen. */
export const stripMetrics = (paper: ReceiptPaper) =>
  paper === "a4" ? { column: PAPER_WIDTH_MM.a4, pad: 15 } : { column: PAPER_WIDTH_MM[paper], pad: paper === "58mm" ? 5 : 4 };
