"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { DateField, PageShell, RadioGroup, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { BIN_LENGTH, binDigits, formatBin, getVatSettings, invoiceNumber, updateVatSettings } from "@/lib/api";
import type { VatReturnPeriod, VatSettings } from "@/lib/api";
import { formatDay } from "@/lib/format";
import { demoNow } from "@/lib/schedule";
import { SaveBar, SectionSkeleton, SettingRow, SettingsSection, Switch, controlCls } from "../_components/SettingsKit";

interface Draft {
  registered: boolean;
  /** The BIN as typed — dashes and spaces allowed. */
  bin: string;
  legalName: string;
  address: string;
  registeredOn: string;
  printOnReceipts: boolean;
  invoicePrefix: string;
  returnPeriod: VatReturnPeriod;
}

const PREFIX = /^[A-Za-z0-9-]{0,12}$/;

const toDraft = (v: VatSettings): Draft => ({
  registered: v.registered,
  bin: formatBin(v.bin),
  legalName: v.legalName,
  address: v.address,
  registeredOn: v.registeredOn,
  printOnReceipts: v.printOnReceipts,
  invoicePrefix: v.invoicePrefix,
  returnPeriod: v.returnPeriod,
});

const iso = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** The 15th after the current period closes: next month for monthly returns,
 *  the month after the quarter ends for quarterly ones. */
function nextDue(now: Date, period: VatReturnPeriod): string {
  const m = now.getMonth();
  const closes = period === "monthly" ? m : Math.floor(m / 3) * 3 + 2;
  return iso(new Date(now.getFullYear(), closes + 1, 15, 12));
}

/**
 * VAT registration and tax invoices.
 *
 * The rates are on the Tax page; this is the rest of what Bangladesh asks of a
 * VAT-registered business: its Business Identification Number, the Mushak-6.3
 * tax invoice numbering, and how often it files. Printing the registration on
 * receipts moved here from Tax so the number and the switch that prints it are
 * on one page.
 */
