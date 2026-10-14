"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { Button, PageShell, controlClass, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import {
  COUNTERFOIL_PRIVACY_URL,
  COUNTERFOIL_TERMS_URL,
  defaultPrivacyPolicy,
  getOperator,
  getPrivacySettings,
  updatePrivacySettings,
} from "@/lib/api";
import type { PrivacySettings } from "@/lib/api";
import { formatDay } from "@/lib/format";
import { storefrontVars } from "@/lib/storefront/theme";
import { PolicyText } from "@/app/s/[slug]/privacy/PolicyText";
import { SaveBar, SectionSkeleton, SettingRow, SettingsSection, Switch, controlCls } from "../_components/SettingsKit";

/** The parts a person edits. `updatedOn` is the api's to set when the wording changes. */
type Draft = Omit<PrivacySettings, "updatedOn">;

const toDraft = (p: PrivacySettings): Draft => ({
  policy: p.policy,
  contactEmail: p.contactEmail,
  contactPhone: p.contactPhone,
  showInFooter: p.showInFooter,
  showAtCheckout: p.showAtCheckout,
  showOnReceipts: p.showOnReceipts,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^01\d{9}$/;

const linkCls =
  "inline-flex min-h-11 items-center gap-tight text-base font-medium text-brand-foreground underline-offset-4 hover:underline md:min-h-9";

/**
 * Settings → Privacy policy.
 *
 * The venue's own policy, in its own words, and the places it shows: the
 * storefront footer and the checkout line both read this record, so switching
 * one on here is all it takes. The preview is the very component the public
 * page draws, in the storefront's own light theme.
 */
export default function PrivacyPage() {
  const t = useTranslations("settings");
  const toast = useToast();
  const q = useApiQuery(() => getPrivacySettings(), []);
  const opQ = useApiQuery(() => getOperator(), []);

  const [base, setBase] = useState<PrivacySettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const policyField = useRef<HTMLTextAreaElement>(null);

  const saved = base ?? q.data ?? null;
  const form = draft ?? (saved ? toDraft(saved) : null);
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(toDraft(saved));
  const set = (patch: Partial<Draft>) => {
    if (form) setDraft({ ...form, ...patch });
  };

  const email = form?.contactEmail.trim() ?? "";
  const phone = (form?.contactPhone ?? "").replace(/[\s-]/g, "");
  const anyLink = !!form && (form.showInFooter || form.showAtCheckout);
  const policyErr = form && anyLink && !form.policy.trim() ? t("privacy.policyEmpty") : undefined;
  const emailErr = email && !EMAIL_RE.test(email) ? t("privacy.emailInvalid") : undefined;
  const phoneErr = phone && !PHONE_RE.test(phone) ? t("privacy.phoneInvalid") : undefined;
  const contactErr = form && anyLink && !email && !phone ? t("privacy.contactNeeded") : undefined;
  const invalid = !!(policyErr || emailErr || phoneErr || contactErr);

  const business = opQ.data?.name || "us";
  const applyDefault = () => {
    if (!form) return;
    const contact = [email, phone].filter(Boolean).join(" or ") || business;
    set({ policy: defaultPrivacyPolicy(business, contact) });
    toast.success(t("privacy.defaultApplied"));
    policyField.current?.focus();
  };

  const save = async () => {
    if (!form || invalid) return;
    setSaving(true);
    const res = await updatePrivacySettings({
      ...form,
      contactEmail: email,
      contactPhone: phone,
      updatedOn: saved?.updatedOn ?? "",
    });
    setSaving(false);
    if (res.ok) {
      setBase(res.data);
      setDraft(null);
      toast.success(t("privacy.saved"));
    } else {
      toast.error(res.error.message);
    }
  };

  return (
    <PageShell title={t("privacy.title")} description={t("privacy.description")}>
      {!form || !saved ? (
        <SectionSkeleton />
      ) : (
        <div className="flex flex-col gap-section pb-hero">
          <SettingsSection title={t("privacy.policyTitle")} description={t("privacy.policyDesc")}>
            <SettingRow
              label={t("privacy.policyLabel")}
              description={t("privacy.policyHelp")}
              error={policyErr}
              layout="stack"
            >
              {({ id, describedBy }) => (
                <div className="flex flex-col gap-tight">
                  <textarea
                    ref={policyField}
                    id={id}
                    rows={16}
                    value={form.policy}
                    onChange={(e) => set({ policy: e.target.value })}
                    aria-invalid={!!policyErr || undefined}
                    aria-describedby={describedBy}
                    className={cn(controlClass(!!policyErr, true), "resize-y leading-relaxed")}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-tight">
                    <p className="text-sm text-muted">
                      {t("privacy.lastUpdated", { date: formatDay(saved.updatedOn) })}
                      {" · "}
                      {t("privacy.updatedNote")}
                    </p>
                    <Button variant="secondary" size="sm" onClick={applyDefault}>
                      {t("privacy.useDefault")}
                    </Button>
                  </div>
                </div>
              )}
            </SettingRow>
          </SettingsSection>

          <SettingsSection title={t("privacy.contactTitle")} description={t("privacy.contactDesc")}>
            <SettingRow label={t("privacy.email")} description={t("privacy.emailDesc")} error={emailErr ?? contactErr}>
              {({ id, describedBy }) => (
                <input
                  id={id}
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={form.contactEmail}
                  onChange={(e) => set({ contactEmail: e.target.value })}
                  aria-invalid={!!(emailErr ?? contactErr) || undefined}
                  aria-describedby={describedBy}
                  className={controlCls(!!(emailErr ?? contactErr))}
                />
              )}
            </SettingRow>
            <SettingRow label={t("privacy.phone")} description={t("privacy.phoneDesc")} error={phoneErr}>
              {({ id, describedBy }) => (
                <input
                  id={id}
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={form.contactPhone}
                  onChange={(e) => set({ contactPhone: e.target.value })}
                  aria-invalid={!!phoneErr || undefined}
                  aria-describedby={describedBy}
                  className={controlCls(!!phoneErr)}
                />
              )}
            </SettingRow>
          </SettingsSection>

          <SettingsSection title={t("privacy.showTitle")} description={t("privacy.showDesc")}>
            <SettingRow label={t("privacy.footer")} description={t("privacy.footerDesc")} labelFor={false} trailing>
              {({ labelId, describedBy }) => (
                <Switch checked={form.showInFooter} onChange={(on) => set({ showInFooter: on })} labelledBy={labelId} describedBy={describedBy} />
              )}
            </SettingRow>
            <SettingRow label={t("privacy.checkout")} description={t("privacy.checkoutDesc")} labelFor={false} trailing>
              {({ labelId, describedBy }) => (
                <Switch checked={form.showAtCheckout} onChange={(on) => set({ showAtCheckout: on })} labelledBy={labelId} describedBy={describedBy} />
              )}
            </SettingRow>
            <SettingRow label={t("privacy.receipts")} description={t("privacy.receiptsDesc")} labelFor={false} trailing>
              {({ labelId, describedBy }) => (
                <Switch checked={false} disabled onChange={() => {}} labelledBy={labelId} describedBy={describedBy} />
              )}
            </SettingRow>
          </SettingsSection>

          <SettingsSection title={t("privacy.counterfoilTitle")} description={t("privacy.counterfoilDesc")}>
            <div className="flex flex-col gap-inline px-card pb-comfortable">
              <a href={COUNTERFOIL_PRIVACY_URL} target="_blank" rel="noreferrer noopener" className={linkCls}>
                {t("privacy.counterfoilPrivacy")}
                <ExternalLink size={16} strokeWidth={1.75} aria-hidden />
              </a>
              <a href={COUNTERFOIL_TERMS_URL} target="_blank" rel="noreferrer noopener" className={linkCls}>
                {t("privacy.counterfoilTerms")}
                <ExternalLink size={16} strokeWidth={1.75} aria-hidden />
              </a>
            </div>
          </SettingsSection>

          <SettingsSection title={t("privacy.previewTitle")} description={t("privacy.previewDesc")}>
            <div className="px-card pb-comfortable">
              {/* The storefront's own light theme, so the owner sees the page as a customer will. */}
              <div className="sf rounded-card border border-line p-major" style={storefrontVars(null)}>
                <h3 className="text-2xl font-semibold tracking-title text-fg">{t("privacy.previewHeading")}</h3>
                <p className="mt-tight text-base text-muted">{t("privacy.lastUpdated", { date: formatDay(saved.updatedOn) })}</p>
                <div className="mt-major">
                  {form.policy.trim() ? (
                    <PolicyText text={form.policy} />
                  ) : (
                    <p className="text-md text-muted">{t("privacy.previewEmpty")}</p>
                  )}
                </div>
              </div>
            </div>
          </SettingsSection>

          <SaveBar dirty={dirty} saving={saving} invalid={invalid} onSave={save} onDiscard={() => setDraft(null)} />
        </div>
      )}
    </PageShell>
  );
}
