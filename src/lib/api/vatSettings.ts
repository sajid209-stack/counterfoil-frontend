import { delay, ok, patchTaxConfigState } from "./client";
import type { ApiResult } from "./types";

/*
 * Bangladesh VAT registration and invoicing (settings.v2 vat-settings).
 *
 * The RATES live in the tax config and on the operator; this is the other half
 * of VAT: who the business is registered as, what its Mushak-6.3 tax invoices
 * are numbered like, and how often it files. Singleton, mock-backed.
 *
 * Receipts print the registration line from the tax config
 * (`registrationNumber` / `showOnReceipts`), so a save here mirrors the BIN and
 * the print switch into it — the receipt reader does not change, and cannot
 * disagree with this page.
 */
export type VatReturnPeriod = "monthly" | "quarterly";

export interface VatSettings {
  registered: boolean;
  /** The 13 digits of the Business Identification Number, no dashes. */
  bin: string;
  legalName: string;
  address: string;
  /** YYYY-MM-DD, or empty when not given. */
  registeredOn: string;
  /** Print the registration line on receipts. */
  printOnReceipts: boolean;
  /** Start of every tax-invoice number, like "M63-". */
  invoicePrefix: string;
  /** The number the next tax invoice will carry. */
  invoiceNext: number;
  returnPeriod: VatReturnPeriod;
}

export const BIN_LENGTH = 13;

/** Digits only, so "000123456-0201" and "000123456 0201" are the same BIN. */
export const binDigits = (raw: string): string => raw.replace(/\D/g, "");

/** 000123456-0201: nine digits, a dash, four — how the NBR writes it. */
export const formatBin = (digits: string): string =>
  digits.length > 9 ? `${digits.slice(0, 9)}-${digits.slice(9)}` : digits;

/** The invoice number as it will print: prefix, then six digits. */
export const invoiceNumber = (prefix: string, n: number): string => `${prefix}${String(n).padStart(6, "0")}`;

const seed: VatSettings = {
  registered: true,
  bin: "0001234560201",
  legalName: "Lalbagh Leisure Ltd.",
  address: "12 Lalbagh Road, Dhaka 1211",
  registeredOn: "2022-07-01",
  printOnReceipts: true,
  invoicePrefix: "M63-",
  invoiceNext: 1284,
  returnPeriod: "monthly",
};

let state: VatSettings = structuredClone(seed);

export async function getVatSettings(): Promise<ApiResult<VatSettings>> {
  await delay();
  return ok(structuredClone(state));
}

export async function updateVatSettings(next: VatSettings): Promise<ApiResult<VatSettings>> {
  await delay();
  state = structuredClone(next);
  const live = state.registered && state.bin.length === BIN_LENGTH;
  patchTaxConfigState({
    registrationNumber: live ? formatBin(state.bin) : undefined,
    showOnReceipts: live && state.printOnReceipts,
  });
  return ok(structuredClone(state));
}
