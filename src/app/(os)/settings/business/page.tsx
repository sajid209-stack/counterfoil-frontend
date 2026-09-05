"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, PageShell, useToast } from "@/components/ui";
import { AppearancePicker } from "@/components/ThemeProvider";
import { LanguagePicker } from "@/components/LocaleProvider";
import { getOperator, updateOperator, type Operator } from "@/lib/api";
import { DEFAULT_SMS_TEMPLATE, SMS_PLACEHOLDERS, renderSms } from "@/lib/sms";

const CURRENCIES = ["BDT", "MYR", "USD", "CAD"];
const TIMEZONES = ["Asia/Dhaka", "Asia/Kuala_Lumpur", "America/New_York", "America/Toronto"];

interface FormState {
  name: string;
  currency: string;
  defaultTimezone: string;
  taxRatePct: string;
  pastEditLockDays: string;
  smsTemplate: string;
}

const fromOperator = (o: Operator): FormState => ({
  name: o.name,
  currency: o.currency,
  defaultTimezone: o.defaultTimezone,
  taxRatePct: String(o.taxRatePct),
  pastEditLockDays: o.pastEditLockDays == null ? "" : String(o.pastEditLockDays),
  smsTemplate: o.smsTemplate ?? DEFAULT_SMS_TEMPLATE,
});

export default function BusinessSetupPage() {
  const t = useTranslations("settings");
  const toast = useToast();
  const [state, setState] = useState<FormState | null>(null);
  const [initial, setInitial] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOperator().then((res) => {
      if (res.ok) {
        const s = fromOperator(res.data);
        setState(s);
        setInitial(s);
      }
    });
  }, []);

  const dirty = useMemo(
    () => !!state && !!initial && JSON.stringify(state) !== JSON.stringify(initial),
    [state, initial],
  );

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setState((s) => (s ? { ...s, [k]: v } : s));

  const save = async () => {
    if (!state) return;
    setSaving(true);
    const res = await updateOperator({
      name: state.name,
      currency: state.currency,
      defaultTimezone: state.defaultTimezone,
      taxRatePct: parseFloat(state.taxRatePct) || 0,
      pastEditLockDays: state.pastEditLockDays.trim() === "" ? null : Number(state.pastEditLockDays),
      smsTemplate: state.smsTemplate,
    });
    setSaving(false);
    if (res.ok) {
      const s = fromOperator(res.data);
      setState(s);
      setInitial(s);
      toast.success(t("business.saved"));
    } else {
      toast.error(res.error.message);
    }
  };

  return (
    <PageShell title={t("business.title")} description={t("business.description")}>
      {!state ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : (
        <div className="flex max-w-2xl flex-col gap-section pb-hero">
          <div className="card-surface p-major">
            <h2 className="type-h2 mb-section text-base">{t("business.identity")}</h2>
            <div className="grid gap-section sm:grid-cols-2">
              <FormField label={t("business.businessName")} value={state.name} onChange={(e) => set("name", e.target.value)} className="sm:col-span-2" />
              <div className="flex flex-col gap-tight">
                <span className="type-label text-[12px] text-muted">{t("business.logo")}</span>
                <div className="flex h-20 items-center justify-center rounded-sm border border-dashed border-line text-[12px] text-faint">
                  {t("business.logoHint")}
                </div>
              </div>
            </div>
          </div>

          <div className="card-surface p-major">
            <h2 className="type-h2 mb-section text-base">{t("business.regional")}</h2>
            <div className="grid gap-section sm:grid-cols-3">
              <FormField
                label={t("business.currency")}
                variant="select"
                value={state.currency}
                onChange={(e) => set("currency", e.target.value)}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
              <FormField
                label={t("common.timezone")}
                variant="select"
                value={state.defaultTimezone}
                onChange={(e) => set("defaultTimezone", e.target.value)}
                options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
              />
              <FormField label={t("business.taxRate")} variant="number" value={state.taxRatePct} onChange={(e) => set("taxRatePct", e.target.value)} />
              {/* §61.10 — closing history stops a mis-keyed refund landing on
                  a month that has already been reconciled. */}
              <FormField
                label={t("business.pastEditLock")}
                variant="number"
                value={state.pastEditLockDays}
                onChange={(e) => set("pastEditLockDays", e.target.value)}
                help={t("business.pastEditLockHelp")}
              />
            </div>
          </div>

          <div className="card-surface p-major">
            <h2 className="type-h2 mb-section text-base">{t("business.smsSection")}</h2>
            <FormField
              label={t("business.smsTemplate")}
              variant="textarea"
              rows={3}
              value={state.smsTemplate}
              onChange={(e) => set("smsTemplate", e.target.value)}
              help={t("business.smsHelp")}
            />
            <div className="mt-tight flex flex-wrap gap-tight text-[12px] text-muted">
              {SMS_PLACEHOLDERS.map((p) => (
                <span key={p.key} className="rounded-xs border border-line bg-subtle px-tight py-inline font-mono text-[12px]">{p.key} <span className="font-sans text-faint">= {p.means}</span></span>
              ))}
            </div>
            <p className="mt-section text-[12px] text-faint">{t("business.preview")}</p>
            <p className="mt-inline rounded-sm border border-line bg-subtle p-comfortable text-[13px]">
              {renderSms(state.smsTemplate, { business: state.name, code: "CF-2026-000123-01", date: "2026-07-29" })}
            </p>
          </div>

          <div className="card-surface p-major">
            <h2 className="type-h2 mb-section text-base">{t("business.appearance")}</h2>
            <AppearancePicker className="max-w-sm" />
            <div className="mt-major">
              <LanguagePicker className="max-w-sm" />
            </div>
            <p className="mt-tight text-[12px] text-faint">{t("business.appearanceNote")}</p>
          </div>

          <div className="sticky bottom-0 max-md:bottom-[calc(56px+env(safe-area-inset-bottom))] flex items-center justify-end gap-tight border-t border-line bg-surface py-section">
            <Button onClick={save} loading={saving} disabled={!dirty}>
              {t("common.saveChanges")}
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
