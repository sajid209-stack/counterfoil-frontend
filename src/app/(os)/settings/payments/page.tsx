"use client";

import { useState } from "react";
import { Check, CircleAlert, CreditCard, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, PageShell, StatusPill, useToast, type PillTone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import {
  activatePaymentAccount,
  createAccountLink,
  createPaymentAccount,
  disablePaymentAccount,
  getAdvancePolicy,
  listPaymentAccounts,
  updateAdvancePolicy,
} from "@/lib/api";
import type { AdvancePolicy, AdvanceRule, PaymentAccount, PaymentAccountStatus, PaymentProvider } from "@/lib/api";
import { SaveBar, SettingRow, SettingsSection, SuffixInput, Switch, controlCls } from "../_components/SettingsKit";

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

/*
 * Payments — the accounts money arrives through, and when a customer may pay
 * part now.
 *
 * Tax used to have a section here and was removed, not moved silently: its
 * rate, inclusive/exclusive switch, name and registration number were saved to
 * a record nothing in the product read, while the till charged a different
 * field on Business setup. Tax has its own page now and writes what the till
 * uses.
 *
 * Connecting or disabling an account is an action that happens at once, so the
 * account rows carry their own buttons. The advance rules are a form, so they
 * share the save bar every other settings form uses — they used to have a Save
 * button that was always enabled, whether or not anything had changed.
 */
export default function MoneySetupPage() {
  const t = useTranslations("moneysetup");
  const toast = useToast();
  const accountsQ = useApiQuery(() => listPaymentAccounts({ pageSize: 100 }), []);
  const accounts = accountsQ.data?.data ?? [];
  const byProvider = (p: PaymentProvider) => accounts.find((a) => a.provider === p);
  const [busy, setBusy] = useState<string | null>(null);

  const advanceQ = useApiQuery(() => getAdvancePolicy(), []);
  const [advBase, setAdvBase] = useState<AdvancePolicy | null>(null);
  const [advDraft, setAdvDraft] = useState<AdvancePolicy | null>(null);
  const [savingAdv, setSavingAdv] = useState(false);
  const savedAdv = advBase ?? advanceQ.data ?? null;
  const adv = advDraft ?? savedAdv;
  const advDirty = !!advDraft && !!savedAdv && JSON.stringify(advDraft) !== JSON.stringify(savedAdv);
  const setRule = (ch: keyof AdvancePolicy, patch: Partial<AdvanceRule>) => {
    if (adv) setAdvDraft({ ...adv, [ch]: { ...adv[ch], ...patch } });
  };
  const saveAdvance = async () => {
    if (!adv) return;
    setSavingAdv(true);
    await updateAdvancePolicy(adv);
    setSavingAdv(false);
    setAdvBase(adv);
    setAdvDraft(null);
    toast.success(t("advance.saved"));
  };

  const connect = async (provider: PaymentProvider, posture: PaymentAccount["posture"]) => {
    setBusy(provider);
    const created = await createPaymentAccount({ provider, posture, locationId: null, country: "BD", defaultCurrency: "BDT" });
    if (created.ok) await createAccountLink(created.data.id);
    setBusy(null);
    toast.info(t("accounts.linkOpened"));
    accountsQ.reload();
  };
  const activate = async (id: string, provider: PaymentProvider) => {
    setBusy(provider);
    await activatePaymentAccount(id);
    setBusy(null);
    toast.success(t("accounts.activated", { provider: t(`provider.${provider}`) }));
    accountsQ.reload();
  };
  const disable = async (id: string, provider: PaymentProvider) => {
    setBusy(provider);
    await disablePaymentAccount(id);
    setBusy(null);
    toast.success(t("accounts.disabledToast", { provider: t(`provider.${provider}`) }));
    accountsQ.reload();
  };

  return (
    <PageShell title={t("title")} description={t("description")}>
      <div className="flex max-w-3xl flex-col gap-section pb-hero">
        <SettingsSection title={t("accounts.title")} description={t("accounts.description")}>
          <div className="flex items-center gap-section px-major py-section">
            <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-subtle text-muted sm:flex">
              <Wallet size={18} strokeWidth={1.5} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">{t("cash.title")}</p>
              <p className="mt-inline text-[13px] text-muted">{t("cash.helper")}</p>
            </div>
            <StatusPill tone="success">{t("cash.always")}</StatusPill>
          </div>

          {PROVIDERS.map(({ provider, posture }) => {
            const acct = byProvider(provider);
            const isBusy = busy === provider;
            return (
              <div key={provider} className="flex flex-col gap-section px-major py-section sm:flex-row sm:items-start">
                <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-subtle text-muted sm:flex">
                  <CreditCard size={18} strokeWidth={1.5} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-tight">
                    <p className="text-sm font-medium text-fg">{t(`provider.${provider}`)}</p>
                    {acct ? (
                      <StatusPill tone={STATUS_TONE[acct.status]}>{t(`status.${acct.status}`)}</StatusPill>
                    ) : (
                      <StatusPill tone="neutral">{t("accounts.notConnected")}</StatusPill>
                    )}
                  </div>
                  <p className="mt-inline text-[13px] text-muted">
                    {t(`provider.${provider}Helper`)} · {t(`posture.${posture}`)}
                  </p>
                  {acct && (
                    <p className="mt-tight flex flex-wrap gap-x-section gap-y-inline text-[13px]">
                      {[
                        { on: acct.chargesEnabled, label: t("accounts.charges") },
                        { on: acct.payoutsEnabled, label: t("accounts.payouts") },
                      ].map(({ on, label }) => (
                        <span key={label} className={cn("inline-flex items-center gap-inline", on ? "text-success" : "text-muted")}>
                          {on ? (
                            <Check size={14} strokeWidth={2} aria-hidden />
                          ) : (
                            <span aria-hidden className="mx-1 h-1.5 w-1.5 rounded-full bg-strong" />
                          )}
                          {label}: {on ? t("accounts.enabled") : t("accounts.off")}
                        </span>
                      ))}
                    </p>
                  )}
                  {acct && acct.requirementsDue.length > 0 && (
                    <div className="mt-section rounded-sm border border-warning/30 bg-warning-wash p-comfortable">
                      <p className="text-[13px] font-medium text-fg">{t("accounts.requirementsDue")}</p>
                      <ul className="mt-inline flex flex-col gap-inline">
                        {acct.requirementsDue.map((r) => (
                          <li key={r} className="flex items-center gap-inline text-[13px] text-muted">
                            <CircleAlert size={14} strokeWidth={1.5} aria-hidden className="shrink-0 text-warning" />
                            {t(`requirement.${r}`)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-tight">
                  {!acct && (
                    <Button size="sm" loading={isBusy} onClick={() => connect(provider, posture)}>
                      {t("accounts.connect")}
                    </Button>
                  )}
                  {acct && acct.status !== "active" && (
                    <Button size="sm" loading={isBusy} onClick={() => activate(acct.id, provider)}>
                      {t("accounts.completeOnboarding")}
                    </Button>
                  )}
                  {acct && acct.status === "active" && (
                    <Button size="sm" variant="secondary" loading={isBusy} onClick={() => disable(acct.id, provider)}>
                      {t("accounts.disable")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </SettingsSection>

        <SettingsSection title={t("advance.title")} description={t("advance.description")}>
          {adv ? (
            (["counter", "online"] as const).map((ch) => {
              const rule = adv[ch];
              return (
                <div key={ch} className="divide-y divide-hairline">
                  <SettingRow label={t(`advance.${ch}`)} description={t(`advance.${ch}Help`)} labelFor={false}>
                    {({ labelId, describedBy }) => (
                      <div className="flex sm:justify-end">
                        <Switch checked={rule.enabled} onChange={(on) => setRule(ch, { enabled: on })} labelledBy={labelId} describedBy={describedBy} />
                      </div>
                    )}
                  </SettingRow>
                  {rule.enabled && (
                    <>
                      <SettingRow label={t("advance.minKind")}>
                        {({ id }) => (
                          <select
                            id={id}
                            value={rule.minKind}
                            onChange={(e) => setRule(ch, { minKind: e.target.value as AdvanceRule["minKind"] })}
                            className={cn(controlCls(), "pr-section")}
                          >
                            <option value="percent">{t("advance.percentOfTotal")}</option>
                            <option value="amount">{t("advance.fixedAmount")}</option>
                          </select>
                        )}
                      </SettingRow>
                      <SettingRow
                        label={rule.minKind === "percent" ? t("advance.minPercent") : t("advance.minAmount")}
                        description={t("advance.minHelp")}
                      >
                        {({ id, describedBy }) => (
                          <SuffixInput
                            id={id}
                            value={rule.minKind === "percent" ? String(rule.minValue) : String(rule.minValue / 100)}
                            onChange={(v) => {
                              const n = parseFloat(v) || 0;
                              setRule(ch, {
                                minValue: rule.minKind === "percent" ? Math.max(0, Math.min(100, Math.round(n))) : Math.round(n * 100),
                              });
                            }}
                            suffix={rule.minKind === "percent" ? "%" : "৳"}
                            describedBy={describedBy}
                            inputMode={rule.minKind === "percent" ? "numeric" : "decimal"}
                          />
                        )}
                      </SettingRow>
                    </>
                  )}
                </div>
              );
            })
          ) : (
            <div className="px-major py-section">
              <div className="h-11 animate-pulse rounded-sm bg-line/50" />
            </div>
          )}
        </SettingsSection>

        <SaveBar dirty={advDirty} saving={savingAdv} onSave={saveAdvance} onDiscard={() => setAdvDraft(null)} />
      </div>
    </PageShell>
  );
}
