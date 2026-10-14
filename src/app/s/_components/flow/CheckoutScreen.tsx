"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { Checkbox, Notice, Radio } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { cn } from "@/lib/cn";
import { checkout as apiCheckout, getPrivacySettings, type Order, type PaymentMethod, type Ticket } from "@/lib/api";
import { buildOrderLines } from "@/lib/orderMath";
import { peekPaymentSettings } from "@/lib/api/paymentSettings";
import { formatClock, formatDay, formatMoney } from "@/lib/format";
import { slotISO } from "@/lib/schedule";
import { basketToLineInputs, type BasketLine } from "@/lib/storefront/basket";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import { BackLink, StorefrontChrome } from "../Chrome";
import { sfBtn } from "../sf";
import { PaymentStep } from "./PaymentStep";

const PHONE_RE = /^01\d{9}$/;

/** The slots a sale needs to hold, from the basket's dated lines, so a
 *  storefront purchase decrements the same capacity the till reads. */
function bookingsFor(basket: BasketLine[]) {
  return basket
    .filter((l) => l.date)
    .map((l) => ({
      productId: l.productId,
      resourceId: l.resourceId ?? null,
      slotStart: slotISO(l.date!, l.startTime ?? "00:00"),
      slotEnd: l.endTime ? slotISO(l.date!, l.endTime) : undefined,
      partySize: l.tiers.reduce((s, tr) => s + tr.admits * tr.qty, 0),
    }));
}

export interface CheckoutContact {
  name: string;
  phone: string;
  email: string;
}

const inputCls =
  "h-12 w-full rounded-md border border-strong bg-card px-section text-md transition-colors duration-quick focus:border-ember";

/** The one-page checkout: contact, payment method and terms on the left, the
 *  order summary and the Pay button on the right (below, on a phone), and then,
 *  in place with no new route, the mock gateway screen for whichever method was
 *  chosen. */
