import { isUsRegion } from "@/lib/region";
import type { PaymentMethod } from "@/lib/api";

/** Every way a till can take money, in the order a cashier reaches for them. */
const BD_METHODS: PaymentMethod[] = ["cash", "bkash", "bangla_qr", "card_terminal", "voucher", "credit"];
const US_METHODS: PaymentMethod[] = ["cash", "card_terminal", "cashapp", "voucher", "credit"];
/** A US business never sees bKash or Bangla QR, and a Bangladeshi one never sees Cash App. */
export const regionMethods = (): PaymentMethod[] => (isUsRegion() ? US_METHODS : BD_METHODS);

/** The existing message-key suffix for each method's name: "counters.methodBkash". */
export const METHOD_KEY: Record<PaymentMethod, string> = {
  cash: "Cash",
  bkash: "Bkash",
  bangla_qr: "BanglaQr",
  card_terminal: "CardTerminal",
  voucher: "Voucher",
  credit: "Credit",
  cashapp: "Cashapp",
  wallet: "Wallet",
  paylater: "Paylater",
};

/** Methods that settle through a payment provider, so need a live account to work. */
export const NEEDS_ACCOUNT = new Set<PaymentMethod>(["bkash", "bangla_qr", "card_terminal", "cashapp"]);
