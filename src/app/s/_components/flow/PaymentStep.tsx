"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Smartphone } from "lucide-react";
import { Qr } from "@/components/ui";
import { cn } from "@/lib/cn";
import { sfBtn } from "../sf";
import { formatMoney } from "@/lib/format";
import type { Minor, PaymentMethod } from "@/lib/api/types";

const PHONE_RE = /^01\d{9}$/;
// ds-exception: bKash's pink is the payment provider's own brand colour, not the venue's
const BKASH_PINK = "#E2136E";
const ref = (prefix: string) => `${prefix}${Math.floor(100000 + Math.random() * 900000)}`;

/**
 * The mock payment step — drawn to look like the gateway it stands in for,
 * because a prototype that skips straight to "paid" teaches nothing about
 * the guest journey it exists to show.
 */
export function PaymentStep({
  method,
  amount,
  phone,
  busy,
  onCancel,
  onSuccess,
}: {
  method: PaymentMethod;
  amount: Minor;
  phone: string;
  busy: boolean;
  onCancel: () => void;
  onSuccess: (paymentReference: string) => void;
}) {
  const t = useTranslations("storefront");
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-section py-section">
      <button type="button" onClick={onCancel} className="flex min-h-11 w-fit items-center gap-inline text-base text-muted hover:text-fg">
        <ArrowLeft size={15} strokeWidth={1.75} aria-hidden />
        {t("pay.changeMethod")}
      </button>
      <div className="rounded-lg border border-hairline bg-subtle flex flex-col items-center gap-tight p-major text-center">
        <p className="text-base text-muted">{t("pay.amountDue")}</p>
        <p className="tnum text-4xl font-semibold">{formatMoney(amount)}</p>
      </div>
      {method === "bkash" && <BkashPay phone={phone} busy={busy} onSuccess={onSuccess} />}
      {method === "card_terminal" && <CardPay busy={busy} onSuccess={onSuccess} />}
      {method === "bangla_qr" && <QrPay amount={amount} busy={busy} onSuccess={onSuccess} />}
    </div>
  );
}

