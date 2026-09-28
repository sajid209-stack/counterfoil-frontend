"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Check, KeyRound, ShieldOff, X } from "lucide-react";
import {
  ActionMenu,
  Button,
  Modal,
  PageShell,
  StatusPill,
  useToast,
  type ActionMenuItem,
} from "@/components/ui";
import { TicketCard } from "@/components/ui/TicketCard";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { formatDateTime, formatDay, formatMoney } from "@/lib/format";
import {
  credentialsFor,
  getOperator,
  getOrder,
  getTicket,
  listTickets,
  reissueCredential,
  terminateTicket,
  ticketAdmits,
  ticketTimeline,
  type ListResponse,
  type Order,
  type Ticket,
  type TicketCredential,
  type TicketEvent,
} from "@/lib/api";
import { useTicketLabels, ticketCards } from "@/app/print/_lib/ticketCards";
import { useEnumLabels } from "@/lib/labels";

/**
 * One ticket: the entitlement, the tokens that prove it, and what happened at
 * the gate.
 *
 * The page exists because those are three different things and an order could
 * only ever say the first. A refund voids a ticket; a lost phone does not — it
 * needs a new token against the same sale, which is what the Credentials card
 * is for. So the page is arranged as the distinction: what was bought, then
 * which code opens the gate, then every time somebody presented one.
 *
 * The facts lead and the controls are in the header, which is the shape a
 * record wants — the settings pages learned the other way round, where a page
 * built entirely of controls could only state a fact inside the description of
 * a button.
 */
