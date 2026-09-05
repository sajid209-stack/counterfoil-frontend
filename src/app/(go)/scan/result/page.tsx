"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Wallet, X } from "lucide-react";
import { addOrderPayment, admitTicket, redeemTicket, type PaymentMethod } from "@/lib/api";

interface Outcome {
  accept: boolean;
  code: string;
  reason: string;
  group?: { ticketId: string; tierName: string; admits: number; admitted: number };
  /** Set when the sale behind this ticket has not been paid in full. */
  balance?: { orderId: string; ticketId: string; amount: number; amountLabel: string; currency: string };
}

const METHODS: PaymentMethod[] = ["cash", "bkash", "bangla_qr", "card_terminal"];

// The scan result. Must read in under a second at arm's length: colour AND
// shape (check vs cross) AND text ("ADMIT" vs "DO NOT ADMIT") all carry it, so
// it survives glare and colour-blindness. Group tickets (Family admits 4) take
// the arriving count right here — partial groups honoured.
export default function ScanResultPage() {
  const router = useRouter();
  const t = useTranslations("scan");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [admitted, setAdmitted] = useState(0);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("scan_result");
    if (raw) {
      const o: Outcome = JSON.parse(raw);
      setOutcome(o);
      setAdmitted(o.group?.admitted ?? 0);
    } else router.replace("/scan");
  }, [router]);

  // Non-group results auto-ready for the next scan.
  useEffect(() => {
    if (!outcome || outcome.group) return;
    // A balance owed is a transaction in progress, not a verdict — bouncing
    // back to the scanner two seconds in would lose the cashier's place.
    if (outcome.balance && !settled) return;
    const t = setTimeout(() => router.push("/scan"), 2000);
    return () => clearTimeout(t);
  }, [outcome, router, settled]);

  if (!outcome) return null;

  const accept = outcome.accept || settled;
  const group = outcome.group;
  const owed = outcome.balance && !settled ? outcome.balance : null;

  /** Take what is owed, then let them in. Payment first: a ticket redeemed
   *  before the money lands is a guest through the gate and a balance nobody
   *  can collect. */
  const settle = async () => {
    if (!outcome.balance || busy) return;
    setBusy(true);
    const res = await addOrderPayment(outcome.balance.orderId, method, outcome.balance.amount, "Gate");
    if (!res.ok) { setBusy(false); return; }
    if (!outcome.group) await redeemTicket(outcome.balance.ticketId);
    setBusy(false);
    setSettled(true);
  };
  const remaining = group ? group.admits - admitted : 0;

  const admit = async (count: number) => {
    if (!group || busy) return;
    setBusy(true);
    const res = await admitTicket(group.ticketId, count);
    setBusy(false);
    if (res.ok) setAdmitted(res.data.admitted ?? 0);
  };

  /* Balance due — neither an admission nor a refusal, so it wears neither
     treatment. Paid tickets are ink, refused ones are hatched danger; this is
     the amber of the app's own "needs attention", because it is a thing to be
     DONE rather than a verdict to be read. */
  if (owed) {
    return (
      <main className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-section bg-warning-wash px-section py-hero text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-current text-fg">
          <Wallet size={56} strokeWidth={2} />
        </span>
        <span className="type-display text-4xl">{t("balanceDue")}</span>
        <span className="type-display text-5xl tabular-nums">{owed.amountLabel}</span>
        <span className="type-body text-xl text-muted">{outcome.reason}</span>
        <span className="font-mono text-sm text-muted">{outcome.code}</span>

        <div className="flex w-full max-w-md flex-col gap-tight">
          <div className="grid grid-cols-2 gap-tight">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`h-14 rounded-sm border text-sm font-medium transition-colors duration-quick ${
                  method === m ? "border-ember bg-ember text-ink" : "border-strong bg-card"
                }`}
              >
                {t(`method_${m}`)}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={settle}
            className="h-16 rounded-sm bg-ink text-lg font-medium text-paper disabled:opacity-50 active:opacity-90"
          >
            {t("takeAndAdmit", { amount: owed.amountLabel })}
          </button>
          <button type="button" onClick={() => router.push("/scan")} className="h-12 text-[13px] text-muted underline-offset-4 hover:underline">
            {t("scanNext")}
          </button>
        </div>
      </main>
    );
  }

  // Group ticket: the big state stays, plus the count controls.
  // Accepted = paper on ink; refused = hatched danger. Judged at 3 metres by
  // shape (check vs cross), surface (solid vs hatch) and text — never colour.
  if (accept && group) {
    return (
      <main className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-major bg-ink px-section py-hero text-center text-paper">
        <span className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-paper">
          <Check size={72} strokeWidth={3} />
        </span>
        <span className="type-display text-5xl">{t("admitCount", { count: remaining > 0 ? remaining : "—" })}</span>
        <span className="type-body text-xl text-paper/90">{t("groupSummary", { reason: outcome.reason, size: group.admits, admitted })}</span>
        <span className="font-mono text-sm text-paper/70">{outcome.code}</span>
        {remaining > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-tight">
            <button type="button" disabled={busy} onClick={() => admit(1)} className="h-14 rounded-sm border-2 border-paper px-major text-lg font-medium active:bg-paper/20">{t("plusOne")}</button>
            <button type="button" disabled={busy} onClick={() => admit(remaining)} className="h-14 rounded-sm bg-paper px-major text-lg font-medium text-ink active:bg-paper/80">
              {t("admitAll", { count: remaining })}
            </button>
          </div>
        ) : (
          <span className="type-body text-lg">{t("everyoneIn")}</span>
        )}
        <button type="button" onClick={() => router.push("/scan")} className="mt-major text-[13px] text-paper/70 underline-offset-4 hover:underline">{t("scanNext")}</button>
      </main>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.push("/scan")}
      className={`flex min-h-[70vh] w-full flex-col items-center justify-center gap-major px-section py-hero text-center ${
        accept
          ? "bg-ink text-paper"
          : "bg-danger text-white bg-[repeating-linear-gradient(45deg,transparent,transparent_28px,rgba(0,0,0,0.18)_28px,rgba(0,0,0,0.18)_56px)]"
      }`}
    >
      <span className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-current">
        {accept ? <Check size={80} strokeWidth={3} /> : <X size={80} strokeWidth={3} />}
      </span>
      <span className="type-display text-5xl">{accept ? t("admit") : t("doNotAdmit")}</span>
      <span className="type-body text-2xl opacity-90">{outcome.reason}</span>
      <span className="font-mono text-sm opacity-70">{outcome.code}</span>
      <span className="mt-major text-[13px] opacity-60">{t("readyNext")}</span>
    </button>
  );
}
