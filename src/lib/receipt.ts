import type { Operator, ReceiptSettings } from "@/lib/api/types";

/** What a receipt prints when nobody has opened its settings. */
export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  showLogo: true,
  logoSize: "medium",
  paper: "80mm",
  showCashier: true,
  showCustomer: true,
  showLookupQr: true,
};

/** The operator's receipt settings, every field filled. */
export const receiptSettingsOf = (op?: Pick<Operator, "receipt"> | null): ReceiptSettings => ({ ...DEFAULT_RECEIPT_SETTINGS, ...(op?.receipt ?? {}) });

/** The logo's printed width, in millimetres, for each size. */
export const LOGO_WIDTH_MM: Record<ReceiptSettings["logoSize"], number> = { small: 24, medium: 36, large: 48 };

/** The printable width of each paper, in millimetres (a roll prints inside its margins). */
export const PAPER_WIDTH_MM: Record<ReceiptSettings["paper"], number> = { "80mm": 72, "58mm": 48, a4: 180 };
