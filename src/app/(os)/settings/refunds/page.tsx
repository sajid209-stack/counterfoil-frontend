"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Banknote, CalendarClock, Clock, HandCoins, Hourglass, UserCog } from "lucide-react";
import { PageShell, RadioGroup, Select, useToast } from "@/components/ui";
import {
  AUTO_CLOSE_DAYS,
  REFUND_METHODS,
  REFUND_WINDOWS,
  RESPOND_WITHIN_HOURS,
  getRefundPolicy,
  updateRefundPolicy,
  type RefundMethod,
  type RefundPolicy,
  type RefundWindow,
} from "@/lib/api/refundPolicy";
import { useApiQuery } from "@/lib/useApi";
import { formatMoney } from "@/lib/format";
import { SaveBar, SectionSkeleton, SettingRow, SettingsSection, SuffixInput } from "../_components/SettingsKit";

interface Draft {
  counterWindow: RefundWindow;
  respondWithinHours: number;
  /** "wait" or a number of days as text. */
  autoClose: string;
  refundTo: RefundMethod;
  /** Whole taka as typed. */
  writeOffAbove: string;
}

const AMOUNT = /^\d{1,7}$/;

const toDraft = (p: RefundPolicy): Draft => ({
  counterWindow: p.counterWindow,
  respondWithinHours: p.respondWithinHours,
  autoClose: p.autoCloseDays === null ? "wait" : String(p.autoCloseDays),
  refundTo: p.refundTo,
  writeOffAbove: String(p.writeOffApproveAbove / 100),
});

/**
 * Settings → Refunds & write-offs: the business's timing rules (docs/refunds.md §3).
 * Who may ask or act directly is per role, under Roles → At the counter.
 */
export default function RefundsSettingsPage() {
  const t = useTranslations("settings");
  const toast = useToast();
  const q = useApiQuery(() => getRefundPolicy(), []);
  const [base, setBase] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const saved = base ?? (q.data ? toDraft(q.data) : null);
  const form = draft ?? saved;
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch: Partial<Draft>) => {
    if (!form) return;
    setDraft({ ...form, ...patch });
    setServerErrors({});
  };

  const amountMinor = form && AMOUNT.test(form.writeOffAbove.trim()) ? Number(form.writeOffAbove.trim()) * 100 : null;
  const amountErr = form && amountMinor === null ? t("refunds.amountInvalid") : serverErrors.writeOffApproveAbove;

  const save = async () => {
    if (!form || amountMinor === null) return;
    setSaving(true);
    const res = await updateRefundPolicy({
      counterWindow: form.counterWindow,
      respondWithinHours: form.respondWithinHours,
      autoCloseDays: form.autoClose === "wait" ? null : Number(form.autoClose),
      refundTo: form.refundTo,
      writeOffApproveAbove: amountMinor,
    });
    setSaving(false);
    if (res.ok) {
      setBase(toDraft(res.data));
      setDraft(null);
      setServerErrors({});
      toast.success(t("refunds.saved"));
    } else {
      setServerErrors(res.error.fieldErrors ?? {});
      toast.error(res.error.message);
    }
  };

  return (
    <PageShell title={t("refunds.title")} description={t("refunds.description")}>
      {!form ? (
        <SectionSkeleton />
      ) : (
        <div className="flex flex-col gap-section pb-hero">
          <SettingsSection title={t("refunds.sectionRefund")} description={t("refunds.sectionRefundDesc")}>
            <SettingRow
              icon={CalendarClock}
              label={t("refunds.window")}
              description={t(`refunds.windowHelp_${form.counterWindow}`)}
              layout="stack"
              labelFor={false}
            >
              {({ labelId }) => (
                <RadioGroup
                  aria-labelledby={labelId}
                  value={form.counterWindow}
                  onChange={(v) => set({ counterWindow: v as RefundWindow })}
                  options={REFUND_WINDOWS.map((w) => ({ value: w, label: t(`refunds.window_${w}`) }))}
                />
              )}
            </SettingRow>
            <SettingRow icon={Clock} label={t("refunds.respond")} description={t("refunds.respondHelp")} error={serverErrors.respondWithinHours}>
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  value={String(form.respondWithinHours)}
                  onChange={(v) => set({ respondWithinHours: Number(v) })}
                  aria-describedby={describedBy}
                  options={RESPOND_WITHIN_HOURS.map((h) => ({ value: String(h), label: t("refunds.respondHours", { hours: h }) }))}
                />
              )}
            </SettingRow>
            <SettingRow
              icon={Hourglass}
              label={t("refunds.noAnswer")}
              description={form.autoClose === "wait" ? t("refunds.noAnswerHelp_wait") : t("refunds.noAnswerHelp_close", { days: form.autoClose })}
              error={serverErrors.autoCloseDays}
            >
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  value={form.autoClose}
                  onChange={(v) => set({ autoClose: v })}
                  aria-describedby={describedBy}
                  options={[
                    { value: "wait", label: t("refunds.keepWaiting") },
                    ...AUTO_CLOSE_DAYS.map((d) => ({ value: String(d), label: t("refunds.closeAfter", { days: d }) })),
                  ]}
                />
              )}
            </SettingRow>
            <SettingRow
              icon={Banknote}
              label={t("refunds.refundTo")}
              description={t(`refunds.refundToHelp_${form.refundTo}`)}
              layout="stack"
              labelFor={false}
            >
              {({ labelId }) => (
                <RadioGroup
                  aria-labelledby={labelId}
                  value={form.refundTo}
                  onChange={(v) => set({ refundTo: v as RefundMethod })}
                  options={REFUND_METHODS.map((m) => ({ value: m, label: t(`refunds.refundTo_${m}`) }))}
                />
              )}
            </SettingRow>
          </SettingsSection>

          <SettingsSection title={t("refunds.sectionWriteOff")} description={t("refunds.sectionWriteOffDesc")}>
            <SettingRow
              icon={HandCoins}
              label={t("refunds.writeOffAbove")}
              description={
                !amountMinor ? t("refunds.writeOffHelp_zero") : t("refunds.writeOffHelp_some", { amount: formatMoney(amountMinor) })
              }
              error={amountErr}
            >
              {({ id, describedBy }) => (
                <SuffixInput
                  id={id}
                  value={form.writeOffAbove}
                  onChange={(v) => set({ writeOffAbove: v })}
                  suffix="৳"
                  inputMode="numeric"
                  invalid={!!amountErr}
                  describedBy={describedBy}
                />
              )}
            </SettingRow>
            <SettingRow icon={UserCog} label={t("refunds.who")} description={t("refunds.whoHelp")} labelFor={false}>
              {() => (
                <Link
                  href="/settings/roles"
                  className="inline-flex min-h-11 items-center gap-tight text-base font-medium text-brand-foreground underline-offset-4 hover:underline md:min-h-9"
                >
                  {t("refunds.whoLink")}
                  <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
                </Link>
              )}
            </SettingRow>
          </SettingsSection>

          <SaveBar
            dirty={dirty}
            saving={saving}
            invalid={amountMinor === null}
            onSave={save}
            onDiscard={() => {
              setDraft(null);
              setServerErrors({});
            }}
          />
        </div>
      )}
    </PageShell>
  );
}
