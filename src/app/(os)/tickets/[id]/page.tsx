"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, KeyRound, ShieldOff, X } from "lucide-react";
import {
  ActionMenu,
  Button,
  DetailCard,
  FactGrid,
  FormField,
  Modal,
  Notice,
  PageShell,
  SkeletonText,
  StatusPill,
  TicketCard,
  TimelineCard,
  useToast,
  type ActionMenuItem,
  type ActivityItem,
  type Fact,
} from "@/components/ui";
import { StatusScreen } from "@/components/screens";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { eventTicketWhen } from "@/lib/api/eventTickets";
import { formatDateTime, formatDay, formatDayRange, formatMoney } from "@/lib/format";
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
import { MD, useMediaQuery } from "@/lib/useMedia";

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
 * a button. The page itself is composed from the kit's record cards:
 * `DetailCard` + `FactGrid` for the facts, `TimelineCard` for the codes and
 * the gate history, and `TicketCard` for the stub the guest is holding.
 */
export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("tickets");
  /* The record's own labels live beside the printed ticket's, in `ticket`. */
  const tr = useTranslations("ticket");
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
  /* Decided, not hidden with CSS: below md the secondary facts and the two
     history cards fold, and only the version on screen is in the page. */
  const wide = useMediaQuery(MD);
  const [moreOpen, setMoreOpen] = useState(false);

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
        {ticketQ.loading ? (
          <div aria-busy="true" aria-label={t("loading")}>
            <SkeletonText lines={3} />
          </div>
        ) : (
          <StatusScreen variant="notFound" framed homeHref="/issued-orders" homeLabel={t("backToIssued")} title={t("notFound")} />
        )}
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
  /* An event ticket is good for its ticket type's day(s), not the day it was bought. */
  const eventWhen = line ? eventTicketWhen(line.productId, line.tierId) : null;
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
  const credItems: ActivityItem[] = creds.map((c, index) => ({
    id: c.id,
    title: c.code,
    mono: true,
    struck: c.status !== "active",
    status: (
      <StatusPill tone={c.status === "active" ? "success" : c.status === "revoked" ? "danger" : "neutral"}>
        {t(`credStatus.${c.status}`)}
      </StatusPill>
    ),
    detail: [
      t(`credReason.${c.reason}`),
      t(`credKind.${c.kind}`),
      formatDateTime(c.createdAt),
      c.issuedBy,
      /* Issue number, so a run of replacements reads in order rather than
         as a pile of codes. */
      creds.length > 1 ? t("issueNo", { n: index + 1 }) : null,
    ]
      .filter(Boolean)
      .join(" · "),
    /* Why it was replaced, in the operator's own words. Never blank on a
       reissue — the api refuses one without a reason. */
    note: c.note,
  }));

  /** One presentation at the gate. Admitted or refused, both recorded. */
  const scanItems: ActivityItem[] = timeline.map((e: TicketEvent) => ({
    id: e.id,
    title: e.outcome === "admitted" ? t("scan.admitted") : t("scan.refused"),
    tone: e.outcome === "admitted" ? "success" : "danger",
    icon: e.outcome === "admitted" ? <Check size={15} strokeWidth={2.5} aria-hidden /> : <X size={15} strokeWidth={2.5} aria-hidden />,
    time: [
      formatDateTime(e.at),
      e.by,
      /* A redemption recorded before the gate kept a log is stated as what it
         is, rather than drawn as a scan nobody wrote down. */
      e.source === "record" ? t("scan.fromRecord") : null,
    ]
      .filter(Boolean)
      .join(" · "),
    detail: [
      e.refusal ? t(`refusal.${e.refusal}`) : null,
      e.admitted && admits > 1 ? t("scan.people", { count: e.admitted }) : null,
      /* Which token was presented. On a refused scan of a replaced code
         this is the whole story, and without it the row says a ticket was
         turned away and not why anyone thought it was valid. */
      e.credentialId ? credCodeOf(e.credentialId, creds) : null,
    ]
      .filter(Boolean)
      .join(" · "),
  }));

  /* The few facts a person opens this page for, then the rest. */
  const primaryFacts: Fact[] = [
    /* What it is. The bar carries the code and the description is
       screen-reader-only app-wide, so without this the page never said in ink
       what the ticket was actually for. */
    { key: "type", label: t("fact.type"), value: `${bookingName} · ${ticket.tierName}` },
    { key: "holder", label: t("fact.holder"), value: order?.customerName },
    { key: "validFor", label: t("fact.validFor"), value: eventWhen ? formatDayRange(eventWhen.days.map((d) => d.date), { weekday: true }) : formatDay(day, { weekday: true }) },
    /* "0 of 4 used" rather than a status word: a family ticket three-quarters
       spent is neither issued nor redeemed, and the count is the only honest
       answer. */
    { key: "used", label: t("fact.used"), value: t("usedOf", { used, total: admits }) },
  ];
  const secondaryFacts: Fact[] = [
    order ? { key: "order", label: tr("record.order"), value: order.reference, href: `/orders/${order.id}`, mono: true } : null,
    { key: "faceValue", label: t("fact.faceValue"), value: line ? formatMoney(line.unitPrice) : undefined },
    { key: "channel", label: t("fact.channel"), value: order ? t(`channel.${order.channel}`) : undefined },
    { key: "issued", label: t("fact.issued"), value: order ? formatDateTime(order.createdAt) : undefined },
  ].filter(Boolean) as Fact[];

  return (
    <PageShell
      title={ticket.code}
      description={`${bookingName} · ${ticket.tierName}`}
      back={{ href: `/orders/${ticket.orderId}`, label: order?.reference ?? t("backToOrder") }}
      status={
        <StatusPill tone={ticket.status === "issued" ? "info" : ticket.status === "redeemed" ? "success" : "neutral"}>
          {enumL.status(ticket.status)}
        </StatusPill>
      }
      primary={
        !spent
          ? {
              label: t("reissue"),
              icon: <KeyRound size={16} strokeWidth={1.5} />,
              onClick: () => { setNote(""); setError(""); setDialog("reissue"); },
            }
          : undefined
      }
      actions={<ActionMenu items={menu} label={t("rowActions")} />}
    >
      <div className="flex flex-col gap-section">
        {/* A terminated ticket says so before anything else on the page: every
            figure below it is still true and none of it can be used. */}
        {ticket.terminatedAt && (
          <Notice tone="danger" icon={<ShieldOff size={18} strokeWidth={1.75} />} title={t("terminatedTitle")}>
            <p className="text-sm">{ticket.terminatedReason}</p>
            <p className="mt-inline text-xs text-muted">{formatDateTime(ticket.terminatedAt)}</p>
          </Notice>
        )}

        <div className="grid gap-section xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-section">
            {/* What was bought. The facts a person reads this page for come
                first and always show; price, channel and issue time fold on a
                phone. */}
            <DetailCard title={t("detailsTitle")} id="tk-facts">
              <FactGrid facts={primaryFacts} tone="primary" />
              <div className="mt-section border-t border-hairline pt-section">
                {(wide || moreOpen) && <FactGrid facts={secondaryFacts} />}
                {!wide && (
                  <button
                    type="button"
                    aria-expanded={moreOpen}
                    onClick={() => setMoreOpen((v) => !v)}
                    className={cn(
                      "flex min-h-11 items-center gap-inline text-sm font-medium text-brand-foreground",
                      moreOpen && "mt-comfortable",
                    )}
                  >
                    {moreOpen ? tr("record.fewerDetails") : tr("record.moreDetails")}
                    <ChevronDown size={16} strokeWidth={1.5} aria-hidden className={cn("transition-transform", moreOpen && "rotate-180")} />
                  </button>
                )}
              </div>
            </DetailCard>

            {/* The tokens. */}
            <TimelineCard
              id="tk-codes"
              title={t("credentials")}
              description={t("credentialsNote")}
              items={credItems}
              empty={t("neverScanned")}
            />

            {/* What happened at a gate. Folds on a phone: a count says whether
                there is anything to open. */}
            <TimelineCard
              id="tk-history"
              title={t("history")}
              items={scanItems}
              empty={t("neverScanned")}
              fold
              summary={tr("record.scanCount", { count: timeline.length })}
            />
          </div>

          {/* What the guest is holding: the same TicketCard the print pages
              draw. A heading and the stub on a computer; a fold on a phone,
              where the stub is a long card at the foot. */}
          <aside className="flex min-w-0 flex-col gap-comfortable">
            <DetailCard id="tk-preview" title={t("preview")} summary={active?.code ?? ticket.code} fold bare>
              {card ? <TicketCard data={{ ...card.data, code: active?.code ?? ticket.code }} /> : null}
              <p className="mt-comfortable text-sm text-muted">{t("previewNote")}</p>
            </DetailCard>
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
        <p className="text-sm text-muted">{dialog === "terminate" ? t("terminateBody") : t("reissueBody")}</p>
        <FormField
          id="tk-note"
          className="mt-section"
          label={dialog === "terminate" ? t("terminateReason") : t("reissueReason")}
          value={note}
          onChange={(e) => { setNote(e.target.value); setError(""); }}
          placeholder={dialog === "terminate" ? t("terminatePlaceholder") : t("reissuePlaceholder")}
          error={error || undefined}
        />
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