export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("tickets");
  const enumL = useEnumLabels();
  const cardLabels = useTicketLabels();
  const toast = useToast();
  const router = useRouter();

  /* `stamp` is the ask-again signal. Credentials and scans are derived from the
     store, which a reissue changes without changing the ticket object React is
     holding. */
  const [stamp, setStamp] = useState(0);
  const [dialog, setDialog] = useState<"reissue" | "terminate" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const ticketQ = useApiQuery(() => getTicket(id), [id, stamp]);
  const ticket = ticketQ.data;
  const orderId = ticket?.orderId;
  /* Held back until the ticket names its order. `never()` rather than a
     pretend-empty result: a query that has not been asked yet must not look
     like one that came back with nothing. */
  const orderQ = useApiQuery(() => (orderId ? getOrder(orderId) : never<Order>()), [orderId, stamp]);
  const order = orderQ.data;
  /* The order's other tickets, so the preview says "1 of 3" exactly as the
     printed one does. */
  const siblingsQ = useApiQuery(
    () => (orderId ? listTickets({ pageSize: 200, filters: { orderId } }) : never<ListResponse<Ticket>>()),
    [orderId, stamp],
  );
  const opQ = useApiQuery(() => getOperator(), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const creds = useMemo(() => (ticket ? credentialsFor(ticket.id) : []), [ticket, stamp]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const timeline = useMemo(() => (ticket ? ticketTimeline(ticket) : []), [ticket, stamp]);

  const reload = () => {
    setStamp((n) => n + 1);
    ticketQ.reload();
  };

  if (!ticket) {
    return (
      <PageShell title={t("fallbackTitle")}>
        <p className="text-[13px] text-muted">{ticketQ.loading ? t("loading") : t("notFound")}</p>
      </PageShell>
    );
  }

  const line = order?.lines.find((l) => l.id === ticket.lineId);
  const bookingName = line?.productName ?? ticket.tierName;
  /* The day the guest turns up, taken from the booking where there is one —
     which is what the printed stub says. `validFor` is stamped from the sale,
     so on a booking made for a later date the two differ, and a record stating
     one day beside a preview of the ticket stating another is a record nobody
     can act on. */
  const day = line?.booking?.date ?? ticket.validFor;
  const admits = ticketAdmits(ticket);
  const used = ticket.admitted ?? (ticket.status === "redeemed" ? admits : 0);
  const active = creds.find((c) => c.status === "active");
  const dead = ticket.status === "void";
  /* A spent ticket cannot be re-issued — a new token opens nothing — and a
     terminated one cannot be terminated twice. */
  const spent = dead || ticket.status === "redeemed";

  /* The stub the guest is holding, built by the same function the print pages
     use. A preview drawn from its own markup is a preview of something else —
     and this one has to be trustworthy enough to read a code off over the
     phone. */
  const siblings = siblingsQ.data?.data ?? [];
  const card = ticketCards(order, siblings.length ? siblings : [ticket], opQ.data?.name ?? "", cardLabels).find(
    (c) => c.id === ticket.id,
  );

  const submit = async () => {
    setBusy(true);
    setError("");
    const res =
      dialog === "reissue"
        ? await reissueCredential(ticket.id, note)
        : await terminateTicket(ticket.id, note);
    setBusy(false);
    if (!res.ok) {
      setError(res.error.fieldErrors?.note ?? res.error.fieldErrors?.reason ?? res.error.message);
      return;
    }
    toast.success(dialog === "reissue" ? t("reissued") : t("terminated"));
    setDialog(null);
    setNote("");
    reload();
  };

  const menu: ActionMenuItem[] = [
    { key: "order", label: t("openOrder"), onSelect: () => router.push(`/orders/${ticket.orderId}`) },
    { key: "print", label: t("printOrderTickets"), onSelect: () => router.push(`/print/tickets/${ticket.orderId}`) },
    ...(dead
      ? []
      : [
          {
            key: "terminate",
            label: t("terminate"),
            destructive: true,
            separated: true,
            onSelect: () => { setNote(""); setError(""); setDialog("terminate"); },
          },
        ]),
  ];

  /** One credential. The code leads, because it is the thing somebody reads out
   *  or types in; the state and the reason sit under it. */
  const credRow = (c: TicketCredential, index: number) => (
    <li key={c.id} className="flex flex-wrap items-baseline gap-x-tight gap-y-inline border-b border-hairline py-comfortable last:border-0">
      <span
        className={cn(
          "min-w-0 flex-1 break-all font-mono text-[13px] font-medium",
          c.status !== "active" && "text-muted line-through",
        )}
      >
        {c.code}
      </span>
      <StatusPill tone={c.status === "active" ? "success" : c.status === "revoked" ? "danger" : "neutral"}>
        {t(`credStatus.${c.status}`)}
      </StatusPill>
      <span className="w-full text-[12px] text-muted">
        {[
          t(`credReason.${c.reason}`),
          t(`credKind.${c.kind}`),
          formatDateTime(c.createdAt),
          c.issuedBy,
          /* Issue number, so a run of replacements reads in order rather than
             as a pile of codes. */
          creds.length > 1 ? t("issueNo", { n: index + 1 }) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
      {/* Why it was replaced, in the operator's own words. Never blank on a
          reissue — the api refuses one without a reason. */}
      {c.note && <p className="w-full text-[13px]">{c.note}</p>}
    </li>
  );

  /** One presentation at the gate. Admitted or refused, both recorded. */
  const scanRow = (e: TicketEvent) => (
    <li key={e.id} className="flex flex-wrap items-baseline gap-x-tight gap-y-inline border-b border-hairline py-comfortable last:border-0">
      <span className={cn("flex shrink-0 items-center gap-inline text-[13px] font-medium", e.outcome === "admitted" ? "text-success" : "text-danger")}>
        {e.outcome === "admitted" ? <Check size={15} strokeWidth={2.5} aria-hidden /> : <X size={15} strokeWidth={2.5} aria-hidden />}
        {e.outcome === "admitted" ? t("scan.admitted") : t("scan.refused")}
      </span>
      <span className="min-w-0 flex-1 text-[13px] text-muted">
        {[
          e.refusal ? t(`refusal.${e.refusal}`) : null,
          e.admitted && admits > 1 ? t("scan.people", { count: e.admitted }) : null,
          /* Which token was presented. On a refused scan of a replaced code
             this is the whole story, and without it the row says a ticket was
             turned away and not why anyone thought it was valid. */
          e.credentialId ? credCodeOf(e.credentialId, creds) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
      <span className="shrink-0 text-[12px] text-muted">
        {formatDateTime(e.at)}
        {e.by ? ` · ${e.by}` : ""}
        {/* A redemption recorded before the gate kept a log is stated as what it
            is, rather than drawn as a scan nobody wrote down. */}
        {e.source === "record" ? ` · ${t("scan.fromRecord")}` : ""}
      </span>
    </li>
  );

  return (
    <PageShell
      title={ticket.code}
      description={`${bookingName} · ${ticket.tierName}`}
      actions={
        <span className="flex items-center gap-tight">
          {!spent && (
            <Button
              icon={<KeyRound size={16} strokeWidth={1.5} />}
              onClick={() => { setNote(""); setError(""); setDialog("reissue"); }}
            >
              {t("reissue")}
            </Button>
          )}
          <ActionMenu items={menu} label={t("rowActions")} />
        </span>
      }
    >
      <div className="flex flex-col gap-section">
        <Link
          href={`/orders/${ticket.orderId}`}
          className="flex min-h-11 w-fit items-center gap-inline text-[13px] font-medium text-muted hover:text-fg md:min-h-0"
        >
          <ArrowLeft size={14} strokeWidth={1.5} aria-hidden />
          {order?.reference ?? t("backToOrder")}
        </Link>

        {/* A terminated ticket says so before anything else on the page: every
            figure below it is still true and none of it can be used. */}
        {ticket.terminatedAt && (
          <div className="flex items-start gap-tight rounded-md border border-danger/40 bg-danger-wash p-card">
            <ShieldOff size={18} strokeWidth={1.75} aria-hidden className="mt-[2px] shrink-0 text-danger" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t("terminatedTitle")}</p>
              <p className="mt-inline text-[13px]">{ticket.terminatedReason}</p>
              <p className="mt-inline text-[12px] text-muted">{formatDateTime(ticket.terminatedAt)}</p>
            </div>
          </div>
        )}

        <div className="grid gap-section xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-section">
            {/* What was bought. */}
            <section className="card-surface p-card">
              <div className="flex flex-wrap items-center gap-tight">
                <StatusPill tone={ticket.status === "issued" ? "info" : ticket.status === "redeemed" ? "success" : "neutral"}>
                  {enumL.status(ticket.status)}
                </StatusPill>
                <span className="text-[13px] text-muted">{t("entitlementNote")}</span>
              </div>

              <dl className="mt-section grid gap-section sm:grid-cols-2 xl:grid-cols-3">
                {[
                  /* What it is. The bar carries the code and the description is
                     screen-reader-only app-wide, so without this the page never
                     said in ink what the ticket was actually for. */
                  { k: "type", v: `${bookingName} · ${ticket.tierName}` },
                  { k: "validFor", v: formatDay(day, { weekday: true }) },
                  /* "0 of 4 used" rather than a status word: a family ticket
                     three-quarters spent is neither issued nor redeemed, and
                     the count is the only honest answer. */
                  { k: "used", v: t("usedOf", { used, total: admits }) },
                  line ? { k: "faceValue", v: formatMoney(line.unitPrice) } : null,
                  order ? { k: "channel", v: t(`channel.${order.channel}`) } : null,
                  order ? { k: "issued", v: formatDateTime(order.createdAt) } : null,
                  order?.customerName ? { k: "holder", v: order.customerName } : null,
                ]
                  .filter(Boolean)
                  .map((f) => (
                    <div key={f!.k} className="flex min-w-0 flex-col gap-inline">
                      <dt className="text-[12px] font-medium text-muted">{t(`fact.${f!.k}`)}</dt>
                      <dd className="break-words text-[15px] font-semibold leading-snug">{f!.v}</dd>
                    </div>
                  ))}
              </dl>
            </section>

            {/* The tokens. */}
            <section className="card-surface p-card">
              <h2 className="text-base font-semibold tracking-[-0.4px]">{t("credentials")}</h2>
              <p className="mt-inline text-[12px] text-muted">{t("credentialsNote")}</p>
              <ul className="mt-comfortable flex flex-col">{creds.map(credRow)}</ul>
            </section>

            {/* What happened at a gate. */}
            <section className="card-surface p-card">
              <h2 className="text-base font-semibold tracking-[-0.4px]">{t("history")}</h2>
              {timeline.length === 0 ? (
                <p className="mt-comfortable text-[13px] text-muted">{t("neverScanned")}</p>
              ) : (
                <ul className="mt-comfortable flex flex-col">{timeline.map(scanRow)}</ul>
              )}
            </section>
          </div>

          {/* What the guest is holding. */}
          <aside className="flex min-w-0 flex-col gap-comfortable">
            <h2 className="text-base font-semibold tracking-[-0.4px]">{t("preview")}</h2>
            {card ? <TicketCard data={{ ...card.data, code: active?.code ?? ticket.code }} /> : null}
            <p className="text-[12px] text-muted">{t("previewNote")}</p>
          </aside>
        </div>
      </div>

      {/* Reissue and terminate ask the same question — why — and refuse without
          an answer, because an unexplained replacement is indistinguishable
          from a mistake six weeks later. */}
      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === "terminate" ? t("terminateTitle") : t("reissueTitle")}
      >
        <p className="text-[13px] text-muted">{dialog === "terminate" ? t("terminateBody") : t("reissueBody")}</p>
        <label className="mt-section block text-[12px] font-medium text-muted" htmlFor="tk-note">
          {dialog === "terminate" ? t("terminateReason") : t("reissueReason")}
        </label>
        <input
          id="tk-note"
          value={note}
          onChange={(e) => { setNote(e.target.value); setError(""); }}
          placeholder={dialog === "terminate" ? t("terminatePlaceholder") : t("reissuePlaceholder")}
          aria-invalid={!!error}
          aria-describedby={error ? "tk-note-error" : undefined}
          className="mt-inline h-11 w-full rounded-sm border border-line bg-card px-comfortable text-sm"
        />
        {error && (
          <p id="tk-note-error" className="mt-inline text-[13px] text-danger">
            {error}
          </p>
        )}
        <div className="mt-section flex flex-wrap justify-end gap-tight">
          <Button variant="secondary" onClick={() => setDialog(null)}>
            {t("cancel")}
          </Button>
          <Button variant={dialog === "terminate" ? "destructive" : "primary"} loading={busy} onClick={submit}>
            {dialog === "terminate" ? t("terminate") : t("reissue")}
          </Button>
        </div>
      </Modal>
    </PageShell>
  );
}

/** A query that has not been asked. Distinct from an empty answer, which is
 *  what a placeholder result would have looked like. */
const never = <T,>() => Promise.resolve({ ok: false as const, error: { code: "not_found" as const, message: "" } as const }) as Promise<import("@/lib/api").ApiResult<T>>;

/** The code a scan was made against, for the history row. */
function credCodeOf(credentialId: string, creds: TicketCredential[]): string | null {
  return creds.find((c) => c.id === credentialId)?.code ?? null;
}
