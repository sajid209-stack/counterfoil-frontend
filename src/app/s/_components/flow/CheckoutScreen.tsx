"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { checkout as apiCheckout, type Order, type PaymentMethod, type Ticket } from "@/lib/api";
import { buildOrderLines } from "@/lib/orderMath";
import { peekPaymentSettings } from "@/lib/api/paymentSettings";
import { formatClock, formatDay, formatMoney } from "@/lib/format";
import { slotISO } from "@/lib/schedule";
import { basketToLineInputs, type BasketLine } from "@/lib/storefront/basket";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import { StorefrontChrome } from "../Chrome";
import { PaymentStep } from "./PaymentStep";

const PHONE_RE = /^01\d{9}$/;

/** The slots a sale needs to hold, from the basket's dated lines — so a
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

/** The one-page checkout: contact, the order summary, the payment method,
 *  terms, and then — in place, no new route — the mock gateway screen for
 *  whichever method was chosen. */
export function CheckoutScreen() {
  const flow = useStorefrontFlow();
  const t = useTranslations("storefront");
  const [contact, setContact] = useState<CheckoutContact>({ name: "", phone: "", email: "" });
  const [agreed, setAgreed] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paying, setPaying] = useState(false);
  const [placing, setPlacing] = useState(false);

  const onlineMethods = peekPaymentSettings()
    .methods.filter((m) => m.enabled && (m.method === "bkash" || m.method === "bangla_qr" || m.method === "card_terminal"))
    .map((m) => m.method);
  const methods: PaymentMethod[] = onlineMethods.length ? onlineMethods : ["bkash", "bangla_qr", "card_terminal"];

  if (flow.basket.length === 0) {
    return (
      <StorefrontChrome
        storefront={flow.storefront}
        location={flow.location}
        backHref={flow.mode === "live" ? `/s/${flow.storefront.slug}` : undefined}
        backLabel={t("backToVenue", { venue: flow.location.name })}
        poweredBy={t("poweredBy")}
        preview={flow.mode === "preview"}
      >
        <p className="text-[14px] text-muted">{t("basket.empty")}</p>
        <Button className="mt-comfortable" onClick={flow.goVenue}>
          {t("basket.browse")}
        </Button>
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

    // Preview — the same math engine, no real order. Nothing is written.
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
      <StorefrontChrome storefront={flow.storefront} location={flow.location} poweredBy={t("poweredBy")} preview={flow.mode === "preview"}>
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

  return (
    <StorefrontChrome
      storefront={flow.storefront}
      location={flow.location}
      backHref={flow.mode === "live" ? `/s/${flow.storefront.slug}/basket` : undefined}
      backLabel={t("basket.title")}
      poweredBy={t("poweredBy")}
      preview={flow.mode === "preview"}
    >
      {flow.mode === "preview" && (
        <button
          type="button"
          onClick={flow.goBasket}
          className="mb-section flex min-h-11 items-center text-[13px] text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          {t("basket.title")}
        </button>
      )}
      <h1 className="type-h1 text-[26px] sm:text-[32px]">{t("checkout.title")}</h1>

      <div className="mt-section grid grid-cols-1 gap-section lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-section">
          <section className="card-surface flex flex-col gap-comfortable p-card">
            <h2 className="text-[15px] font-semibold">{t("checkout.contactTitle")}</h2>
            <Labeled label={t("checkout.nameLabel")} error={errors.name}>
              <input
                value={contact.name}
                onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                autoComplete="name"
                className="h-11 w-full rounded-sm border border-line bg-card px-comfortable text-[14px] outline-none focus:border-ember focus:ring-2 focus:ring-ember/20"
              />
            </Labeled>
            <Labeled label={t("checkout.phoneLabel")} error={errors.phone} help={t("checkout.phoneHelp")}>
              <input
                value={contact.phone}
                onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value.replace(/[^\d]/g, "") }))}
                inputMode="numeric"
                autoComplete="tel"
                placeholder="01712345678"
                className="h-11 w-full rounded-sm border border-line bg-card px-comfortable text-[14px] outline-none focus:border-ember focus:ring-2 focus:ring-ember/20"
              />
            </Labeled>
            <Labeled label={t("checkout.emailLabel")} error={errors.email} help={t("checkout.emailOptional")}>
              <input
                type="email"
                value={contact.email}
                onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                autoComplete="email"
                className="h-11 w-full rounded-sm border border-line bg-card px-comfortable text-[14px] outline-none focus:border-ember focus:ring-2 focus:ring-ember/20"
              />
            </Labeled>
          </section>

          <section className="card-surface flex flex-col gap-comfortable p-card">
            <h2 className="text-[15px] font-semibold">{t("checkout.paymentTitle")}</h2>
            <div className="flex flex-col gap-tight">
              {methods.map((m) => (
                <label
                  key={m}
                  className={`flex min-h-12 cursor-pointer items-center gap-tight rounded-sm border px-comfortable transition-colors duration-quick ${
                    method === m ? "border-ember bg-ember/5" : "border-line"
                  }`}
                >
                  <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} className="h-4 w-4" />
                  <span className="text-[14px] font-medium">{t(`checkout.method.${m}`)}</span>
                </label>
              ))}
            </div>
            {errors.method && <p className="text-[13px] text-danger">{errors.method}</p>}
          </section>

          <section className="card-surface p-card">
            <label className="flex items-start gap-tight">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span className="text-[13px] leading-relaxed text-fg/85">{t("checkout.terms")}</span>
            </label>
            {errors.terms && <p className="mt-tight text-[13px] text-danger">{errors.terms}</p>}
          </section>
        </div>

        <aside>
          <details open className="card-surface overflow-hidden p-card">
            <summary className="cursor-pointer text-[15px] font-semibold">{t("checkout.summaryTitle")}</summary>
            <ul className="mt-comfortable flex flex-col gap-tight border-t border-hairline pt-comfortable">
              {flow.basket.map((line) => (
                <li key={line.id} className="text-[13px]">
                  <p className="font-medium text-fg">{line.productName}</p>
                  <p className="text-muted">
                    {[line.date ? formatDay(line.date, { weekday: true }) : null, line.startTime ? formatClock(line.startTime) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {line.tiers.map((tr) => (
                    <p key={tr.tierId} className="flex justify-between text-muted">
                      <span>
                        {tr.qty} × {tr.tierName}
                      </span>
                      <span className="tabular-nums">{formatMoney(tr.price * tr.qty)}</span>
                    </p>
                  ))}
                </li>
              ))}
            </ul>
            <div className="mt-comfortable flex flex-col gap-inline border-t border-hairline pt-comfortable text-[14px]">
              <p className="flex justify-between text-muted">
                <span>{t("basket.subtotal")}</span>
                <span className="tabular-nums">{formatMoney(flow.totals.subtotal)}</span>
              </p>
              {flow.totals.taxTotal > 0 && (
                <p className="flex justify-between text-muted">
                  <span>{t("basket.vat")}</span>
                  <span className="tabular-nums">{formatMoney(flow.totals.taxTotal)}</span>
                </p>
              )}
              <p className="flex justify-between text-[17px] font-semibold">
                <span>{t("basket.total")}</span>
                <span className="tabular-nums">{formatMoney(flow.totals.total)}</span>
              </p>
            </div>
          </details>

          {errors.pay && <p className="mt-tight text-[13px] text-danger">{errors.pay}</p>}
          <Button fullWidth size="lg" className="mt-section" onClick={startPayment}>
            {t("checkout.pay", { amount: formatMoney(flow.totals.total) })}
          </Button>
        </aside>
      </div>
    </StorefrontChrome>
  );
}

function Labeled({ label, error, help, children }: { label: string; error?: string; help?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-inline">
      <span className="type-label text-[12px] text-muted">{label}</span>
      {children}
      {error ? <span className="text-[13px] text-danger">{error}</span> : help ? <span className="text-[13px] text-muted">{help}</span> : null}
    </label>
  );
}
