"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, FormField, PageShell, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getPromotion, listCoupons, updatePromotion } from "@/lib/api";
import type { Channel, Promotion, PromotionKind } from "@/lib/api";

const KINDS: PromotionKind[] = ["percentage_off", "fixed_amount_off", "fixed_price", "buy_x_get_y", "bundle_price"];

export default function PromotionEditorPage() {
  const t = useTranslations("promotions");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const q = useApiQuery(() => getPromotion(params.id), [params.id]);
  const couponsQ = useApiQuery(() => listCoupons({ pageSize: 100 }), []);
  const coupon = couponsQ.data?.data.find((c) => c.promotionId === params.id);

  const [p, setP] = useState<Promotion | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (q.data) setP(q.data); }, [q.data]);

  if (!q.loading && (q.error || !q.data)) {
    return <PageShell title={t("editor.back")}><EmptyState title="Not found" action={<Button onClick={() => router.push("/promotions")}>{t("editor.back")}</Button>} /></PageShell>;
  }
  if (!p) return <PageShell title={t("editor.back")}><div className="h-40 animate-pulse rounded-md bg-line" /></PageShell>;

  const toggleChannel = (ch: Channel) => {
    const has = p.eligibility.channels.includes(ch);
    setP({ ...p, eligibility: { ...p.eligibility, channels: has ? p.eligibility.channels.filter((c) => c !== ch) : [...p.eligibility.channels, ch] } });
  };

  const save = async () => {
    setSaving(true);
    const res = await updatePromotion(params.id, p);
    setSaving(false);
    if (res.ok) { toast.success(t("editor.saved")); q.reload(); }
    else toast.error(res.error.message);
  };

  const isPct = p.kind === "percentage_off";
  const isAmount = p.kind === "fixed_amount_off" || p.kind === "fixed_price";
  const isBxgy = p.kind === "buy_x_get_y" || p.kind === "bundle_price";

  return (
    <PageShell title={p.name || t("editor.back")} actions={<Button loading={saving} onClick={save}>{t("editor.save")}</Button>}>
      <button type="button" onClick={() => router.push("/promotions")} className="mb-section flex items-center gap-inline text-[13px] text-muted hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("editor.back")}
      </button>

      <div className="grid max-w-2xl gap-section rounded-md border border-line bg-card p-major sm:grid-cols-2">
        <FormField label={t("editor.name")} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
        <FormField label={t("editor.kind")} variant="select" value={p.kind} onChange={(e) => setP({ ...p, kind: e.target.value as PromotionKind })} options={KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))} />

        {isPct && <FormField label={t("editor.percent")} variant="number" value={String((p.percentBps ?? 0) / 100)} onChange={(e) => setP({ ...p, percentBps: Math.round((parseFloat(e.target.value) || 0) * 100) })} />}
        {isPct && <FormField label={t("editor.maxDiscount")} variant="number" value={p.maxDiscountAmount != null ? String(p.maxDiscountAmount / 100) : ""} onChange={(e) => setP({ ...p, maxDiscountAmount: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined })} />}
        {isAmount && <FormField label={t("editor.amount")} variant="number" value={String((p.amount ?? 0) / 100)} onChange={(e) => setP({ ...p, amount: Math.round((parseFloat(e.target.value) || 0) * 100) })} />}

        <FormField label={t("editor.minSubtotal")} variant="number" value={p.eligibility.minSubtotal != null ? String(p.eligibility.minSubtotal / 100) : ""} onChange={(e) => setP({ ...p, eligibility: { ...p.eligibility, minSubtotal: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined } })} />
        <FormField label={t("editor.status")} variant="select" value={p.status} onChange={(e) => setP({ ...p, status: e.target.value as Promotion["status"] })} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "archived", label: "Archived" }]} />

        <FormField label={t("editor.validFrom")} variant="date" value={p.validFrom ?? ""} onChange={(e) => setP({ ...p, validFrom: e.target.value || undefined })} />
        <FormField label={t("editor.validTo")} variant="date" value={p.validTo ?? ""} onChange={(e) => setP({ ...p, validTo: e.target.value || undefined })} />

        <div className="sm:col-span-2">
          <span className="type-label mb-tight block text-[12px] text-muted">{t("editor.channels")}</span>
          <div className="flex gap-tight">
            {(["counter", "online"] as Channel[]).map((ch) => (
              <button key={ch} type="button" onClick={() => toggleChannel(ch)} className={`h-10 rounded-sm border px-comfortable text-[13px] ${p.eligibility.channels.includes(ch) ? "border-ember bg-ember/5 font-medium" : "border-line"}`}>{t(`editor.${ch}`)}</button>
            ))}
          </div>
        </div>

        {coupon && <FormField label={t("editor.couponCode")} value={coupon.code} disabled onChange={() => {}} />}

        {isBxgy && (
          <p className="sm:col-span-2 rounded-sm border border-line border-l-[3px] border-l-ember bg-card p-tight text-[12px] text-muted">
            {p.buyXGetY ? t("editor.bxgyNote", { buy: p.buyXGetY.buyQuantity, get: p.buyXGetY.getQuantity, pct: (p.buyXGetY.getDiscountBps / 100) }) + " " : ""}{t("editor.advancedNote")}
          </p>
        )}
      </div>
    </PageShell>
  );
}