export default function VatPage() {
  const t = useTranslations("settings");
  const tt = useTranslations("ticket");
  const tc = useTranslations("common");
  const toast = useToast();
  const q = useApiQuery(() => getVatSettings(), []);

  const [base, setBase] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const saved = base ?? (q.data ? toDraft(q.data) : null);
  const form = draft ?? saved;
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch: Partial<Draft>) => {
    if (form) setDraft({ ...form, ...patch });
  };

  const now = demoNow();
  const digits = form ? binDigits(form.bin) : "";
  const binOk = digits.length === BIN_LENGTH;
  // Words beside the field, live: how far along the number is, never just "invalid".
  const binError = !form?.registered
    ? undefined
    : digits.length === 0
      ? t("vat.binEmpty")
      : digits.length < BIN_LENGTH
        ? t("vat.binShort", { have: digits.length, need: BIN_LENGTH - digits.length })
        : digits.length > BIN_LENGTH
          ? t("vat.binLong", { extra: digits.length - BIN_LENGTH })
          : undefined;
  const prefixOk = !!form && PREFIX.test(form.invoicePrefix);
  const prefixError = form && !prefixOk ? t("vat.prefixInvalid") : undefined;
  const invalid = !!form && form.registered && (!binOk || !prefixOk);
  const nextNo = q.data?.invoiceNext ?? 1;

  const save = async () => {
    if (!form || !q.data || invalid) return;
    setSaving(true);
    const res = await updateVatSettings({
      ...q.data,
      registered: form.registered,
      bin: digits,
      legalName: form.legalName.trim(),
      address: form.address.trim(),
      registeredOn: form.registeredOn,
      printOnReceipts: form.printOnReceipts && binOk,
      invoicePrefix: form.invoicePrefix,
      returnPeriod: form.returnPeriod,
    });
    setSaving(false);
    if (res.ok) {
      setBase(toDraft(res.data));
      setDraft(null);
      toast.success(t("vat.saved"));
    } else {
      toast.error(res.error.message);
    }
  };

  return (
    <PageShell title={t("vat.title")} description={t("vat.description")}>
      {!form ? (
        <SectionSkeleton />
      ) : (
        <div className="flex flex-col gap-section pb-hero">
          <SettingsSection title={t("vat.registrationTitle")} description={t("vat.registrationDesc")}>
            <SettingRow
              label={t("vat.registered")}
              description={form.registered ? t("vat.registeredYes") : t("vat.registeredNo")}
              labelFor={false}
              trailing
            >
              {({ labelId, describedBy }) => (
                <Switch checked={form.registered} onChange={(on) => set({ registered: on })} labelledBy={labelId} describedBy={describedBy} />
              )}
            </SettingRow>
            {form.registered && (
              <>
                <SettingRow
                  label={t("vat.bin")}
                  description={binOk ? t("vat.binOk", { bin: formatBin(digits) }) : t("vat.binDesc")}
                  error={binError}
                >
                  {({ id, describedBy }) => (
                    <input
                      id={id}
                      value={form.bin}
                      onChange={(e) => set({ bin: e.target.value })}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder={t("vat.binPlaceholder")}
                      aria-invalid={!!binError || undefined}
                      aria-describedby={describedBy}
                      className={`${controlCls(!!binError)} font-mono`}
                    />
                  )}
                </SettingRow>
                <SettingRow label={t("vat.legalName")} description={t("vat.legalNameDesc")}>
                  {({ id, describedBy }) => (
                    <input
                      id={id}
                      value={form.legalName}
                      onChange={(e) => set({ legalName: e.target.value })}
                      aria-describedby={describedBy}
                      className={controlCls()}
                    />
                  )}
                </SettingRow>
                <SettingRow label={t("vat.address")} description={t("vat.addressDesc")}>
                  {({ id, describedBy }) => (
                    <textarea
                      id={id}
                      rows={2}
                      value={form.address}
                      onChange={(e) => set({ address: e.target.value })}
                      aria-describedby={describedBy}
                      className={`${controlCls(false)} h-auto resize-y py-tight leading-relaxed`}
                    />
                  )}
                </SettingRow>
                <SettingRow label={t("vat.registeredDate")} description={t("vat.registeredDateDesc")}>
                  {({ id }) => (
                    <DateField
                      id={id}
                      size="form"
                      value={form.registeredOn || null}
                      today={iso(now)}
                      max={iso(now)}
                      onChange={(d) => set({ registeredOn: d })}
                      labels={{ previousMonth: tc("previousMonth"), nextMonth: tc("nextMonth"), today: tc("today"), open: tc("openCalendar") }}
                      placeholder={t("vat.registeredDatePlaceholder")}
                    />
                  )}
                </SettingRow>
              </>
            )}
          </SettingsSection>

          {form.registered && (
            <>
              <SettingsSection title={t("vat.invoiceTitle")} description={t("vat.invoiceDesc")}>
                <SettingRow
                  label={t("vat.onReceipts")}
                  description={
                    binOk
                      ? t("vat.onReceiptsDesc", { line: tt("taxReg", { name: "VAT", number: formatBin(digits) }) })
                      : t("vat.onReceiptsNeedsBin")
                  }
                  labelFor={false}
                  trailing
                >
                  {({ labelId, describedBy }) => (
                    <Switch
                      checked={form.printOnReceipts && binOk}
                      disabled={!binOk}
                      onChange={(on) => set({ printOnReceipts: on })}
                      labelledBy={labelId}
                      describedBy={describedBy}
                    />
                  )}
                </SettingRow>
                <SettingRow
                  label={t("vat.prefix")}
                  description={prefixOk ? t("vat.prefixExample", { number: invoiceNumber(form.invoicePrefix, nextNo) }) : t("vat.prefixDesc")}
                  error={prefixError}
                >
                  {({ id, describedBy }) => (
                    <input
                      id={id}
                      value={form.invoicePrefix}
                      onChange={(e) => set({ invoicePrefix: e.target.value })}
                      maxLength={12}
                      autoComplete="off"
                      placeholder="M63-"
                      aria-invalid={!!prefixError || undefined}
                      aria-describedby={describedBy}
                      className={`${controlCls(!!prefixError)} font-mono`}
                    />
                  )}
                </SettingRow>
              </SettingsSection>

              <SettingsSection title={t("vat.filingTitle")} description={t("vat.filingDesc")}>
                <SettingRow label={t("vat.period")} layout="stack" labelFor={false}>
                  {({ labelId }) => (
                    <RadioGroup
                      aria-labelledby={labelId}
                      value={form.returnPeriod}
                      onChange={(v) => set({ returnPeriod: v as VatReturnPeriod })}
                      options={[
                        { value: "monthly", label: t("vat.periodMonthly"), description: t("vat.periodMonthlyDesc") },
                        { value: "quarterly", label: t("vat.periodQuarterly"), description: t("vat.periodQuarterlyDesc") },
                      ]}
                    />
                  )}
                </SettingRow>
                <SettingRow label={t("vat.nextDue")} description={t("vat.nextDueDesc")} labelFor={false} trailing>
                  {() => <p className="text-base font-semibold text-fg">{formatDay(nextDue(now, form.returnPeriod), { weekday: true })}</p>}
                </SettingRow>
                <SettingRow label={t("vat.analyticsLabel")} description={t("vat.analyticsDesc")} labelFor={false}>
                  {() => (
                    <Link
                      href="/analytics#vat"
                      className="inline-flex min-h-11 items-center gap-tight text-base font-medium text-brand-foreground underline-offset-4 hover:underline md:min-h-9"
                    >
                      {t("vat.analyticsLink")}
                      <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
                    </Link>
                  )}
                </SettingRow>
              </SettingsSection>
            </>
          )}

          <SaveBar dirty={dirty} saving={saving} invalid={invalid} onSave={save} onDiscard={() => setDraft(null)} />
        </div>
      )}
    </PageShell>
  );
}
