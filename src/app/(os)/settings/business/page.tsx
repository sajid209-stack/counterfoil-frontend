"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PageShell, useToast } from "@/components/ui";
import { ReceiptFooter, ReceiptHeader } from "@/components/ReceiptParts";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getTaxConfig, listLocations, updateOperator, type Operator } from "@/lib/api";
import { DEMO_TODAY } from "@/lib/schedule";
import { formatDay } from "@/lib/format";
import { SaveBar, SectionSkeleton, SettingRow, SettingsSection, SuffixInput, controlCls } from "../_components/SettingsKit";
import { TIMEZONES, zoneLabel } from "../_lib/zones";

const CURRENCIES = ["BDT", "MYR", "USD", "CAD"];
const FOOTER_MAX = 160;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^\+?[\d\s()-]{6,20}$/;
const WEBSITE = /^(https?:\/\/)?[^\s/]+\.[^\s]{2,}$/i;

interface Draft {
  name: string;
  phone: string;
  email: string;
  website: string;
  footer: string;
  currency: string;
  timezone: string;
  lockDays: string;
}

const toDraft = (op: Operator): Draft => ({
  name: op.name,
  phone: op.contactPhone ?? "",
  email: op.contactEmail ?? "",
  website: op.website ?? "",
  footer: op.receiptFooter ?? "",
  currency: op.currency,
  timezone: op.defaultTimezone,
  lockDays: op.pastEditLockDays == null ? "" : String(op.pastEditLockDays),
});

/** "BDT — Bangladeshi Taka", in the reader's own language. A code alone is a quiz. */
function currencyName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** An optional field: empty is fine, anything else has to look like the thing. */
const optional = (value: string, pattern: RegExp) => value.trim() === "" || pattern.test(value.trim());

/**
 * The business's profile — and only the business's.
 *
 * Four things came out of this page, each because it was not the business's
 * profile: the tax rate (now Settings → Tax, the one place the till reads it
 * from), the SMS template (Settings → Notifications), and appearance and
 * language (Settings → Preferences, because they are per person and per
 * browser). What is left is what somebody opens this page to change.
 *
 * What it gained is what a customer holding a receipt needs: a number to call,
 * a website, and the line under the total where a business says how returns
 * work or when it opens. The receipt is drawn beside the fields with the same
 * parts the printed one uses, so a footer is read as a customer will read it
 * before anyone prints one.
 *
 * The Logo row came out too. It could not be used — it said "Coming soon" beside
 * the business's initials — and a row with nothing to do is a row somebody reads
 * for nothing. It returns when upload exists.
 */
