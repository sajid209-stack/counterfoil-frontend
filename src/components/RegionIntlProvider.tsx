"use client";

import { useMemo, type ReactNode } from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { useRegionCurrency } from "@/lib/useRegion";

/*
 * The app's messages, in the active business's region (lib/region).
 *
 * The catalogue is written for Bangladesh: "VAT", "৳", an 01… mobile number.
 * A US business reads the same screens with "tax", "$" and a US number — the
 * words are the same everywhere else, so the catalogue is not forked; its
 * Bangladesh-only words are swapped when the business is in the US. The server
 * always renders the default, and the swap happens on the client after the
 * region store says so, so hydration never mismatches.
 */

const usText = (s: string): string =>
  s
    .replace(/bKash, card or Bangla QR/g, "Card, Apple Pay, Google Pay or Cash App Pay")
    .replace(/bKash, Bangla QR and card/g, "Card and Cash App Pay")
    .replace(/cash, bKash or card/g, "cash, card or Cash App Pay")
    .replace(/card or bKash/g, "card or Cash App")
    .replace(/bKash or a card account/g, "a card account")
    .replace(/your bKash or bank app/g, "Cash App")
    .replace(/৳/g, "$")
    .replace(/(^|[.!?]\s+)VAT\b/g, "$1Tax")
    .replace(/\bVAT\b/g, "tax")
    .replace(/\b01\d{3}[- ]?\d{6}\b/g, "(555) 555-0100");

function localize(node: unknown): unknown {
  if (typeof node === "string") return usText(node);
  if (Array.isArray(node)) return node.map(localize);
  if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, localize(v)]));
  return node;
}

export function RegionIntlProvider({ locale, messages, children }: { locale: string; messages: AbstractIntlMessages; children: ReactNode }) {
  const currency = useRegionCurrency();
  const shown = useMemo(() => (currency === "USD" ? (localize(messages) as AbstractIntlMessages) : messages), [currency, messages]);
  return (
    <NextIntlClientProvider locale={locale} messages={shown}>
      {children}
    </NextIntlClientProvider>
  );
}
