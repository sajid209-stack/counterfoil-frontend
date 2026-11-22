"use client";

import { Building2, Clock, Coins, Globe, ImagePlus, Lock, Mail, MessageSquareText, Phone, Printer, QrCode, ReceiptText, Ruler, ScanLine, Trash2, UserRound, UsersRound } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button, PageShell, SegmentedControl, Select, Switch, controlClass, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getTaxConfig, listLocations, updateOperator, type Operator } from "@/lib/api";
import type { ReceiptSettings } from "@/lib/api/types";
import { DEMO_TODAY } from "@/lib/schedule";
import { fileToStoredImage } from "@/lib/imageUpload";
import { receiptSettingsOf } from "@/lib/receipt";
import { buildSampleOrder } from "@/components/receipt/sample";
import { ReceiptSheet } from "@/app/print/_components/ReceiptSheet";
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
  /** A stored image (data URL) or a path; null = no logo. */
  logo: string | null;
  receipt: ReceiptSettings;
}

const toDraft = (op: Operator): Draft => ({
  logo: op.logo ?? null,
  receipt: receiptSettingsOf(op),
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

  const setReceipt = <K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) => {
    if (form) setDraft({ ...form, receipt: { ...form.receipt, [key]: value } });
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState(false);
  // SVG stays a vector (a canvas would flatten it to pixels); everything else is shrunk to a JPEG that fits in the browser's storage.
  const onLogoFile = async (file: File | undefined) => {
    if (!file || !form) return;
    setLogoError(false);
    try {
      const url =
        file.type === "image/svg+xml"
          ? await new Promise<string>((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => resolve(String(r.result));
              r.onerror = () => reject(r.error);
              r.readAsDataURL(file);
            })
          : await fileToStoredImage(file, 600, 0.92);
      set("logo", url);
    } catch {
      setLogoError(true);
    }
  };
  const sample = useMemo(
    () =>
      buildSampleOrder(
        { product: t("business.sampleProduct"), adult: t("business.sampleAdult"), permit: t("business.samplePhoto"), customer: t("business.sampleCustomer") },
        DEMO_TODAY,
      ),
    [t],
  );
  const initials = (form?.name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "—";

  const nameErr = form && !form.name.trim() ? t("business.nameRequired") : undefined;
  const phoneErr = form && !optional(form.phone, PHONE) ? t("business.phoneInvalid") : undefined;
  const emailErr = form && !optional(form.email, EMAIL) ? t("business.emailInvalid") : undefined;
  const websiteErr = form && !optional(form.website, WEBSITE) ? t("business.websiteInvalid") : undefined;
  const lockErr = form && form.lockDays.trim() !== "" && !/^\d{1,4}$/.test(form.lockDays.trim()) ? t("business.lockInvalid") : undefined;
  const invalid = !!(nameErr || phoneErr || emailErr || websiteErr || lockErr);
  // The help under the lock says what the number means right now, not what the
  // field is for in general.
  const lockDays = form && /^\d{1,4}$/.test(form.lockDays.trim()) ? Number(form.lockDays.trim()) : null;
  const lockHelp = !form || form.lockDays.trim() === ""
    ? t("business.pastEditLockOff")
    : lockDays !== null
      ? t("business.pastEditLockOn", { days: lockDays })
      : t("business.pastEditLockHelp");
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
      logo: form.logo,
      receipt: form.receipt,
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

  // Each contact field shows a real example, so "what goes here?" is answered
  // before anyone types.
  const textInput = (key: "phone" | "email" | "website", error: string | undefined, type: string, autoComplete: string) =>
    function Field({ id, describedBy }: { id: string; describedBy?: string }) {
      return (
        <input
          id={id}
          type={type}
          value={form?.[key] ?? ""}
          onChange={(e) => set(key, e.target.value)}
          autoComplete={autoComplete}
          placeholder={t(`business.${key}Placeholder`)}
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
        <div className="flex flex-col gap-section pb-hero">
          <SettingsSection title={t("business.profileTitle")} description={t("business.profileDesc")}>
            <SettingRow icon={Building2} label={t("business.businessName")} error={nameErr}>
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
            <SettingRow icon={Phone} label={t("business.phone")} description={t("business.phoneDesc")} error={phoneErr}>
              {textInput("phone", phoneErr, "tel", "tel")}
            </SettingRow>
            <SettingRow icon={Mail} label={t("business.email")} error={emailErr}>
              {textInput("email", emailErr, "email", "email")}
            </SettingRow>
            <SettingRow icon={Globe} label={t("business.website")} description={t("business.websiteDesc")} error={websiteErr}>
              {textInput("website", websiteErr, "url", "url")}
            </SettingRow>
          </SettingsSection>

          <SettingsSection title={t("business.receiptsTitle")} description={t("business.receiptsDesc")}>
            <SettingRow icon={ImagePlus} label={t("business.logoLabel")} description={t("business.logoDesc")} layout="stack" labelFor={false} error={logoError ? t("business.logoError") : undefined}>
              {() => (
                <div className="flex flex-wrap items-center gap-section">
                  <div className={cn("flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-control border bg-card p-tight", form.logo ? "border-line" : "border-dashed border-strong")}>
                    {form.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a stored data URL or a path
                      <img src={form.logo} alt={form.name} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span aria-hidden className="text-xl font-semibold text-muted">{initials}</span>
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="sr-only"
                    tabIndex={-1}
                    aria-label={t("business.logoUpload")}
                    onChange={(e) => {
                      void onLogoFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <div className="flex flex-wrap gap-tight">
                    <Button variant="secondary" icon={<ImagePlus size={16} strokeWidth={1.5} />} onClick={() => fileRef.current?.click()}>
                      {form.logo ? t("business.logoReplace") : t("business.logoUpload")}
                    </Button>
                    {form.logo && (
                      <Button variant="tertiary" icon={<Trash2 size={16} strokeWidth={1.5} />} onClick={() => set("logo", null)}>
                        {t("business.logoRemove")}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </SettingRow>
            <SettingRow icon={Printer} label={t("business.showLogo")} description={t("business.showLogoDesc")} trailing>
              {({ id, describedBy }) => <Switch id={id} describedBy={describedBy} aria-label={t("business.showLogo")} checked={form.receipt.showLogo} onChange={(v) => setReceipt("showLogo", v)} />}
            </SettingRow>
            <SettingRow icon={Ruler} label={t("business.logoSize")} labelFor={false}>
              {() => (
                <SegmentedControl
                  aria-label={t("business.logoSize")}
                  value={form.receipt.logoSize}
                  onChange={(v) => setReceipt("logoSize", v as ReceiptSettings["logoSize"])}
                  options={[
                    { value: "small", label: t("business.sizeSmall") },
                    { value: "medium", label: t("business.sizeMedium") },
                    { value: "large", label: t("business.sizeLarge") },
                  ]}
                />
              )}
            </SettingRow>
            <SettingRow icon={ScanLine} label={t("business.paper")} description={t("business.paperDesc")}>
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  value={form.receipt.paper}
                  onChange={(v) => setReceipt("paper", v as ReceiptSettings["paper"])}
                  aria-describedby={describedBy}
                  options={[
                    { value: "80mm", label: t("business.paper80") },
                    { value: "58mm", label: t("business.paper58") },
                    { value: "a4", label: t("business.paperA4") },
                  ]}
                />
              )}
            </SettingRow>
            <SettingRow icon={UsersRound} label={t("business.showCashier")} description={t("business.showCashierDesc")} trailing>
              {({ id, describedBy }) => <Switch id={id} describedBy={describedBy} aria-label={t("business.showCashier")} checked={form.receipt.showCashier} onChange={(v) => setReceipt("showCashier", v)} />}
            </SettingRow>
            <SettingRow icon={UserRound} label={t("business.showCustomer")} description={t("business.showCustomerDesc")} trailing>
              {({ id, describedBy }) => <Switch id={id} describedBy={describedBy} aria-label={t("business.showCustomer")} checked={form.receipt.showCustomer} onChange={(v) => setReceipt("showCustomer", v)} />}
            </SettingRow>
            <SettingRow icon={QrCode} label={t("business.showQr")} description={t("business.showQrDesc")} trailing>
              {({ id, describedBy }) => <Switch id={id} describedBy={describedBy} aria-label={t("business.showQr")} checked={form.receipt.showLookupQr} onChange={(v) => setReceipt("showLookupQr", v)} />}
            </SettingRow>
            <SettingRow icon={MessageSquareText} label={t("business.footer")} description={t("business.footerDesc")} layout="stack">
              {({ id, describedBy }) => (
                <>
                  <textarea
                    id={id}
                    rows={3}
                    maxLength={FOOTER_MAX}
                    placeholder={t("business.footerPlaceholder")}
                    value={form.footer}
                    onChange={(e) => set("footer", e.target.value)}
                    aria-describedby={describedBy}
                    className={cn(controlClass(false, true), "resize-y leading-relaxed")}
                  />
                  <p aria-hidden className="mt-inline text-right text-xs tabular-nums text-muted">
                    {form.footer.length}/{FOOTER_MAX}
                  </p>
                </>
              )}
            </SettingRow>
            <SettingRow icon={ReceiptText} label={t("business.receiptPreview")} description={t("business.receiptPreviewDesc")} layout="stack" labelFor={false}>
              {() => (
                <div className="overflow-x-auto rounded-control bg-muted-wash px-section py-major">
                  {/* The real receipt, not a drawing of one. A4 is 210 mm wide, so it is shown at half size. */}
                  <div style={form.receipt.paper === "a4" ? { zoom: 0.5 } : undefined}>
                    <ReceiptSheet
                      printStyle={false}
                      data={{
                        order: sample,
                        operator: {
                          name: form.name.trim() || "—",
                          contactPhone: form.phone.trim(),
                          website: form.website.trim(),
                          logo: form.logo,
                          receiptFooter: form.footer.trim(),
                        },
                        place,
                        tax: taxQ.data,
                        settings: form.receipt,
                        cashier: t("business.sampleStaff"),
                        counter: t("business.sampleCounter"),
                        customerPhone: "01712-345678",
                      }}
                    />
                  </div>
                </div>
              )}
            </SettingRow>
          </SettingsSection>

          <SettingsSection title={t("business.regionalTitle")} description={t("business.regionalDesc")}>
            <SettingRow icon={Coins} label={t("business.currency")} description={t("business.currencyDesc")}>
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  value={form.currency}
                  onChange={(v) => set("currency", v)}
                  aria-describedby={describedBy}
                  options={CURRENCIES.map((code) => ({ value: code, label: `${code} — ${currencyName(code, locale)}` }))}
                />
              )}
            </SettingRow>
            <SettingRow icon={Clock} label={t("common.timezone")} description={t("business.timezoneDesc")}>
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  value={form.timezone}
                  onChange={(v) => set("timezone", v)}
                  aria-describedby={describedBy}
                  options={zones.map((zone) => ({ value: zone, label: zoneLabel(zone) }))}
                />
              )}
            </SettingRow>
          </SettingsSection>

          <SettingsSection title={t("business.historyTitle")} description={t("business.historyDesc")}>
            <SettingRow icon={Lock} label={t("business.pastEditLock")} description={lockHelp} error={lockErr}>
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
