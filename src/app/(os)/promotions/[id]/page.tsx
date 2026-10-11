"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Card, Chip, EmptyState, FormField, Notice, PageShell, Skeleton, useToast } from "@/components/ui";
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

  /* Loading and not-found keep the page's own h1 — the back label titles the
     link back, not the page. */
  const back = { href: "/promotions", label: t("editor.back") };
  if (!q.loading && (q.error || !q.data)) {
    return (
      <PageShell title={t("editor.title")} back={back}>
        <EmptyState title={t("editor.notFound")} action={<Button onClick={() => router.push("/promotions")}>{t("editor.back")}</Button>} />
      </PageShell>
    );
  }
  if (!p) {
    return (
      <PageShell title={t("editor.title")} back={back}>
        <div aria-busy="true" className="overflow-hidden rounded-card"><Skeleton h={160} /></div>
      </PageShell>
    );
  }

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
    <PageShell title={p.name || t("editor.title")} back={back} actions={<Button variant="primary" size="md" loading={saving} onClick={save}>{t("editor.save")}</Button>}>
      <Card className="grid max-w-2xl gap-section sm:grid-cols-2">
        <FormField label={t("editor.name")} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
        <FormField label={t("editor.kind")} variant="select" value={p.kind} onChange={(e) => setP({ ...p, kind: e.target.value as PromotionKind })} options={KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))} />

        {isPct && <FormField label={t("editor.percent")} variant="number" value={String((p.percentBps ?? 0) / 100)} onChange={(e) => setP({ ...p, percentBps: Math.round((parseFloat(e.target.value) || 0) * 100) })} />}
        {isPct && <FormField label={t("editor.maxDiscount")} variant="number" value={p.maxDiscountAmount != null ? String(p.maxDiscountAmount / 100) : ""} onChange={(e) => setP({ ...p, maxDiscountAmount: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined })} />}
        {isAmount && <FormField label={t("editor.amount")} variant="number" value={String((p.amount ?? 0) / 100)} onChange={(e) => setP({ ...p, amount: Math.round((parseFloat(e.target.value) || 0) * 100) })} />}

        <FormField label={t("editor.minSubtotal")} variant="number" value={p.eligibility.minSubtotal != null ? String(p.eligibility.minSubtotal / 100) : ""} onChange={(e) => setP({ ...p, eligibility: { ...p.eligibility, minSubtotal: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined } })} />
        <FormField label={t("editor.status")} variant="select" value={p.status} onChange={(e) => setP({ ...p, status: e.target.value as Promotion["status"] })} options={[{ value: "active", label: t("editor.statusActive") }, { value: "inactive", label: t("editor.statusInactive") }, { value: "archived", label: t("editor.statusArchived") }]} />

        <FormField label={t("editor.validFrom")} variant="date" value={p.validFrom ?? ""} onChange={(e) => setP({ ...p, validFrom: e.target.value || undefined })} />
        <FormField label={t("editor.validTo")} variant="date" value={p.validTo ?? ""} onChange={(e) => setP({ ...p, validTo: e.target.value || undefined })} />

        <div role="group" aria-labelledby="promo-channels" className="sm:col-span-2">
          <span id="promo-channels" className="mb-tight block text-sm font-medium text-muted">{t("editor.channels")}</span>
          <div className="flex gap-tight">
            {(["counter", "online"] as Channel[]).map((ch) => (
              <Chip key={ch} selected={p.eligibility.channels.includes(ch)} onClick={() => toggleChannel(ch)}>{t(`editor.${ch}`)}</Chip>
            ))}
          </div>
        </div>

        {coupon && <FormField label={t("editor.couponCode")} value={coupon.code} disabled onChange={() => {}} />}

        {isBxgy && (
          <Notice tone="info" size="sm" className="sm:col-span-2">
            {p.buyXGetY ? t("editor.bxgyNote", { buy: p.buyXGetY.buyQuantity, get: p.buyXGetY.getQuantity, pct: (p.buyXGetY.getDiscountBps / 100) }) + " " : ""}{t("editor.advancedNote")}
          </Notice>
        )}
      </Card>
    </PageShell>
  );
}
