"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, Plus } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FormField,
  Modal,
  PageShell,
  StatusPill,
  useToast,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  archiveMembershipTier,
  createMembershipTier,
  listCategories,
  listMembershipTiers,
  listProducts,
  membershipCountsByTier,
  updateMembershipTier,
  type BillingPeriod,
  type MembershipDiscountScope,
  type MembershipTier,
  type MembershipTierInput,
} from "@/lib/api";
import { formatMoney } from "@/lib/format";

const PERIODS: BillingPeriod[] = ["monthly", "quarterly", "annual", "lifetime"];
const SCOPES: MembershipDiscountScope[] = ["all", "categories", "products"];

const blankTier = (): MembershipTierInput => ({
  name: "",
  description: "",
  price: 0,
  billingPeriod: "annual",
  autoRenew: true,
  renewalNoticeDays: 14,
  discountBps: 1000,
  discountScope: "all",
  discountCategoryIds: [],
  discountProductIds: [],
  includedVisits: null,
  includedProductIds: [],
  maxMembers: 1,
  guestPassesPerPeriod: 0,
  status: "active",
});

export default function MembershipTiersPage() {
  const t = useTranslations("memberships");
  const toast = useToast();
  const tiersQ = useApiQuery(() => listMembershipTiers({ pageSize: 100 }), []);
  const [editing, setEditing] = useState<MembershipTier | "new" | null>(null);
  const [archiving, setArchiving] = useState<MembershipTier | null>(null);

  const tiers = tiersQ.data?.data ?? [];
  const heldQ = useApiQuery(() => membershipCountsByTier(), [tiersQ.data]);
  const held = (tierId: string) => heldQ.data?.[tierId] ?? 0;

  const doArchive = async () => {
    if (!archiving) return;
    const res = await archiveMembershipTier(archiving.id);
    setArchiving(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("tierArchived", { name: archiving.name }));
    tiersQ.reload();
  };

  return (
    <PageShell
      title={t("tiersTitle")}
      description={t("tiersDescription")}
      actions={
        <Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => setEditing("new")}>
          {t("newTier")}
        </Button>
      }
    >
      {tiersQ.loading && (
        <div className="flex flex-col gap-tight">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-md bg-line" />
          ))}
        </div>
      )}

      {!tiersQ.loading && tiers.length === 0 && (
        <EmptyState
          title={t("noTiersTitle")}
          message={t("noTiersMessage")}
          action={<Button onClick={() => setEditing("new")}>{t("newTier")}</Button>}
        />
      )}

      <div className="flex flex-col gap-tight">
        {tiers.map((tier) => (
          <div key={tier.id} className="card-surface p-section">
            <div className="flex flex-wrap items-start justify-between gap-tight">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-tight">
                  <h3 className="break-words text-base font-medium">{tier.name}</h3>
                  <StatusPill tone="neutral">{t(`period_${tier.billingPeriod}`)}</StatusPill>
                  {tier.maxMembers > 1 && (
                    <StatusPill tone="info">
                      {t("coversPeople", { count: tier.maxMembers })}
                    </StatusPill>
                  )}
                </div>
                <p className="mt-inline break-words text-[13px] text-muted">{tier.description}</p>
                <p className="mt-tight text-[12px] text-muted">{summaryOf(tier, t)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-tight">
                <span className="whitespace-nowrap font-mono text-lg">{formatMoney(tier.price)}</span>
                <Button variant="secondary" size="sm" onClick={() => setEditing(tier)}>
                  {t("edit")}
                </Button>
                <Button
                  variant="tertiary"
                  size="sm"
                  icon={<Archive size={14} strokeWidth={1.5} />}
                  onClick={() => setArchiving(tier)}
                >
                  {t("archive")}
                </Button>
              </div>
            </div>
            <p className="mt-tight font-mono text-[12px] text-faint">
              {t("membersOnTier", { count: held(tier.id) })}
            </p>
          </div>
        ))}
      </div>

      {editing && (
        <TierEditor
          tier={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            tiersQ.reload();
          }}
        />
      )}

      <ConfirmDialog
        open={!!archiving}
        onClose={() => setArchiving(null)}
        onConfirm={doArchive}
        destructive
        title={t("archiveTitle", { name: archiving?.name ?? "" })}
        message={t("archiveMessage", { count: held(archiving?.id ?? "") })}
        confirmLabel={t("archive")}
      />
    </PageShell>
  );
}

/** The plain-language line under a tier — what a member actually gets. */
type Tx = (k: string, v?: Record<string, string | number | Date>) => string;

