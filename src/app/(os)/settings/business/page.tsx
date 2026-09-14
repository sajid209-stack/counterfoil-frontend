"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PageShell, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, updateOperator, type Operator } from "@/lib/api";
import { SaveBar, SectionSkeleton, SettingRow, SettingsSection, SuffixInput, controlCls } from "../_components/SettingsKit";

const CURRENCIES = ["BDT", "MYR", "USD", "CAD"];
const TIMEZONES = ["Asia/Dhaka", "Asia/Kuala_Lumpur", "America/New_York", "America/Toronto"];

interface Draft {
  name: string;
  currency: string;
  timezone: string;
  lockDays: string;
}

const toDraft = (op: Operator): Draft => ({
  name: op.name,
  currency: op.currency,
  timezone: op.defaultTimezone,
  lockDays: op.pastEditLockDays == null ? "" : String(op.pastEditLockDays),
});

/** "GMT+6". The offset is what an operator actually checks a zone against. */
function offsetOf(zone: string): string {
  try {
    return (
      new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" })
        .formatToParts(new Date())
        .find((part) => part.type === "timeZoneName")?.value ?? ""
    );
  } catch {
    return "";
  }
}

/** "BDT — Bangladeshi Taka", in the reader's own language. A code alone is a quiz. */
function currencyName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "·"
  );
}

/**
 * The business's profile — and only the business's.
 *
 * Four things came out of this page, each because it was not the business's
 * profile: the tax rate (now Settings → Tax, the one place the till reads it
 * from), the SMS template (Settings → Ticket messages), and appearance and
 * language (Settings → Preferences, because they are per person and per
 * browser). What is left is what somebody opens this page to change.
 */
export default function BusinessProfilePage() {
  const t = useTranslations("settings");
  const locale = useLocale();
  const toast = useToast();
  const opQ = useApiQuery(() => getOperator(), []);

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
  const lockErr = form && form.lockDays.trim() !== "" && !/^\d{1,4}$/.test(form.lockDays.trim()) ? t("business.lockInvalid") : undefined;

  const save = async () => {
    if (!form || nameErr || lockErr) return;
    setSaving(true);
    // A patch of exactly the fields this page owns, so saving the profile can
    // never overwrite a tax rate or a message somebody changed on another page.
    const res = await updateOperator({
      name: form.name.trim(),
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
            {/* Not a dashed drop zone. The old one looked like a place to drop
                a file and did nothing when you did — here the row says plainly
                that upload is coming, and shows what stands in until then. */}
            <SettingRow label={t("business.logo")} description={t("business.logoDesc")} labelFor={false}>
              {() => (
                <div className="flex h-11 items-center gap-comfortable">
                  <span
                    aria-hidden
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-line bg-subtle text-sm font-semibold text-fg"
                  >
                    {initials(form.name)}
                  </span>
                  <span className="text-[13px] text-muted">{t("business.logoPending")}</span>
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
                  {TIMEZONES.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replace(/_/g, " ")} ({offsetOf(zone)})
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

          <SaveBar dirty={dirty} saving={saving} invalid={!!nameErr || !!lockErr} onSave={save} onDiscard={() => setDraft(null)} />
        </div>
      )}
    </PageShell>
  );
}
