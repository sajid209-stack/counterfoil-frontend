"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AffixInput, Checkbox, SegmentedControl, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { formatMoney } from "@/lib/format";
import {
  createMembershipTier,
  listProducts,
  updateMembershipTier,
  type BillingPeriod,
  type MembershipDiscountScope,
  type MembershipTier,
  type MembershipTierInput,
} from "@/lib/api";
import { CreateBar, SaveBar, SettingRow, SettingsSection, Switch, controlCls } from "../../../settings/_components/SettingsKit";
import { PlanCard } from "./PlanCard";

const PERIODS: BillingPeriod[] = ["monthly", "quarterly", "annual", "lifetime"];

/** The form's own shape: everything a person types is text until it is saved. */
interface Draft {
  name: string;
  description: string;
  priceText: string;
  period: BillingPeriod;
  unlimited: boolean;
  visitsText: string;
  visitsScope: "every" | "some";
  includedProductIds: string[];
  discountText: string;
  discountScope: MembershipDiscountScope;
  discountProductIds: string[];
  group: boolean;
  maxText: string;
  guestText: string;
  autoRenew: boolean;
  noticeText: string;
}

const blank = (): Draft => ({
  name: "",
  description: "",
  priceText: "",
  period: "annual",
  unlimited: true,
  visitsText: "6",
  visitsScope: "every",
  includedProductIds: [],
  discountText: "0",
  discountScope: "all",
  discountProductIds: [],
  group: false,
  maxText: "4",
  guestText: "0",
  autoRenew: true,
  noticeText: "14",
});

const toDraft = (p: MembershipTier): Draft => ({
  name: p.name,
  description: p.description,
  priceText: p.price ? String(p.price / 100) : "",
  period: p.billingPeriod,
  unlimited: p.includedVisits == null,
  visitsText: String(p.includedVisits ?? 6),
  visitsScope: p.includedProductIds.length > 0 ? "some" : "every",
  includedProductIds: p.includedProductIds,
  discountText: String(p.discountBps / 100),
  discountScope: p.discountScope,
  discountProductIds: p.discountProductIds,
  group: p.maxMembers > 1,
  maxText: String(p.maxMembers > 1 ? p.maxMembers : 4),
  guestText: String(p.guestPassesPerPeriod),
  autoRenew: p.autoRenew,
  noticeText: String(p.renewalNoticeDays),
});

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
/** A number to draw while the field is half typed: empty or junk counts as 0. */
const soft = (s: string) => (Number.isFinite(num(s)) ? num(s) : 0);
const whole = (n: number) => Number.isInteger(n);

/** What is wrong with the draft, by field. Each message says what to do. */
function validate(d: Draft, tr: (k: string) => string): Partial<Record<keyof Draft, string>> {
  const e: Partial<Record<keyof Draft, string>> = {};
  if (!d.name.trim()) e.name = tr("name.nameRequired");
  const price = num(d.priceText);
  if (!(price >= 0) || (d.period !== "lifetime" && !(price > 0))) e.priceText = tr("price.invalid");
  if (!d.unlimited) {
    const v = num(d.visitsText);
    if (!whole(v) || v < 1) e.visitsText = tr("visits.invalid");
  }
  const pct = num(d.discountText);
  if (!(pct >= 0 && pct <= 100)) e.discountText = tr("discount.invalid");
  if (d.group) {
    const n = num(d.maxText);
    if (!whole(n) || n < 2 || n > 10) e.maxText = tr("covers.invalid");
  }
  const g = num(d.guestText);
  if (!whole(g) || g < 0) e.guestText = tr("covers.guestsInvalid");
  if (d.autoRenew) {
    const n = num(d.noticeText);
    if (!whole(n) || n < 0) e.noticeText = tr("renewal.noticeInvalid");
  }
  return e;
}

/** Text to the numbers the plan stores. Only saved when valid; also feeds the preview. */
function toInput(d: Draft): MembershipTierInput {
  const pct = soft(d.discountText);
  const discounted = pct > 0;
  return {
    name: d.name.trim(),
    description: d.description.trim(),
    price: Math.round(soft(d.priceText) * 100),
    billingPeriod: d.period,
    autoRenew: d.autoRenew,
    renewalNoticeDays: d.autoRenew ? soft(d.noticeText) : 0,
    discountBps: Math.round(pct * 100),
    discountScope: discounted ? d.discountScope : "all",
    discountProductIds: discounted && d.discountScope === "products" ? d.discountProductIds : [],
    includedVisits: d.unlimited ? null : soft(d.visitsText),
    includedProductIds: d.visitsScope === "some" ? d.includedProductIds : [],
    maxMembers: d.group ? soft(d.maxText) : 1,
    guestPassesPerPeriod: soft(d.guestText),
    status: "active",
  };
}