function summaryOf(tier: MembershipTier, t: Tx) {
  const parts: string[] = [];
  parts.push(
    tier.includedVisits == null
      ? t("summaryUnlimited")
      : t("summaryVisits", { count: tier.includedVisits }),
  );
  if (tier.discountBps > 0) {
    const pct = tier.discountBps / 100;
    parts.push(
      tier.discountScope === "all"
        ? t("summaryDiscountAll", { pct })
        : t("summaryDiscountScoped", { pct }),
    );
  }
  if (tier.guestPassesPerPeriod > 0) {
    parts.push(t("summaryGuestPasses", { count: tier.guestPassesPerPeriod }));
  }
  parts.push(tier.autoRenew ? t("summaryAutoRenew") : t("summaryNoRenew"));
  return parts.join(" · ");
}

function TierEditor({
  tier,
  onClose,
  onSaved,
}: {
  tier: MembershipTier | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("memberships");
  const toast = useToast();
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const categoriesQ = useApiQuery(() => listCategories({ pageSize: 100 }), []);

  const [draft, setDraft] = useState<MembershipTierInput>(() =>
    tier
      ? {
          name: tier.name,
          description: tier.description,
          price: tier.price,
          billingPeriod: tier.billingPeriod,
          autoRenew: tier.autoRenew,
          renewalNoticeDays: tier.renewalNoticeDays,
          discountBps: tier.discountBps,
          discountScope: tier.discountScope,
          discountCategoryIds: tier.discountCategoryIds,
          discountProductIds: tier.discountProductIds,
          includedVisits: tier.includedVisits,
          includedProductIds: tier.includedProductIds,
          maxMembers: tier.maxMembers,
          guestPassesPerPeriod: tier.guestPassesPerPeriod,
          status: tier.status,
        }
      : blankTier(),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof MembershipTierInput>(key: K, value: MembershipTierInput[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleIn = (key: "discountCategoryIds" | "discountProductIds" | "includedProductIds", id: string) =>
    setDraft((d) => ({
      ...d,
      [key]: d[key].includes(id) ? d[key].filter((x) => x !== id) : [...d[key], id],
    }));

  const save = async () => {
    setSaving(true);
    const res = tier
      ? await updateMembershipTier(tier.id, draft)
      : await createMembershipTier(draft);
    setSaving(false);
    if (!res.ok) {
      setErrors(res.error.fieldErrors ?? {});
      toast.error(res.error.message);
      return;
    }
    toast.success(tier ? t("tierSaved") : t("tierCreated", { name: res.data.name }));
    onSaved();
  };

  const products = productsQ.data?.data ?? [];
  const categories = categoriesQ.data?.data ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={tier ? t("editTierTitle", { name: tier.name }) : t("newTierTitle")}
      description={t("tierEditorDescription")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={save} loading={saving}>
            {tier ? t("saveTier") : t("createTier")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-section">
        <FormField
          label={t("fieldTierName")}
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          error={errors.name}
        />
        <FormField
          label={t("fieldTierDescription")}
          variant="textarea"
          rows={2}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          help={t("tierDescriptionHelp")}
        />

        <div className="grid grid-cols-1 gap-section sm:grid-cols-3">
          <FormField
            label={t("fieldPrice")}
            variant="number"
            value={String(draft.price / 100)}
            onChange={(e) => set("price", Math.round(Number(e.target.value || 0) * 100))}
            error={errors.price}
            help={t("priceHelp")}
          />
          <FormField
            label={t("fieldPeriod")}
            variant="select"
            value={draft.billingPeriod}
            onChange={(e) => set("billingPeriod", e.target.value as BillingPeriod)}
            options={PERIODS.map((p) => ({ value: p, label: t(`period_${p}`) }))}
          />
          <FormField
            label={t("fieldMaxMembers")}
            variant="number"
            value={String(draft.maxMembers)}
            onChange={(e) => set("maxMembers", Math.max(1, Number(e.target.value || 1)))}
            error={errors.maxMembers}
            help={t("maxMembersHelp")}
          />
        </div>

        <div className="rounded-sm border border-line p-comfortable">
          <p className="type-label mb-comfortable text-[12px] text-muted">{t("sectionEntry")}</p>
          <div className="grid grid-cols-1 gap-section sm:grid-cols-2">
            <FormField
              label={t("fieldIncludedVisits")}
              variant="number"
              value={draft.includedVisits == null ? "" : String(draft.includedVisits)}
              onChange={(e) =>
                set("includedVisits", e.target.value === "" ? null : Number(e.target.value))
              }
              error={errors.includedVisits}
              help={t("includedVisitsHelp")}
            />
            <FormField
              label={t("fieldGuestPasses")}
              variant="number"
              value={String(draft.guestPassesPerPeriod)}
              onChange={(e) =>
                set("guestPassesPerPeriod", Math.max(0, Number(e.target.value || 0)))
              }
              help={t("guestPassesHelp")}
            />
          </div>
          <p className="type-label mb-tight mt-section text-[12px] text-muted">
            {t("fieldIncludedProducts")}
          </p>
          <ChipPicker
            options={products.map((p) => ({ id: p.id, label: p.name }))}
            selected={draft.includedProductIds}
            onToggle={(id) => toggleIn("includedProductIds", id)}
            emptyLabel={t("noProducts")}
          />
          <p className="mt-tight text-[12px] text-muted">{t("includedProductsHelp")}</p>
        </div>

        <div className="rounded-sm border border-line p-comfortable">
          <p className="type-label mb-comfortable text-[12px] text-muted">{t("sectionDiscount")}</p>
          <div className="grid grid-cols-1 gap-section sm:grid-cols-2">
            <FormField
              label={t("fieldDiscount")}
              variant="number"
              value={String(draft.discountBps / 100)}
              onChange={(e) => set("discountBps", Math.round(Number(e.target.value || 0) * 100))}
              error={errors.discountBps}
              help={t("discountHelp")}
            />
            <FormField
              label={t("fieldDiscountScope")}
              variant="select"
              value={draft.discountScope}
              onChange={(e) => set("discountScope", e.target.value as MembershipDiscountScope)}
              options={SCOPES.map((s) => ({ value: s, label: t(`scope_${s}`) }))}
            />
          </div>
          {draft.discountScope === "categories" && (
            <div className="mt-section">
              <ChipPicker
                options={categories.map((c) => ({ id: c.id, label: c.name }))}
                selected={draft.discountCategoryIds}
                onToggle={(id) => toggleIn("discountCategoryIds", id)}
                emptyLabel={t("noCategories")}
              />
            </div>
          )}
          {draft.discountScope === "products" && (
            <div className="mt-section">
              <ChipPicker
                options={products.map((p) => ({ id: p.id, label: p.name }))}
                selected={draft.discountProductIds}
                onToggle={(id) => toggleIn("discountProductIds", id)}
                emptyLabel={t("noProducts")}
              />
            </div>
          )}
        </div>

        <div className="rounded-sm border border-line p-comfortable">
          <p className="type-label mb-comfortable text-[12px] text-muted">{t("sectionRenewal")}</p>
          <div className="grid grid-cols-1 gap-section sm:grid-cols-2">
            <FormField
              label={t("fieldAutoRenew")}
              variant="toggle"
              checked={draft.autoRenew}
              onChange={(e) =>
                set("autoRenew", (e.target as HTMLInputElement).checked)
              }
              help={t("autoRenewHelp")}
            />
            <FormField
              label={t("fieldNoticeDays")}
              variant="number"
              value={String(draft.renewalNoticeDays)}
              onChange={(e) => set("renewalNoticeDays", Math.max(0, Number(e.target.value || 0)))}
              disabled={!draft.autoRenew}
              help={t("noticeDaysHelp")}
            />
          </div>
        </div>

        {/* The mandatory concrete preview, as everywhere else in this app: say
            what a member gets in the words a member would use. */}
        <div className="rounded-sm border-l-2 border-ember bg-ember/5 p-comfortable">
          <p className="type-label text-[12px] text-muted">{t("previewLabel")}</p>
          <p className="mt-inline text-[13px]">
            {t("previewLine", {
              name: draft.name || t("previewFallbackName"),
              price: formatMoney(draft.price),
              period: t(`period_${draft.billingPeriod}`).toLowerCase(),
            })}
          </p>
          <p className="mt-inline text-[13px] text-muted">
            {summaryOf({ ...draft, id: "", createdAt: "", updatedAt: "" } as MembershipTier, t)}
          </p>
        </div>
      </div>
    </Modal>
  );
}

function ChipPicker({
  options,
  selected,
  onToggle,
  emptyLabel,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  emptyLabel: string;
}) {
  if (options.length === 0) {
    return <p className="text-[13px] text-faint">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-wrap gap-inline">
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            className={`min-h-9 max-w-full rounded-sm border px-comfortable text-[13px] transition-colors duration-quick ${
              on
                ? "border-ember bg-ember/10 text-brand-foreground"
                : "border-line text-muted hover:bg-subtle"
            }`}
          >
            <span className="block truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