export function CheckoutScreen() {
  const flow = useStorefrontFlow();
  const t = useTranslations("storefront");
  const [contact, setContact] = useState<CheckoutContact>({ name: "", phone: "", email: "" });
  const [agreed, setAgreed] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paying, setPaying] = useState(false);
  const [placing, setPlacing] = useState(false);
  const privacyQ = useApiQuery(() => getPrivacySettings(), []);
  const showPrivacyLine = !!privacyQ.data?.showAtCheckout;

  const onlineMethods = peekPaymentSettings()
    .methods.filter((m) => m.enabled && (m.method === "bkash" || m.method === "bangla_qr" || m.method === "card_terminal"))
    .map((m) => m.method);
  const methods: PaymentMethod[] = onlineMethods.length ? onlineMethods : ["bkash", "bangla_qr", "card_terminal"];

  if (flow.basket.length === 0) {
    return (
      <StorefrontChrome storefront={flow.storefront} location={flow.location} poweredBy={t("poweredBy")}>
        <div className="mt-major flex flex-col items-center rounded-lg border border-hairline bg-subtle px-section py-hero text-center">
          <p className="text-lg font-semibold">{t("basket.empty")}</p>
          <button type="button" className={cn(sfBtn.primary, "mt-major")} onClick={flow.goVenue}>
            {t("basket.browse")}
          </button>
        </div>
      </StorefrontChrome>
    );
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!contact.name.trim()) e.name = t("checkout.nameRequired");
    if (!PHONE_RE.test(contact.phone.trim())) e.phone = t("checkout.phoneInvalid");
    if (contact.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) e.email = t("checkout.emailInvalid");
    if (!method) e.method = t("checkout.methodRequired");
    if (!agreed) e.terms = t("checkout.termsRequired");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const startPayment = () => {
    if (!validate()) return;
    setPaying(true);
  };

  const finalize = async (paymentReference: string) => {
    setPlacing(true);
    const inputs = basketToLineInputs(flow.basket, flow.products, flow.operator);

    if (flow.mode === "live") {
      const res = await apiCheckout({
        channel: "online",
        locationId: flow.location.id,
        counterId: null,
        staffId: null,
        customerName: contact.name.trim(),
        lines: inputs,
        bookings: bookingsFor(flow.basket),
        taxPct: flow.operator?.taxRatePct ?? 0,
        method: method!,
        amountTendered: flow.totals.total,
        paymentReference,
        payNow: flow.totals.total,
      });
      setPlacing(false);
      if (!res.ok) {
        setErrors({ pay: res.error.message });
        setPaying(false);
        return;
      }
      flow.clearBasket();
      flow.goDone({ orderId: res.data.order.id, order: res.data.order, tickets: res.data.tickets });
      return;
    }

    // Preview: the same math engine, no real order. Nothing is written.
    const { lines, totals } = buildOrderLines(inputs, 0, "CF-PREVIEW");
    const now = new Date().toISOString();
    const fakeOrder: Order = {
      id: "preview",
      reference: "CF-PREVIEW-000001",
      status: "paid",
      channel: "online",
      locationId: flow.location.id,
      counterId: null,
      staffId: null,
      customerId: null,
      customerName: contact.name.trim(),
      lines,
      payments: [{ id: "preview-P0", method: method!, amount: totals.total, status: "confirmed", createdAt: now, reference: paymentReference }],
      ...totals,
      createdAt: now,
      updatedAt: now,
    };
    const fakeTickets: Ticket[] = [];
    let n = 0;
    for (const line of lines) {
      if (line.parentLineId || line.admits <= 0 || line.unitPrice < 0) continue;
      for (let q = 0; q < line.quantity; q++, n++) {
        fakeTickets.push({
          id: `preview-t${n}`,
          code: `CF-PREVIEW-000001-${String(n + 1).padStart(2, "0")}`,
          orderId: "preview",
          lineId: line.id,
          productId: line.productId,
          tierName: line.tierName,
          admits: line.admits,
          status: "issued",
          validFor: now.slice(0, 10),
          redeemedAt: null,
        });
      }
    }
    setPlacing(false);
    flow.clearBasket();
    flow.goDone({ orderId: null, order: fakeOrder, tickets: fakeTickets });
  };

  if (paying && method) {
    return (
      <StorefrontChrome storefront={flow.storefront} location={flow.location} poweredBy={t("poweredBy")}>
        <PaymentStep
          method={method}
          amount={flow.totals.total}
          phone={contact.phone}
          busy={placing}
          onCancel={() => setPaying(false)}
          onSuccess={finalize}
        />
      </StorefrontChrome>
    );
  }

  const card = "rounded-lg border border-hairline p-major";

  return (
    <StorefrontChrome storefront={flow.storefront} location={flow.location} poweredBy={t("poweredBy")}>
      <div className="pt-section">
        <BackLink
          label={t("basket.title")}
          href={flow.mode === "live" ? `/s/${flow.storefront.slug}/basket` : undefined}
          onClick={flow.goBasket}
        />
      </div>
      <h1 className="mt-tight text-4xl font-semibold tracking-figure sm:text-display">{t("checkout.title")}</h1>

      <div className="mt-major grid grid-cols-1 items-start gap-major lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-wide">
        <div className="flex flex-col gap-section">
          <section className={cn(card, "flex flex-col gap-section")}>
            <h2 className="text-xl font-semibold">{t("checkout.contactTitle")}</h2>
            <Labeled label={t("checkout.nameLabel")} error={errors.name}>
              <input
                value={contact.name}
                onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                autoComplete="name"
                className={inputCls}
              />
            </Labeled>
            <Labeled label={t("checkout.phoneLabel")} error={errors.phone} help={t("checkout.phoneHelp")}>
              <input
                value={contact.phone}
                onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value.replace(/[^\d]/g, "") }))}
                inputMode="numeric"
                autoComplete="tel"
                placeholder="01712345678"
                className={cn(inputCls, "tnum")}
              />
            </Labeled>
            <Labeled label={t("checkout.emailLabel")} error={errors.email} help={t("checkout.emailOptional")}>
              <input
                type="email"
                value={contact.email}
                onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                autoComplete="email"
                className={inputCls}
              />
            </Labeled>
          </section>

          <section className={cn(card, "flex flex-col gap-section")}>
            <h2 className="text-xl font-semibold">{t("checkout.paymentTitle")}</h2>
            <div className="flex flex-col gap-tight">
              {methods.map((m) => (
                <div
                  key={m}
                  onClick={() => setMethod(m)}
                  className={cn(
                    "flex min-h-14 cursor-pointer items-center rounded-md border px-comfortable transition-colors duration-quick",
                    method === m ? "border-ember-solid bg-ember-wash" : "border-line hover:border-strong",
                  )}
                >
                  <Radio
                    name="method"
                    checked={method === m}
                    onChange={() => setMethod(m)}
                    label={
                      <>
                        <span className="block text-md font-semibold">{t(`checkout.method.${m}`)}</span>
                        <span className="block text-base text-muted">{t(`checkout.methodHint.${m}`)}</span>
                      </>
                    }
                  />
                </div>
              ))}
            </div>
            {errors.method && <p className="text-base font-medium text-danger">{errors.method}</p>}
          </section>

          <section className={card}>
            <Checkbox checked={agreed} onCheckedChange={setAgreed} label={t("checkout.terms")} />
            {errors.terms && <p className="mt-tight text-base font-medium text-danger">{errors.terms}</p>}
            {showPrivacyLine && (
              <p className="mt-section text-base text-muted">
                {t.rich("checkout.privacyLine", {
                  link: (chunks) =>
                    flow.mode === "live" ? (
                      <a
                        href={`/s/${flow.storefront.slug}/privacy`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-brand-foreground underline underline-offset-4"
                      >
                        {chunks}
                      </a>
                    ) : (
                      <span className="text-brand-foreground underline underline-offset-4">{chunks}</span>
                    ),
                })}
              </p>
            )}
          </section>
        </div>

        <aside className="rounded-lg border border-line bg-card p-major shadow-card lg:sticky lg:top-24">
          <h2 className="text-xl font-semibold">{t("checkout.summaryTitle")}</h2>
          <ul className="mt-section flex flex-col gap-comfortable border-t border-hairline pt-section">
            {flow.basket.map((line) => (
              <li key={line.id} className="text-base">
                <p className="text-md font-semibold">{line.productName}</p>
                <p className="text-muted">
                  {[line.date ? formatDay(line.date, { weekday: true }) : null, line.startTime ? formatClock(line.startTime) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {line.tiers.map((tr) => (
                  <p key={tr.tierId} className="mt-inline flex justify-between gap-comfortable text-muted">
                    <span>
                      {tr.qty} × {tr.tierName}
                    </span>
                    <span className="tnum shrink-0">{formatMoney(tr.price * tr.qty)}</span>
                  </p>
                ))}
              </li>
            ))}
          </ul>
          <div className="mt-section flex flex-col gap-tight border-t border-hairline pt-section text-md">
            <p className="flex justify-between text-muted">
              <span>{t("basket.subtotal")}</span>
              <span className="tnum text-fg">{formatMoney(flow.totals.subtotal)}</span>
            </p>
            {flow.totals.taxTotal > 0 && (
              <p className="flex justify-between text-muted">
                <span>{t("basket.vat")}</span>
                <span className="tnum text-fg">{formatMoney(flow.totals.taxTotal)}</span>
              </p>
            )}
            <p className="mt-tight flex justify-between border-t border-hairline pt-section text-xl font-semibold">
              <span>{t("basket.total")}</span>
              <span className="tnum">{formatMoney(flow.totals.total)}</span>
            </p>
          </div>

          {errors.pay && (
            <Notice tone="danger" className="mt-section">
              {errors.pay}
            </Notice>
          )}
          <button type="button" className={cn(sfBtn.primary, "mt-major w-full")} onClick={startPayment}>
            {t("checkout.pay", { amount: formatMoney(flow.totals.total) })}
          </button>
          <p className="mt-section flex items-center gap-tight text-base text-muted">
            <Lock size={16} strokeWidth={1.75} className="shrink-0" aria-hidden />
            {t("checkout.secure")}
          </p>
        </aside>
      </div>
    </StorefrontChrome>
  );
}

function Labeled({ label, error, help, children }: { label: string; error?: string; help?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-tight">
      <span className="text-base font-semibold">{label}</span>
      {children}
      {error ? <span className="text-base font-medium text-danger">{error}</span> : help ? <span className="text-base text-muted">{help}</span> : null}
    </label>
  );
}