function BkashPay({ phone, busy, onSuccess }: { phone: string; busy: boolean; onSuccess: (r: string) => void }) {
  const t = useTranslations("storefront");
  const [step, setStep] = useState<"number" | "otp">("number");
  const [num, setNum] = useState(phone);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (step === "number") {
    return (
      <div className="rounded-lg border border-line bg-card p-major shadow-card flex flex-col gap-section" style={{ borderTop: `4px solid ${BKASH_PINK}` }}>
        <p className="flex items-center gap-tight text-md font-semibold" style={{ color: BKASH_PINK }}>
          <Smartphone size={18} strokeWidth={1.75} aria-hidden /> bKash
        </p>
        <label className="flex flex-col gap-inline">
          <span className="text-base font-semibold">{t("pay.bkashNumber")}</span>
          <input
            value={num}
            onChange={(e) => setNum(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            className="h-12 w-full rounded-md border border-strong bg-card px-section text-md tabular-nums transition-colors duration-quick focus:border-ember"
          />
          {error && <span className="text-base font-medium text-danger">{error}</span>}
        </label>
        <button
          type="button"
          className={cn(sfBtn.primary, "w-full")}
          onClick={() => {
            if (!PHONE_RE.test(num)) {
              setError(t("checkout.phoneInvalid"));
              return;
            }
            setError(null);
            setStep("otp");
          }}
        >
          {t("pay.sendOtp")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-card p-major shadow-card flex flex-col gap-section" style={{ borderTop: `4px solid ${BKASH_PINK}` }}>
      <p className="text-md">{t("pay.otpSentTo", { number: num })}</p>
      <label className="flex flex-col gap-inline">
        <span className="text-base font-semibold">{t("pay.otpLabel")}</span>
        <input
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoFocus
          className="h-12 w-full rounded-md border border-strong bg-card px-section text-center text-2xl font-semibold tracking-[0.3em] tabular-nums transition-colors duration-quick focus:border-ember"
        />
        {error && <span className="text-base font-medium text-danger">{error}</span>}
      </label>
      <p className="text-base text-muted">{t("pay.demoOtpHint")}</p>
      <button
        type="button"
        disabled={busy}
        className={cn(sfBtn.primary, "w-full")}
        onClick={() => {
          if (otp !== "123456") {
            setError(t("pay.otpWrong"));
            return;
          }
          onSuccess(ref("BKS"));
        }}
      >
        {t("pay.verifyAndPay")}
      </button>
    </div>
  );
}

function CardPay({ busy, onSuccess }: { busy: boolean; onSuccess: (r: string) => void }) {
  const t = useTranslations("storefront");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const groupNumber = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
  const groupExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const submit = () => {
    const digits = number.replace(/\D/g, "");
    const e: Record<string, string> = {};
    if (digits.length < 13) e.number = t("pay.cardNumberInvalid");
    const m = /^(\d{2})\/(\d{2})$/.exec(expiry);
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) e.expiry = t("pay.cardExpiryInvalid");
    if (!/^\d{3,4}$/.test(cvc)) e.cvc = t("pay.cardCvcInvalid");
    setErrors(e);
    if (Object.keys(e).length === 0) onSuccess(ref(`CARD${digits.slice(-4)}-`));
  };

  return (
    <div className="rounded-lg border border-line bg-card p-major shadow-card flex flex-col gap-section">
      <p className="text-md font-semibold">{t("pay.cardTitle")}</p>
      <label className="flex flex-col gap-inline">
        <span className="text-base font-semibold">{t("pay.cardNumber")}</span>
        <input
          value={number}
          onChange={(e) => setNumber(groupNumber(e.target.value))}
          inputMode="numeric"
          placeholder="4111 1111 1111 1111"
          className="h-12 w-full rounded-md border border-strong bg-card px-section text-md tabular-nums transition-colors duration-quick focus:border-ember"
        />
        {errors.number && <span className="text-base font-medium text-danger">{errors.number}</span>}
      </label>
      <div className="grid grid-cols-2 gap-tight">
        <label className="flex flex-col gap-inline">
          <span className="text-base font-semibold">{t("pay.cardExpiry")}</span>
          <input
            value={expiry}
            onChange={(e) => setExpiry(groupExpiry(e.target.value))}
            inputMode="numeric"
            placeholder="MM/YY"
            className="h-12 w-full rounded-md border border-strong bg-card px-section text-md tabular-nums transition-colors duration-quick focus:border-ember"
          />
          {errors.expiry && <span className="text-base font-medium text-danger">{errors.expiry}</span>}
        </label>
        <label className="flex flex-col gap-inline">
          <span className="text-base font-semibold">{t("pay.cardCvc")}</span>
          <input
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="123"
            className="h-12 w-full rounded-md border border-strong bg-card px-section text-md tabular-nums transition-colors duration-quick focus:border-ember"
          />
          {errors.cvc && <span className="text-base font-medium text-danger">{errors.cvc}</span>}
        </label>
      </div>
      <p className="text-base text-muted">{t("pay.demoCardHint")}</p>
      <button type="button" disabled={busy} className={cn(sfBtn.primary, "w-full")} onClick={submit}>
        {t("pay.payNow")}
      </button>
    </div>
  );
}

function QrPay({ amount, busy, onSuccess }: { amount: Minor; busy: boolean; onSuccess: (r: string) => void }) {
  const t = useTranslations("storefront");
  const payload = `counterfoil-pay://amount=${amount}&ref=${ref("QR")}`;
  return (
    <div className="rounded-lg border border-line bg-card p-major shadow-card flex flex-col items-center gap-section text-center">
      <p className="text-md font-semibold">{t("pay.qrTitle")}</p>
      <Qr value={payload} size={176} className="rounded-sm border border-hairline" />
      <p className="text-base text-muted">{t("pay.qrHint")}</p>
      <button type="button" disabled={busy} className={cn(sfBtn.primary, "w-full")} onClick={() => onSuccess(ref("QR"))}>
        {t("pay.ivePaid")}
      </button>
    </div>
  );
}
