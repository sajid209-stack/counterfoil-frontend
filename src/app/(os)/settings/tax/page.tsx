"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PageShell, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getTaxConfig, listProducts, updateOperator, updateTaxConfig } from "@/lib/api";
import type { Operator, TaxConfig } from "@/lib/api";
import { formatMoney, formatPriceShort } from "@/lib/format";
import { SaveBar, SectionSkeleton, SettingRow, SettingsSection, SuffixInput, Switch, controlCls } from "../_components/SettingsKit";

interface Draft {
  standard: string;
  reduced: string;
  name: string;
  reg: string;
  onReceipts: boolean;
}

/** ৳1,000 in minor units — a round sale the operator can check in their head. */
const SAMPLE = 100_000;

/** A rate from 0 to 100 with at most two decimals, or null. "7.5" and "7,5" both. */
function parseRate(raw: string): number | null {
  const s = raw.replace(",", ".").trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n <= 100 ? n : null;
}

const toDraft = (op: Operator, tax: TaxConfig): Draft => ({
  standard: String(op.taxRatePct),
  reduced: String(op.reducedRatePct ?? 0),
  name: tax.taxName,
  reg: tax.registrationNumber ?? "",
  onReceipts: !!tax.showOnReceipts,
});

/**
 * Tax, in one place.
 *
 * It was in two, and only one of them did anything. Business → Regional held
 * `taxRatePct`, which is what the till charges. Payments → Tax held a second
 * rate, an inclusive/exclusive switch, a tax name and a registration number,
 * and nothing in the product read any of it — so an operator could change VAT
 * there, be told "Saved", and keep being charged the old rate. The reduced rate
 * the till ALSO charges had no control anywhere.
 *
 * This page writes the rates the till reads, keeps the tax-config record in
 * step with them so the backend contract never disagrees with the till, and
 * drops the inclusive/exclusive switch: the till adds tax on top of the price,
 * always, and a control offering the other behaviour would be a promise it
 * cannot keep.
 *
 * The registration number now does something too: where a business is required
 * to show it, the receipt prints it under the business name.
 */
