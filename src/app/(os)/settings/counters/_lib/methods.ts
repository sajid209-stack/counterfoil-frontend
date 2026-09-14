import type { PaymentMethod } from "@/lib/api";

/** Every way a till can take money, in the order a cashier reaches for them. */
export const METHODS: PaymentMethod[] = ["cash", "bkash", "bangla_qr", "card_terminal", "voucher", "credit"];

/** The existing message-key suffix for each method's name: "counters.methodBkash". */
export const METHOD_KEY: Record<PaymentMethod, string> = {
  cash: "Cash",
  bkash: "Bkash",
  bangla_qr: "BanglaQr",
  card_terminal: "CardTerminal",
  voucher: "Voucher",
  credit: "Credit",
};

/** Methods that settle through a payment provider, so need a live account to work. */
export const NEEDS_ACCOUNT = new Set<PaymentMethod>(["bkash", "bangla_qr", "card_terminal"]);
