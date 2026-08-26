"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, FormField, PageShell, StatusPill, useToast, type PillTone } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  activatePaymentAccount,
  createAccountLink,
  createPaymentAccount,
  disablePaymentAccount,
  getTaxConfig,
  listPaymentAccounts,
  updateTaxConfig,
} from "@/lib/api";
import type { PaymentAccount, PaymentAccountStatus, PaymentProvider, TaxConfig } from "@/lib/api";

const PROVIDERS: { provider: PaymentProvider; posture: PaymentAccount["posture"] }[] = [
  { provider: "bkash", posture: "merchant_of_record" },
  { provider: "sslcommerz", posture: "merchant_of_record" },
  { provider: "stripe", posture: "connect" },
];

const STATUS_TONE: Record<PaymentAccountStatus, PillTone> = {
  active: "success",
  pending_onboarding: "warning",
  restricted: "warning",
  disabled: "neutral",
};

export default function MoneySetupPage() {
  const t = useTranslations("moneysetup");
  const toast = useToast();
  const accountsQ = useApiQuery(() => listPaymentAccounts({ pageSize: 100 }), []);
  const taxQ = useApiQuery(() => getTaxConfig(), []);
  const accounts = accountsQ.data?.data ?? [];
  const byProvider = (p: PaymentProvider) => accounts.find((a) => a.provider === p);
  const [busy, setBusy] = useState<string | null>(null);

  // Tax form state, hydrated from the config.
  const [tax, setTax] = useState<TaxConfig | null>(null);
  const [savingTax, setSavingTax] = useState(false);
  useEffect(() => { if (taxQ.data) setTax(taxQ.data); }, [taxQ.data]);

  const connect = async (provider: PaymentProvider, posture: PaymentAccount["posture"]) => {
    setBusy(provider);
    const created = await createPaymentAccount({ provider, posture, locationId: null, country: "BD", defaultCurrency: "BDT" });
    if (created.ok) await createAccountLink(created.data.id);
    setBusy(null);
    toast.info(t("accounts.linkOpened"));
    accountsQ.reload();
  };
  const activate = async (id: string, provider: PaymentProvider) => {
    setBusy(provider); await activatePaymentAccount(id); setBusy(null);
    toast.success(t("accounts.activated", { provider: t(`provider.${provider}`) }));
    accountsQ.reload();
  };
  const disable = async (id: string, provider: PaymentProvider) => {
    setBusy(provider); await disablePaymentAccount(id); setBusy(null);
    toast.success(t("accounts.disabledToast", { provider: t(`provider.${provider}`) }));
    accountsQ.reload();
  };

  const saveTax = async () => {
    if (!tax) return;
    setSavingTax(true);
    await updateTaxConfig(tax);
    setSavingTax(false);
    toast.success(t("tax.saved"));
    taxQ.reload();
  };

  return (
    <PageShell title={t("title")} description={t("description")}>
      <div className="flex max-w-2xl flex-col gap-major">
        {/* ── Payment accounts ─────────────────────────────────────────── */}
        <section>
          <h2 className="type-h2 mb-inline text-base">{t("accounts.title")}</h2>
          <p className="mb-section text-[13px] text-faint">{t("accounts.description")}</p>

          <div className="overflow-hidden rounded-md border border-line bg-card">
            {/* Cash — always on, no account */}
            <div className="flex items-center gap-section border-b border-line p-section">
              <Wallet size={20} strokeWidth={1.5} className="shrink-0 text-faint" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t("cash.title")}</div>
                <div className="text-[12px] text-faint">{t("cash.helper")}</div>
              </div>
              <StatusPill tone="success">{t("cash.always")}</StatusPill>
            </div>

            {PROVIDERS.map(({ provider, posture }) => {
              const acct = byProvider(provider);
              const isBusy = busy === provider;
              return (
                <div key={provider} className="flex flex-col gap-tight border-b border-line p-section last:border-0 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-tight">
                      <span className="text-sm font-medium">{t(`provider.${provider}`)}</span>
                      {acct
                        ? <StatusPill tone={STATUS_TONE[acct.status]}>{t(`status.${acct.status}`)}</StatusPill>
                        : <StatusPill tone="neutral">{t("accounts.notConnected")}</StatusPill>}
                    </div>
                    <div className="mt-inline text-[12px] text-faint">{t(`provider.${provider}Helper`)} · {t(`posture.${posture}`)}</div>
                    {acct && (
                      <div className="mt-tight flex flex-wrap gap-x-major gap-y-inline font-mono text-[11px]">
                        <span className={acct.chargesEnabled ? "text-success" : "text-faint"}>{t("accounts.charges")}: {acct.chargesEnabled ? t("accounts.enabled") : t("accounts.off")}</span>
                        <span className={acct.payoutsEnabled ? "text-success" : "text-faint"}>{t("accounts.payouts")}: {acct.payoutsEnabled ? t("accounts.enabled") : t("accounts.off")}</span>
                      </div>
                    )}
                    {acct && acct.requirementsDue.length > 0 && (
                      <div className="mt-tight flex flex-col gap-inline">
                        <span className="type-label text-[10px] text-warning">{t("accounts.requirementsDue")}</span>
                        {acct.requirementsDue.map((r) => (
                          <span key={r} className="flex items-center gap-inline text-[12px] text-muted"><CircleAlert size={13} strokeWidth={1.5} className="text-warning" />{t(`requirement.${r}`)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-tight">
                    {!acct && <Button size="sm" loading={isBusy} onClick={() => connect(provider, posture)}>{t("accounts.connect")}</Button>}
                    {acct && acct.status !== "active" && <Button size="sm" loading={isBusy} onClick={() => activate(acct.id, provider)}>{t("accounts.completeOnboarding")}</Button>}
                    {acct && acct.status === "active" && <Button size="sm" variant="secondary" loading={isBusy} onClick={() => disable(acct.id, provider)}>{t("accounts.disable")}</Button>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Tax ──────────────────────────────────────────────────────── */}
        <section className="rounded-md border border-line bg-card p-major">
          <h2 className="type-h2 mb-section text-base">{t("tax.title")}</h2>
          {tax && (
            <div className="grid gap-section sm:grid-cols-2">
              <FormField
                label={t("tax.mode")}
                variant="select"
                value={tax.mode}
                onChange={(e) => setTax({ ...tax, mode: e.target.value as TaxConfig["mode"] })}
                options={[{ value: "exclusive", label: t("tax.exclusive") }, { value: "inclusive", label: t("tax.inclusive") }]}
              />
              <FormField
                label={t("tax.rate")}
                variant="number"
                value={String(tax.rateBasisPoints / 100)}
                onChange={(e) => setTax({ ...tax, rateBasisPoints: Math.round((parseFloat(e.target.value) || 0) * 100) })}
              />
              <FormField label={t("tax.name")} value={tax.taxName} onChange={(e) => setTax({ ...tax, taxName: e.target.value })} />
              <FormField label={t("tax.regNumber")} value={tax.registrationNumber ?? ""} onChange={(e) => setTax({ ...tax, registrationNumber: e.target.value })} />
            </div>
          )}
          <Button className="mt-section" loading={savingTax} onClick={saveTax}><Check size={16} strokeWidth={1.5} /> {t("tax.save")}</Button>
        </section>
      </div>
    </PageShell>
  );
}
