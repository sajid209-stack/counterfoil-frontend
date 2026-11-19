"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageShell, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getPayNowSettings, listProducts, updatePayNowSettings } from "@/lib/api";
import { currencySymbol } from "@/lib/region";
import { SaveBar, SectionSkeleton, SettingsSection } from "../_components/SettingsKit";
import { BookingRules } from "./_components/BookingRules";
import { RuleEditor } from "./_components/RuleEditor";
import { isValid, toDraft, toRule, type RuleDraft } from "./_components/ruleDraft";

/**
 * Payment choices — what a customer may pay now when they book for later.
 *
 * One question, answered in two places: a business default, and a rule per
 * booking that wants its own. It replaces the booking's old deposit policy and
 * the business advance rule, which answered the same thing separately.
 */
export default function PaymentChoicesPage() {
  const t = useTranslations("moneysetup.payNow");
  const toast = useToast();

  const settingsQ = useApiQuery(() => getPayNowSettings(), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 500, filters: { status: "active" } }), []);
  const opQ = useApiQuery(() => getOperator(), []);

  const [base, setBase] = useState<RuleDraft | null>(null);
  const [draft, setDraft] = useState<RuleDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const currency = opQ.data?.currency ?? "BDT";
  const symbol = currencySymbol(currency);
  const defaultRule = settingsQ.data?.default;

  const saved = base ?? (defaultRule ? toDraft(defaultRule) : null);
  const form = draft ?? saved;

  if (!form || !saved || !defaultRule) {
    return (
      <PageShell title={t("title")} description={t("description")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  const invalid = !isValid(form);

  const save = async () => {
    const rule = toRule(form, defaultRule);
    if (!rule) return;
    setSaving(true);
    const res = await updatePayNowSettings({ default: rule });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setBase(toDraft(res.data.default));
    setDraft(null);
    toast.success(t("saved"));
    settingsQ.reload();
  };

  // The catalog only: shop items are inventory, not bookings, and carry no rule.
  const products = (productsQ.data?.data ?? []).filter((p) => p.status === "active" && !p.archivedAt);

  return (
    <PageShell title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-section pb-hero">
        <SettingsSection title={t("default.title")} description={t("default.description")}>
          <div className="px-card pb-card">
            <RuleEditor draft={form} onChange={setDraft} currency={currency} symbol={symbol} name="pay-now-default" />
          </div>
        </SettingsSection>

        {productsQ.data ? (
          <BookingRules products={products} defaultRule={defaultRule} currency={currency} symbol={symbol} onSaved={productsQ.reload} />
        ) : (
          <SectionSkeleton />
        )}

        <SaveBar dirty={dirty} saving={saving} invalid={invalid} onSave={save} onDiscard={() => setDraft(null)} />
      </div>
    </PageShell>
  );
}