export default function TaxPage() {
  const t = useTranslations("settings");
  const tt = useTranslations("ticket");
  const toast = useToast();
  const opQ = useApiQuery(() => getOperator(), []);
  const taxQ = useApiQuery(() => getTaxConfig(), []);
  const prodQ = useApiQuery(() => listProducts({ pageSize: 500 }), []);

  // `base` is what was last saved from this page. Clearing the draft straight
  // after a save would otherwise flick the fields back to the stale query for
  // a frame before the reload lands.
  const [base, setBase] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const saved = base ?? (opQ.data && taxQ.data ? toDraft(opQ.data, taxQ.data) : null);
  const form = draft ?? saved;
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    if (form) setDraft({ ...form, [key]: value });
  };

  // How many bookings each rate actually lands on. A rate is only as
  // consequential as the sales it applies to, and "Used by 14 bookings" beside
  // the field is the thing that makes someone stop before changing it.
  const usage = useMemo(() => {
    const count = { standard: 0, reduced: 0, exempt: 0 };
    for (const p of prodQ.data?.data ?? []) if (p.status === "active") count[p.taxClass ?? "standard"] += 1;
    return count;
  }, [prodQ.data]);

  const standard = form ? parseRate(form.standard) : null;
  const reduced = form ? parseRate(form.reduced) : null;
  const standardErr = form && standard === null ? t("tax.rateInvalid") : undefined;
  const reducedErr = form && reduced === null ? t("tax.rateInvalid") : undefined;
  const currency = opQ.data?.currency ?? "BDT";
  // Printing needs a number to print; without one the switch waits, off.
  const hasReg = !!form?.reg.trim();

  const save = async () => {
    if (!form || standard === null || reduced === null) return;
    setSaving(true);
    const [op, tax] = await Promise.all([
      updateOperator({ taxRatePct: standard, reducedRatePct: reduced }),
      updateTaxConfig({
        rateBasisPoints: Math.round(standard * 100),
        taxName: form.name.trim(),
        registrationNumber: form.reg.trim() || undefined,
        showOnReceipts: form.onReceipts && hasReg,
      }),
    ]);
    setSaving(false);
    if (op.ok && tax.ok) {
      setBase(toDraft(op.data, tax.data));
      setDraft(null);
      toast.success(t("tax.saved"));
    } else {
      const failure = !op.ok ? op.error : !tax.ok ? tax.error : null;
      toast.error(failure?.message ?? t("save.invalid"));
    }
  };

  const example = [
    { key: "standard", label: t("tax.standard"), rate: standard },
    { key: "reduced", label: t("tax.reduced"), rate: reduced },
    { key: "exempt", label: t("tax.exempt"), rate: 0 },
  ];

  return (
    <PageShell title={t("tax.title")} description={t("tax.description")}>
      {!form ? (
        <SectionSkeleton />
      ) : (
        <div className="flex max-w-3xl flex-col gap-section pb-hero">
          <SettingsSection title={t("tax.ratesTitle")} description={t("tax.ratesDesc")}>
            <SettingRow label={t("tax.standard")} description={t("tax.standardDesc", { count: usage.standard })} error={standardErr}>
              {({ id, describedBy }) => (
                <SuffixInput id={id} value={form.standard} onChange={(v) => set("standard", v)} suffix="%" invalid={!!standardErr} describedBy={describedBy} />
              )}
            </SettingRow>
            <SettingRow label={t("tax.reduced")} description={t("tax.reducedDesc", { count: usage.reduced })} error={reducedErr}>
              {({ id, describedBy }) => (
                <SuffixInput id={id} value={form.reduced} onChange={(v) => set("reduced", v)} suffix="%" invalid={!!reducedErr} describedBy={describedBy} />
              )}
            </SettingRow>
            <SettingRow label={t("tax.exempt")} description={t("tax.exemptDesc", { count: usage.exempt })} labelFor={false}>
              {() => <p className="flex h-11 items-center text-sm text-muted">{t("tax.noTax")}</p>}
            </SettingRow>
          </SettingsSection>

          {/* The rates as money. "15%" is a setting; "a ৳1,000 sale comes to
              ৳1,150" is what the counter will actually say to a customer, and
              it updates as the field is typed so a slip is seen before it is
              saved rather than after the first receipt. */}
          <SettingsSection title={t("tax.exampleTitle", { amount: formatPriceShort(SAMPLE, currency) })} description={t("tax.exampleDesc")}>
            <div className="overflow-x-auto">
              <table className="table-inset w-full min-w-[26rem] text-sm">
                <thead>
                  <tr className="text-left text-[12px] text-muted">
                    <th scope="col" className="px-card py-tight font-medium">{t("tax.colClass")}</th>
                    <th scope="col" className="px-section py-tight text-right font-medium">{t("tax.colPrice")}</th>
                    <th scope="col" className="px-section py-tight text-right font-medium">{t("tax.colTax")}</th>
                    <th scope="col" className="px-card py-tight text-right font-medium">{t("tax.colTotal")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline border-t border-hairline">
                  {example.map((row) => {
                    const amount = row.rate === null ? null : Math.round((SAMPLE * row.rate) / 100);
                    return (
                      <tr key={row.key}>
                        <th scope="row" className="px-card py-comfortable text-left font-medium text-fg">
                          {row.label}
                          <span className="ml-tight font-normal text-muted">{row.rate === null ? "—" : `${row.rate}%`}</span>
                        </th>
                        <td className="px-section py-comfortable text-right text-muted">{formatMoney(SAMPLE, currency)}</td>
                        <td className="px-section py-comfortable text-right text-muted">{amount === null ? "—" : formatMoney(amount, currency)}</td>
                        <td className="px-card py-comfortable text-right font-semibold text-fg">
                          {amount === null ? "—" : formatMoney(SAMPLE + amount, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SettingsSection>

          <SettingsSection title={t("tax.registrationTitle")} description={t("tax.registrationDesc")}>
            <SettingRow label={t("tax.name")} description={t("tax.nameDesc")}>
              {({ id, describedBy }) => (
                <input id={id} value={form.name} onChange={(e) => set("name", e.target.value)} aria-describedby={describedBy} className={controlCls()} />
              )}
            </SettingRow>
            <SettingRow label={t("tax.regNumber")} description={t("tax.regNumberDesc")}>
              {({ id, describedBy }) => (
                <input id={id} value={form.reg} onChange={(e) => set("reg", e.target.value)} aria-describedby={describedBy} className={controlCls()} />
              )}
            </SettingRow>
            <SettingRow
              label={t("tax.onReceipts")}
              description={
                hasReg
                  ? t("tax.onReceiptsDesc", { line: tt("taxReg", { name: form.name.trim() || "VAT", number: form.reg.trim() }) })
                  : t("tax.onReceiptsNeedsNumber")
              }
              labelFor={false}
            >
              {({ labelId, describedBy }) => (
                <div className="flex sm:justify-end">
                  <Switch
                    checked={form.onReceipts && hasReg}
                    disabled={!hasReg}
                    onChange={(on) => set("onReceipts", on)}
                    labelledBy={labelId}
                    describedBy={describedBy}
                  />
                </div>
              )}
            </SettingRow>
          </SettingsSection>

          <SaveBar dirty={dirty} saving={saving} invalid={standard === null || reduced === null} onSave={save} onDiscard={() => setDraft(null)} />
        </div>
      )}
    </PageShell>
  );
}
