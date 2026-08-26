"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, FormField, PageShell, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  archivePriceRule,
  createPriceRule,
  getPriceRule,
  listLocations,
  listProducts,
  updatePriceRule,
} from "@/lib/api";
import type { PriceRule, PriceRuleInput } from "@/lib/api";

const BLANK: PriceRuleInput = {
  name: "", productId: null, locationId: null, channel: "all", kind: "peak", adjustmentPct: 0, status: "active",
};

export default function PriceRuleEditorPage() {
  const t = useTranslations("pricing");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const isNew = params.id === "new";

  const ruleQ = useApiQuery(() => (isNew ? Promise.resolve({ ok: true as const, data: null }) : getPriceRule(params.id)), [params.id]);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);

  const [form, setForm] = useState<PriceRuleInput>(BLANK);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew && ruleQ.data) {
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = ruleQ.data;
      void _id; void _c; void _u;
      setForm(rest);
    }
  }, [isNew, ruleQ.data]);

  if (!isNew && !ruleQ.loading && !ruleQ.data) {
    return <PageShell title={t("back")}><EmptyState title={t("notFound")} action={<Button onClick={() => router.push("/pricing")}>{t("back")}</Button>} /></PageShell>;
  }

  const set = <K extends keyof PriceRuleInput>(k: K, v: PriceRuleInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const res = isNew ? await createPriceRule(form) : await updatePriceRule(params.id, form);
    setSaving(false);
    if (res.ok) { toast.success(isNew ? t("created") : t("saved")); router.push("/pricing"); }
    else toast.error(res.error.message);
  };
  const archive = async () => { await archivePriceRule(params.id); toast.success(t("archived")); router.push("/pricing"); };

  const products = productsQ.data?.data ?? [];
  const locations = locationsQ.data?.data ?? [];

  return (
    <PageShell
      title={isNew ? t("newRule") : (form.name || t("editRule"))}
      actions={<Button loading={saving} onClick={save}>{t("save")}</Button>}
    >
      <button type="button" onClick={() => router.push("/pricing")} className="mb-section flex items-center gap-inline text-[13px] text-muted hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("back")}
      </button>

      <div className="grid max-w-2xl gap-section card-surface p-major sm:grid-cols-2">
        <FormField label={t("fieldName")} value={form.name} onChange={(e) => set("name", e.target.value)} className="sm:col-span-2" />
        <FormField label={t("fieldProduct")} variant="select" value={form.productId ?? ""} onChange={(e) => set("productId", e.target.value || null)} options={[{ value: "", label: t("allProducts") }, ...products.map((p) => ({ value: p.id, label: p.name }))]} />
        <FormField label={t("fieldLocation")} variant="select" value={form.locationId ?? ""} onChange={(e) => set("locationId", e.target.value || null)} options={[{ value: "", label: t("allLocations") }, ...locations.map((l) => ({ value: l.id, label: l.name }))]} />
        <FormField label={t("fieldChannel")} variant="select" value={form.channel} onChange={(e) => set("channel", e.target.value as PriceRule["channel"])} options={[{ value: "all", label: t("channelAll") }, { value: "counter", label: t("channelCounter") }, { value: "online", label: t("channelOnline") }]} />
        <FormField label={t("fieldKind")} variant="select" value={form.kind} onChange={(e) => set("kind", e.target.value as PriceRule["kind"])} options={[{ value: "standard", label: t("kindStandard") }, { value: "peak", label: t("kindPeak") }, { value: "off_peak", label: t("kindOffPeak") }]} />
        <FormField label={t("fieldAdjustment")} variant="number" value={String(form.adjustmentPct)} onChange={(e) => set("adjustmentPct", parseFloat(e.target.value) || 0)} help={t("adjustmentHint")} />
        <FormField label={t("fieldStatus")} variant="select" value={form.status} onChange={(e) => set("status", e.target.value as PriceRuleInput["status"])} options={[{ value: "active", label: t("statusActive") }, { value: "inactive", label: t("statusInactive") }]} />
      </div>

      {!isNew && (
        <Button variant="secondary" className="mt-section" onClick={archive}>{t("archive")}</Button>
      )}
    </PageShell>
  );
}