export default function BusinessProfilePage() {
  const t = useTranslations("settings");
  const locale = useLocale();
  const toast = useToast();
  const opQ = useApiQuery(() => getOperator(), []);
  const taxQ = useApiQuery(() => getTaxConfig(), []);
  const locQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);

  const [base, setBase] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const saved = base ?? (opQ.data ? toDraft(opQ.data) : null);
  const form = draft ?? saved;
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    if (form) setDraft({ ...form, [key]: value });
  };

  const nameErr = form && !form.name.trim() ? t("business.nameRequired") : undefined;
  const phoneErr = form && !optional(form.phone, PHONE) ? t("business.phoneInvalid") : undefined;
  const emailErr = form && !optional(form.email, EMAIL) ? t("business.emailInvalid") : undefined;
  const websiteErr = form && !optional(form.website, WEBSITE) ? t("business.websiteInvalid") : undefined;
  const lockErr = form && form.lockDays.trim() !== "" && !/^\d{1,4}$/.test(form.lockDays.trim()) ? t("business.lockInvalid") : undefined;
  const invalid = !!(nameErr || phoneErr || emailErr || websiteErr || lockErr);
  const zones = form && !TIMEZONES.includes(form.timezone) ? [form.timezone, ...TIMEZONES] : TIMEZONES;
  // The preview prints the first venue that sells, standing in for "wherever
  // the sale is made".
  const place = [...(locQ.data?.data ?? [])].filter((l) => l.status === "active").sort((a, b) => a.name.localeCompare(b.name))[0] ?? null;

  const save = async () => {
    if (!form || invalid) return;
    setSaving(true);
    // A patch of exactly the fields this page owns, so saving the profile can
    // never overwrite a tax rate or a message somebody changed on another page.
    const res = await updateOperator({
      name: form.name.trim(),
      contactPhone: form.phone.trim() || undefined,
      contactEmail: form.email.trim() || undefined,
      website: form.website.trim() || undefined,
      receiptFooter: form.footer.trim() || undefined,
      currency: form.currency,
      defaultTimezone: form.timezone,
      pastEditLockDays: form.lockDays.trim() === "" ? null : Number(form.lockDays),
    });
    setSaving(false);
    if (res.ok) {
      setBase(toDraft(res.data));
      setDraft(null);
      toast.success(t("business.saved"));
    } else {
      toast.error(res.error.message);
    }
  };

  const textInput = (key: "phone" | "email" | "website", error: string | undefined, type: string, autoComplete: string) =>
    function Field({ id, describedBy }: { id: string; describedBy?: string }) {
      return (
        <input
          id={id}
          type={type}
          value={form?.[key] ?? ""}
          onChange={(e) => set(key, e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          className={controlCls(!!error)}
        />
      );
    };

  return (
    <PageShell title={t("business.title")} description={t("business.description")}>
      {!form ? (
        <SectionSkeleton />
      ) : (
        <div className="flex max-w-3xl flex-col gap-section pb-hero">
          <SettingsSection title={t("business.profileTitle")} description={t("business.profileDesc")}>
            <SettingRow label={t("business.businessName")} description={t("business.nameDesc")} error={nameErr}>
              {({ id, describedBy }) => (
                <input
                  id={id}
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  autoComplete="organization"
                  aria-invalid={!!nameErr || undefined}
                  aria-describedby={describedBy}
                  className={controlCls(!!nameErr)}
                />
              )}
            </SettingRow>
            <SettingRow label={t("business.phone")} description={t("business.phoneDesc")} error={phoneErr}>
              {textInput("phone", phoneErr, "tel", "tel")}
            </SettingRow>
            <SettingRow label={t("business.email")} description={t("business.emailDesc")} error={emailErr}>
              {textInput("email", emailErr, "email", "email")}
            </SettingRow>
            <SettingRow label={t("business.website")} description={t("business.websiteDesc")} error={websiteErr}>
              {textInput("website", websiteErr, "url", "url")}
            </SettingRow>
          </SettingsSection>

          <SettingsSection title={t("business.receiptsTitle")} description={t("business.receiptsDesc")}>
            <SettingRow label={t("business.footer")} description={t("business.footerDesc")} layout="stack">
              {({ id, describedBy }) => (
                <>
                  <textarea
                    id={id}
                    rows={3}
                    maxLength={FOOTER_MAX}
                    value={form.footer}
                    onChange={(e) => set("footer", e.target.value)}
                    aria-describedby={describedBy}
                    className="w-full min-w-0 resize-y rounded-sm border border-line bg-card px-comfortable py-tight text-sm leading-relaxed text-fg outline-none transition-colors duration-quick focus:border-ember focus:ring-2 focus:ring-ember/20"
                  />
                  <p aria-hidden className="mt-inline text-right text-[12px] tabular-nums text-muted">
                    {form.footer.length}/{FOOTER_MAX}
                  </p>
                </>
              )}
            </SettingRow>
            <SettingRow label={t("business.receiptPreview")} description={t("business.receiptPreviewDesc")} layout="stack" labelFor={false}>
              {() => (
                <div className="max-w-xs rounded-sm bg-card px-section py-major ring-1 ring-inset ring-hairline">
                  <ReceiptHeader
                    operator={{ name: form.name.trim() || "—", contactPhone: form.phone.trim(), website: form.website.trim() }}
                    place={place}
                    tax={taxQ.data}
                  >
                    <p className="mt-inline font-mono text-[12px] text-muted">CF-2026-000123 · {formatDay(DEMO_TODAY)}</p>
                  </ReceiptHeader>
                  <p className="border-y border-dashed border-line py-section text-center text-[12px] text-muted">{t("business.receiptItems")}</p>
                  <ReceiptFooter message={form.footer} />
                </div>
              )}
            </SettingRow>
          </SettingsSection>

          <SettingsSection title={t("business.regionalTitle")} description={t("business.regionalDesc")}>
            <SettingRow label={t("business.currency")} description={t("business.currencyDesc")}>
              {({ id, describedBy }) => (
                <select id={id} value={form.currency} onChange={(e) => set("currency", e.target.value)} aria-describedby={describedBy} className={cn(controlCls(), "pr-section")}>
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code} — {currencyName(code, locale)}
                    </option>
                  ))}
                </select>
              )}
            </SettingRow>
            <SettingRow label={t("common.timezone")} description={t("business.timezoneDesc")}>
              {({ id, describedBy }) => (
                <select id={id} value={form.timezone} onChange={(e) => set("timezone", e.target.value)} aria-describedby={describedBy} className={cn(controlCls(), "pr-section")}>
                  {zones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zoneLabel(zone)}
                    </option>
                  ))}
                </select>
              )}
            </SettingRow>
          </SettingsSection>

          <SettingsSection title={t("business.historyTitle")} description={t("business.historyDesc")}>
            <SettingRow label={t("business.pastEditLock")} description={t("business.pastEditLockHelp")} error={lockErr}>
              {({ id, describedBy }) => (
                <SuffixInput
                  id={id}
                  value={form.lockDays}
                  onChange={(v) => set("lockDays", v)}
                  suffix={t("business.days")}
                  placeholder={t("business.lockPlaceholder")}
                  invalid={!!lockErr}
                  describedBy={describedBy}
                  inputMode="numeric"
                />
              )}
            </SettingRow>
          </SettingsSection>

          <SaveBar dirty={dirty} saving={saving} invalid={invalid} onSave={save} onDiscard={() => setDraft(null)} />
        </div>
      )}
    </PageShell>
  );
}
