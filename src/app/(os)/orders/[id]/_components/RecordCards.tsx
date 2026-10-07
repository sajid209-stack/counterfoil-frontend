"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, StatusPill } from "@/components/ui";
import type { Order, Ticket } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import { Quiet, Section } from "./Section";

/**
 * The record around the sale: what was issued, what has been forgiven, what has
 * happened since, and what staff have noted. Short standing cards, so they
 * live in the rail beside the sale rather than being stretched to match it.
 */

/** Tickets issued for this order. Each row opens the ticket. This card can say
 *  what was issued and nothing else about it — which code currently scans, what
 *  happened at the gate, whether it was replaced and why are all the ticket's
 *  own record, and re-issuing a lost one has to live somewhere. The whole row is
 *  the target, as a table row is, so a phone is not aiming at a code. */
export function TicketsCard({ tickets, loading, className }: { tickets: Ticket[]; loading: boolean; className?: string }) {
  const t = useTranslations("orders");
  const enumL = useEnumLabels();
  return (
    <Section title={t("cardTickets", { count: tickets.length })} className={className} id="order-tickets">
      {loading ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /></div>
      ) : tickets.length === 0 ? (
        <Quiet>{t("noTickets")}</Quiet>
      ) : (
        <ul>
          {tickets.map((tk) => (
            <li key={tk.id}>
              <Link
                href={`/tickets/${tk.id}`}
                className="-mx-inline flex min-h-11 items-center justify-between gap-tight rounded-sm border-b border-line px-inline py-tight text-sm hover:bg-muted-wash"
              >
                <span className="min-w-0 break-all font-mono text-[12px]">{tk.code}</span>
                <span className="flex shrink-0 items-center gap-inline">
                  {/* A ticket has its own lifecycle, so it names its own tone
                      rather than borrowing an order word. Issued = exists, not
                      used yet. Redeemed = done. */}
                  <StatusPill tone={tk.status === "issued" ? "info" : tk.status === "redeemed" ? "success" : "neutral"}>{enumL.status(tk.status)}</StatusPill>
                  <ChevronRight size={15} strokeWidth={1.75} aria-hidden className="text-muted" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Balances cleared without a refund. The old page recorded these and never
 *  showed them — a forgiven balance left no trace on the order but a line of
 *  history. Drawn only when there is one. */
export function WriteOffsCard({ o, className }: { o: Order; className?: string }) {
  const t = useTranslations("orders");
  const tw = useTranslations("orders.wo");
  const list = o.writeOffs ?? [];
  if (list.length === 0) return null;
  const label = (c: string) =>
    c === "uncollectible" ? t("woUncollectible") : c === "customer_dispute" ? t("woCustomerDispute") : c === "business_decision" ? t("woBusinessDecision") : t("woAdministrative");
  const total = list.reduce((s, w) => s + w.amount, 0);
  return (
    <Section title={tw("title")} className={className} id="order-writeoffs">
      <ul>
        {list.map((w, i) => (
          <li key={i} data-writeoff data-amount={w.amount} className="border-b border-line py-tight text-[13px] first:pt-0 last:border-0 last:pb-0">
            <p className="flex items-baseline justify-between gap-tight">
              <span className="font-medium">{label(w.category)}</span>
              <span className="shrink-0 tabular-nums">{formatMoney(w.amount)}</span>
            </p>
            {w.reason && <p className="mt-inline break-words">{w.reason}</p>}
            <p className="mt-inline text-[12px] text-muted">{formatDateTime(w.at)} · {w.who}</p>
          </li>
        ))}
      </ul>
      {list.length > 1 && (
        <p className="mt-tight flex justify-between border-t border-line pt-tight text-[13px] font-medium">
          <span>{tw("total")}</span>
          <span className="tabular-nums">{formatMoney(total)}</span>
        </p>
      )}
    </Section>
  );
}

/** What has happened to the order since the sale, newest first. */
export function HistoryCard({ o, className }: { o: Order; className?: string }) {
  const t = useTranslations("orders");
  const list = [...(o.history ?? [])].reverse();
  return (
    <Section title={t("cardHistory")} className={className} id="order-history">
      {list.length === 0 ? (
        <Quiet>{t("noHistory")}</Quiet>
      ) : (
        list.map((h, i) => (
          <div key={i} className="border-b border-line py-tight text-[13px] first:pt-0 last:border-0 last:pb-0">
            <p className="break-words">{h.text}</p>
            <p className="mt-inline text-[12px] text-muted">{formatDateTime(h.at)} · {h.who}</p>
          </div>
        ))
      )}
    </Section>
  );
}

/** Notes for staff — customers never see these. */
export function NotesCard({ o, onAdd, className }: { o: Order; onAdd: (text: string) => Promise<void>; className?: string }) {
  const t = useTranslations("orders");
  const [draft, setDraft] = useState("");
  const list = [...(o.notes ?? [])].reverse();
  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await onAdd(text);
  };
  return (
    <Section title={t("cardNotes")} className={className} id="order-notes">
      {list.length === 0 ? (
        <Quiet>{t("noNotes")}</Quiet>
      ) : (
        list.map((n, i) => (
          <div key={i} className="border-b border-line py-tight text-[13px] first:pt-0 last:border-0">
            <p className="break-words">{n.text}</p>
            <p className="mt-inline text-[12px] text-muted">{formatDateTime(n.at)} · {n.who}</p>
          </div>
        ))
      )}
      <div className="mt-tight flex gap-tight">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
          placeholder={t("addNotePlaceholder")}
          aria-label={t("addNotePlaceholder")}
          className="h-11 min-w-0 flex-1 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse md:h-9"
        />
        <Button size="sm" variant="secondary" disabled={!draft.trim()} onClick={() => void add()}>{t("add")}</Button>
      </div>
    </Section>
  );
}
