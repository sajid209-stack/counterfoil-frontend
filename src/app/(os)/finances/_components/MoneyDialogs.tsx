"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, CreditCard, Landmark, Smartphone, type LucideIcon } from "lucide-react";
import { Button, Modal, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { deposit, withdraw, type DepositMethod, type FinanceSummary, type ID } from "@/lib/api";

/** "1,276.74" or "500" → minor units; NaN for anything else. */
const toMinor = (text: string) => {
  const s = text.replace(/,/g, "").trim();
  return /^\d+(\.\d{1,2})?$|^\.\d{1,2}$/.test(s) ? Math.round(parseFloat(s) * 100) : NaN;
};
const toText = (minor: number) => (minor / 100).toFixed(2);

/** A money field: the ৳ sits inside it, the figure is large, and a refusal
 *  is said in words underneath and tied to the field for a screen reader. */
function AmountField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-tight">
      <label htmlFor={id} className="type-label text-[0.75rem] text-muted">{label}</label>
      <div className={cn("flex h-12 items-center rounded-sm border bg-card px-comfortable focus-within:ring-2", error ? "border-danger focus-within:ring-danger/20" : "border-line focus-within:border-ember focus-within:ring-ember/20")}>
        <span aria-hidden className="mr-tight text-[18px] font-semibold text-muted">৳</span>
        <input
          id={id}
          data-autofocus
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-msg` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-[20px] font-semibold outline-none"
        />
      </div>
      {error && <p id={`${id}-msg`} role="alert" className="text-[0.75rem] text-danger">{error}</p>}
    </div>
  );
}

const chip = "inline-flex h-11 items-center rounded-full border border-line bg-card px-section text-[13px] font-medium transition-colors duration-quick hover:border-inverse md:h-9";

export function WithdrawDialog({ locationId, summary, onClose, onDone }: { locationId: ID; summary: FinanceSummary; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("finances");
  const toast = useToast();
  const [text, setText] = useState(toText(Math.max(0, summary.available)));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const minor = toMinor(text);
  const bank = summary.destination ?? "";

  const submit = async () => {
    if (!Number.isFinite(minor) || minor <= 0) {
      setError(t("withdraw.enter"));
      return;
    }
    setBusy(true);
    setError(undefined);
    const res = await withdraw(locationId, minor, "You");
    setBusy(false);
    if (!res.ok) {
      setError(res.error.fieldErrors?.amount ?? res.error.message);
      return;
    }
    toast.success(t("withdraw.done", { amount: formatMoney(minor), bank }));
    onDone();
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("withdraw.title")}
      footer={
        <Button loading={busy} onClick={submit} fullWidth className="md:w-auto">
          {t("withdraw.submit", { amount: Number.isFinite(minor) && minor > 0 ? formatMoney(minor) : "" }).trim()}
        </Button>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="flex flex-col gap-section">
        <AmountField label={t("withdraw.amount")} value={text} onChange={(v) => { setText(v); setError(undefined); }} error={error} />
        <p aria-live="polite" className="min-h-5 text-[13px] text-muted">
          {Number.isFinite(minor) && minor > 0 && minor <= summary.available ? t("withdraw.leaves", { amount: formatMoney(summary.available - minor) }) : ""}
        </p>
        <div className="flex flex-wrap gap-tight">
          <button type="button" className={chip} onClick={() => { setText(toText(summary.available)); setError(undefined); }}>
            {t("withdraw.all", { amount: formatMoney(summary.available) })}
          </button>
          <button type="button" className={chip} onClick={() => { setText(toText(Math.floor(summary.available / 2))); setError(undefined); }}>
            {t("withdraw.half")}
          </button>
        </div>
        <div className="rounded-sm border border-hairline bg-subtle p-comfortable">
          <p className="text-[12px] text-muted">{t("withdraw.goesTo")}</p>
          <p className="mt-inline flex items-center gap-tight text-[14px] font-medium">
            <Landmark size={16} strokeWidth={1.5} aria-hidden className="text-muted" />
            {bank}
          </p>
          <Link href="/settings/payments" className="mt-tight inline-flex min-h-11 items-center text-[13px] font-medium text-brand-foreground underline underline-offset-2 hover:opacity-80 md:min-h-9">
            {t("withdraw.change")}
          </Link>
        </div>
        <p className="text-[13px] text-muted">{t("withdraw.arrives")}</p>
      </form>
    </Modal>
  );
}

const METHODS: { value: DepositMethod; Icon: LucideIcon; label: "bkash" | "card" | "bank" }[] = [
  { value: "bkash", Icon: Smartphone, label: "bkash" },
  { value: "card_terminal", Icon: CreditCard, label: "card" },
  { value: "bank_transfer", Icon: Landmark, label: "bank" },
];

export function DepositDialog({ locationId, summary, onClose, onDone }: { locationId: ID; summary: FinanceSummary; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("finances");
  const toast = useToast();
  const owed = summary.available < 0 ? -summary.available : 0;
  const [text, setText] = useState(owed ? toText(owed) : "");
  const [method, setMethod] = useState<DepositMethod>("bkash");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const minor = toMinor(text);

  const submit = async () => {
    if (!Number.isFinite(minor) || minor <= 0) {
      setError(t("deposit.enter"));
      return;
    }
    setBusy(true);
    setError(undefined);
    const res = await deposit(locationId, minor, method, "You");
    setBusy(false);
    if (!res.ok) {
      setError(res.error.fieldErrors?.amount ?? res.error.message);
      return;
    }
    toast.success(t("deposit.done", { amount: formatMoney(minor) }));
    onDone();
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("deposit.title")}
      description={owed ? t("deposit.owed", { amount: formatMoney(owed) }) : undefined}
      footer={
        <Button loading={busy} onClick={submit} fullWidth className="md:w-auto">
          {t("deposit.submit", { amount: Number.isFinite(minor) && minor > 0 ? formatMoney(minor) : "" }).trim()}
        </Button>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="flex flex-col gap-section">
        <AmountField label={t("deposit.amount")} value={text} onChange={(v) => { setText(v); setError(undefined); }} error={error} />
        <p aria-live="polite" className="min-h-5 text-[13px] text-muted">
          {Number.isFinite(minor) && minor > 0 ? t("deposit.willBe", { amount: formatMoney(summary.available + minor) }) : ""}
        </p>
        <fieldset className="flex flex-col gap-tight">
          <legend className="type-label mb-tight text-[0.75rem] text-muted">{t("deposit.method")}</legend>
          <div className="grid grid-cols-3 gap-tight">
            {METHODS.map(({ value, Icon, label }) => {
              const chosen = method === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => setMethod(value)}
                  className={cn(
                    "relative flex min-h-[76px] flex-col items-center justify-center gap-tight rounded-sm border px-tight py-comfortable text-center text-[13px] font-medium leading-tight transition-colors duration-quick",
                    chosen ? "border-ember-solid bg-ember-solid text-white" : "border-line bg-card text-fg hover:border-inverse",
                  )}
                >
                  {chosen && <Check size={14} strokeWidth={3} aria-hidden className="absolute right-tight top-tight" />}
                  <Icon size={20} strokeWidth={1.5} aria-hidden />
                  {label === "bkash" ? t("by.bkash") : label === "card" ? t("deposit.card") : t("detail.bankTransfer")}
                </button>
              );
            })}
          </div>
        </fieldset>
        <p className="text-[13px] text-muted">{t("deposit.note")}</p>
      </form>
    </Modal>
  );
}