type Tx = (k: string, v?: Record<string, string | number>) => string;

/**
 * The plan editor, for a new plan and an existing one. A new plan has a bar
 * that is always there and names the act (Add plan); an existing plan has a
 * bar that appears once something changed. The live preview is the plan card
 * the Plans page draws, from the form as it stands.
 */
export function PlanForm({
  plan,
  members,
  onSaved,
}: {
  /** Omit for a new plan. */
  plan?: MembershipTier;
  /** Members on the plan now, for the preview card. */
  members: number;
  onSaved?: (plan: MembershipTier) => void;
}) {
  const t = useTranslations("membershipPlans");
  const tm = useTranslations("memberships");
  const router = useRouter();
  const toast = useToast();
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const products = productsQ.data?.data ?? [];

  const [base, setBase] = useState<MembershipTier | undefined>(plan);
  const saved = base ? toDraft(base) : blank();
  const [draft, setDraft] = useState<Draft | null>(null);
  const form = draft ?? saved;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const tx = t as unknown as Tx;
  const errors = validate(form, (k) => tx(k));
  const invalid = Object.keys(errors).length > 0;
  const shown = (k: keyof Draft) => (touched.has(k) ? errors[k] : undefined);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft({ ...form, [key]: value });
    setTouched((prev) => new Set(prev).add(key));
  };
  const toggle = (key: "includedProductIds" | "discountProductIds", id: string) =>
    set(key, form[key].includes(id) ? form[key].filter((x) => x !== id) : [...form[key], id]);

  const discard = () => {
    setDraft(null);
    setTouched(new Set());
  };

  const submit = async () => {
    if (invalid) {
      setTouched(new Set(Object.keys(errors)));
      return;
    }
    setSaving(true);
    const input = toInput(form);
    const res = base ? await updateMembershipTier(base.id, { ...input, status: base.status }) : await createMembershipTier(input);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    if (base) {
      setBase(res.data);
      discard();
      toast.success(t("editor.saved"));
      onSaved?.(res.data);
    } else {
      toast.success(t("editor.added", { name: res.data.name }));
      router.push(`/memberships/plans/${res.data.id}`);
    }
  };

  const preview = { ...toInput(form), status: base?.status ?? "active" } as MembershipTier;
  const pctNow = soft(form.discountText);
  const minorNow = Math.round(soft(form.priceText) * 100);
  const guestsNow = soft(form.guestText);
  const noticeNow = soft(form.noticeText);

  const picker = (key: "includedProductIds" | "discountProductIds", label: string) => (
    <div role="group" aria-label={label} className="max-h-60 overflow-y-auto rounded-control border border-line p-tight">
      {/* What the saved plan already covers comes first, so a ticked item is
          never hidden below the fold of this scroll box. Sorted by the saved
          plan, not the draft, so rows don't jump while ticking. */}
      {[...products]
        .sort((a, b) => Number(!!base?.[key].includes(b.id)) - Number(!!base?.[key].includes(a.id)))
        .map((p) => (
        <Checkbox key={p.id} label={p.name} checked={form[key].includes(p.id)} onChange={() => toggle(key, p.id)} />
      ))}
      {!productsQ.loading && products.length === 0 && <p className="p-tight text-sm text-muted">{t("visits.noProducts")}</p>}
    </div>
  );

  return (
    <div className="grid items-start gap-major pb-hero lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-section">
        <SettingsSection title={t("name.title")} description={t("name.description")}>
          <SettingRow label={t("name.nameLabel")} description={t("name.nameHelp")} error={shown("name")}>
            {({ id, describedBy }) => (
              <input
                id={id}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                aria-invalid={!!shown("name") || undefined}
                aria-describedby={describedBy}
                autoComplete="off"
                className={controlCls(!!shown("name"))}
              />
            )}
          </SettingRow>
          <SettingRow label={t("name.descLabel")} description={t("name.descHelp")}>
            {({ id, describedBy }) => (
              <input id={id} value={form.description} onChange={(e) => set("description", e.target.value)} aria-describedby={describedBy} autoComplete="off" className={controlCls()} />
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={t("price.title")} description={t("price.description")}>
          <SettingRow label={t("price.amountLabel")} description={t(`price.help_${form.period}`, { price: formatMoney(minorNow) })} error={shown("priceText")}>
            {({ id, describedBy }) => (
              <AffixInput
                id={id}
                value={form.priceText}
                onChange={(e) => set("priceText", e.target.value)}
                inputMode="decimal"
                prefix={"৳"}
                invalid={!!shown("priceText")}
                aria-describedby={describedBy}
                inputClassName="tabular-nums"
              />
            )}
          </SettingRow>
          <SettingRow label={t("price.howOftenLabel")} layout="stack" labelFor={false}>
            {({ labelId }) => (
              <SegmentedControl
                aria-labelledby={labelId}
                fullWidth
                value={form.period}
                onChange={(v) => set("period", v as BillingPeriod)}
                options={PERIODS.map((p) => ({ value: p, label: t(`price.${p}`) }))}
              />
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={t("visits.title")} description={t("visits.description")}>
          <SettingRow label={t("visits.howManyLabel")} description={form.unlimited ? t("visits.helpUnlimited") : undefined} layout="stack" labelFor={false}>
            {({ labelId }) => (
              <SegmentedControl
                aria-labelledby={labelId}
                fullWidth
                value={form.unlimited ? "unlimited" : "counted"}
                onChange={(v) => set("unlimited", v === "unlimited")}
                options={[
                  { value: "unlimited", label: t("visits.unlimited") },
                  { value: "counted", label: t("visits.counted") },
                ]}
              />
            )}
          </SettingRow>
          {!form.unlimited && (
            <SettingRow label={t("visits.countLabel")} description={t(`visits.help_${form.period}`, { count: soft(form.visitsText) })} error={shown("visitsText")}>
              {({ id, describedBy }) => (
                <input
                  id={id}
                  value={form.visitsText}
                  onChange={(e) => set("visitsText", e.target.value)}
                  inputMode="numeric"
                  aria-invalid={!!shown("visitsText") || undefined}
                  aria-describedby={describedBy}
                  className={`${controlCls(!!shown("visitsText"))} tabular-nums`}
                />
              )}
            </SettingRow>
          )}
          <SettingRow label={t("visits.whichLabel")} description={form.visitsScope === "every" ? t("visits.helpEvery") : t("visits.helpSome")} layout="stack" labelFor={false}>
            {({ labelId }) => (
              <div className="flex flex-col gap-comfortable">
                <SegmentedControl
                  aria-labelledby={labelId}
                  fullWidth
                  value={form.visitsScope}
                  onChange={(v) => set("visitsScope", v as Draft["visitsScope"])}
                  options={[
                    { value: "every", label: t("visits.whichEvery") },
                    { value: "some", label: t("visits.whichSome") },
                  ]}
                />
                {form.visitsScope === "some" && picker("includedProductIds", t("visits.pickLabel"))}
              </div>
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={t("discount.title")} description={t("discount.description")}>
          <SettingRow label={t("discount.percentLabel")} description={pctNow > 0 ? t("discount.help", { pct: pctNow }) : t("discount.helpNone")} error={shown("discountText")}>
            {({ id, describedBy }) => (
              <AffixInput
                id={id}
                value={form.discountText}
                onChange={(e) => set("discountText", e.target.value)}
                inputMode="decimal"
                suffix="%"
                invalid={!!shown("discountText")}
                aria-describedby={describedBy}
                inputClassName="tabular-nums"
              />
            )}
          </SettingRow>
          {pctNow > 0 && (
            <SettingRow label={t("discount.appliesLabel")} description={form.discountScope === "all" ? t("discount.helpEverything") : t("discount.helpSome")} layout="stack" labelFor={false}>
              {({ labelId }) => (
                <div className="flex flex-col gap-comfortable">
                  <SegmentedControl
                    aria-labelledby={labelId}
                    fullWidth
                    value={form.discountScope}
                    onChange={(v) => set("discountScope", v as MembershipDiscountScope)}
                    options={[
                      { value: "all", label: t("discount.everything") },
                      { value: "products", label: t("discount.some") },
                    ]}
                  />
                  {form.discountScope === "products" && picker("discountProductIds", t("discount.pickLabel"))}
                </div>
              )}
            </SettingRow>
          )}
        </SettingsSection>

        <SettingsSection title={t("covers.title")} description={t("covers.description")}>
          <SettingRow label={t("covers.whoLabel")} description={form.group ? t("covers.helpGroup", { count: soft(form.maxText) }) : t("covers.helpOne")} layout="stack" labelFor={false}>
            {({ labelId }) => (
              <SegmentedControl
                aria-labelledby={labelId}
                fullWidth
                value={form.group ? "group" : "one"}
                onChange={(v) => set("group", v === "group")}
                options={[
                  { value: "one", label: t("covers.one") },
                  { value: "group", label: t("covers.group") },
                ]}
              />
            )}
          </SettingRow>
          {form.group && (
            <SettingRow label={t("covers.peopleLabel")} error={shown("maxText")}>
              {({ id, describedBy }) => (
                <input
                  id={id}
                  value={form.maxText}
                  onChange={(e) => set("maxText", e.target.value)}
                  inputMode="numeric"
                  aria-invalid={!!shown("maxText") || undefined}
                  aria-describedby={describedBy}
                  className={`${controlCls(!!shown("maxText"))} tabular-nums`}
                />
              )}
            </SettingRow>
          )}
          <SettingRow label={t("covers.guestsLabel")} description={guestsNow > 0 ? t("covers.guestsHelp", { count: guestsNow }) : t("covers.guestsHelpNone")} error={shown("guestText")}>
            {({ id, describedBy }) => (
              <input
                id={id}
                value={form.guestText}
                onChange={(e) => set("guestText", e.target.value)}
                inputMode="numeric"
                aria-invalid={!!shown("guestText") || undefined}
                aria-describedby={describedBy}
                className={`${controlCls(!!shown("guestText"))} tabular-nums`}
              />
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={t("renewal.title")} description={t("renewal.description")}>
          <SettingRow label={t("renewal.autoLabel")} description={form.autoRenew ? t("renewal.helpOn") : t("renewal.helpOff")} trailing labelFor={false}>
            {({ labelId, describedBy }) => <Switch checked={form.autoRenew} onChange={(on) => set("autoRenew", on)} labelledBy={labelId} describedBy={describedBy} />}
          </SettingRow>
          {form.autoRenew && (
            <SettingRow label={t("renewal.noticeLabel")} description={noticeNow > 0 ? t("renewal.noticeHelp", { count: noticeNow }) : t("renewal.noticeHelpZero")} error={shown("noticeText")}>
              {({ id, describedBy }) => (
                <AffixInput
                  id={id}
                  value={form.noticeText}
                  onChange={(e) => set("noticeText", e.target.value)}
                  inputMode="numeric"
                  suffix={t("renewal.days")}
                  invalid={!!shown("noticeText")}
                  aria-describedby={describedBy}
                  inputClassName="tabular-nums"
                />
              )}
            </SettingRow>
          )}
        </SettingsSection>

        {base ? (
          <SaveBar dirty={dirty} saving={saving} invalid={invalid} onSave={submit} onDiscard={discard} />
        ) : (
          <CreateBar
            dirty={dirty}
            invalid={invalid}
            saving={saving}
            note={t("editor.createNote")}
            invalidNote={t("editor.createInvalid")}
            submitLabel={t("editor.add")}
            onSubmit={submit}
            onCancel={() => router.push("/memberships/plans")}
          />
        )}
      </div>

      <aside aria-labelledby="plan-preview" className="flex min-w-0 flex-col gap-comfortable lg:sticky lg:top-section">
        <h2 id="plan-preview" className="text-base font-semibold text-fg">
          {t("editor.previewTitle")}
        </h2>
        <PlanCard plan={preview} members={members} fallbackName={tm("previewFallbackName")} />
        <p className="text-sm text-muted">
          {tm("previewLine", {
            name: form.name.trim() || tm("previewFallbackName"),
            price: formatMoney(minorNow),
            period: tm(`period_${form.period}`).toLowerCase(),
          })}
        </p>
      </aside>
    </div>
  );
}
