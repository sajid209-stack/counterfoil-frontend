"use client";

import { useState } from "react";
import { useApiQuery } from "@/lib/useApi";
import { getCustomer, getOperator, getOrder, getTaxConfig, listCounters, listLocations, listStaff } from "@/lib/api";
import { receiptSettingsOf } from "@/lib/receipt";
import type { ReceiptSettings } from "@/lib/api/types";
import type { ReceiptData } from "./types";

/**
 * Everything a printed receipt needs, fetched together so the print dialog
 * never opens on a header still missing its address, its logo or the name of
 * who served. `ready` is true once every query has settled.
 */
export function useReceiptData(orderId: string) {
  const orderQ = useApiQuery(() => getOrder(orderId), [orderId]);
  const opQ = useApiQuery(() => getOperator(), []);
  const taxQ = useApiQuery(() => getTaxConfig(), []);
  const locQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 200 }), []);
  const counterQ = useApiQuery(() => listCounters({ pageSize: 200 }), []);
  const customerId = orderQ.data?.customerId ?? null;
  const customerQ = useApiQuery(
    () => (customerId ? getCustomer(customerId) : Promise.resolve({ ok: true as const, data: null })),
    [customerId],
  );
  const order = orderQ.data;
  const ready = !orderQ.loading && !opQ.loading && !taxQ.loading && !locQ.loading && !staffQ.loading && !counterQ.loading && !customerQ.loading;
  return {
    ready,
    order,
    operator: opQ.data,
    tax: taxQ.data,
    place: order ? locQ.data?.data.find((l) => l.id === order.locationId) ?? null : null,
    cashier: order?.staffId ? staffQ.data?.data.find((s) => s.id === order.staffId)?.name ?? null : null,
    counter: order?.counterId ? counterQ.data?.data.find((c) => c.id === order.counterId)?.name ?? null : null,
    customerPhone: customerQ.data?.phone ?? null,
  };
}

/**
 * This print's overrides of the receipt settings: the logo on or off, the
 * paper. Local to the page and never saved — Settings → Business profile owns
 * the defaults. `papers` limits the choice (a receipt with tickets on one
 * strip is a roll, never A4).
 */
export function usePrintOptions(operator: { logo?: string | null; receipt?: ReceiptSettings } | undefined, papers: ReceiptSettings["paper"][]) {
  const base = receiptSettingsOf(operator);
  const [logoOverride, setLogo] = useState<boolean | null>(null);
  const [paperOverride, setPaper] = useState<ReceiptSettings["paper"] | null>(null);
  const wanted = paperOverride ?? base.paper;
  const paper = papers.includes(wanted) ? wanted : papers[0];
  const hasLogo = !!operator?.logo;
  const settings: ReceiptSettings = { ...base, paper, showLogo: hasLogo && (logoOverride ?? base.showLogo) };
  return { settings, hasLogo, setLogo, setPaper, papers };
}

export type { ReceiptData };
