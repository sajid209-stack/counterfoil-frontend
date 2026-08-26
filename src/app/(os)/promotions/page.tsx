"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, DataTable, EmptyState, FormField, PageShell, StatusPill, useToast, type Column } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { createPromotion, getManualDiscountPolicy, listPromotions, updateManualDiscountPolicy } from "@/lib/api";
import type { ManualDiscountPolicy, Promotion } from "@/lib/api";
import { formatMoney } from "@/lib/format";

export default function PromotionsPage() {
  const t = useTranslations("promotions");
  const router = useRouter();
  const toast = useToast();
  const q = useApiQuery(() => listPromotions({ pageSize: 100 }), []);
  const polQ = useApiQuery(() => getManualDiscountPolicy(), []);
  const [creating, setCreating] = useState(false);

  const [policy, setPolicy] = useState<ManualDiscountPolicy | null>(null);
  const [savingPol, setSavingPol] = useState(false);
  useEffect(() => { if (polQ.data) setPolicy(polQ.data); }, [polQ.data]);

  const create = async () => {
    setCreating(true);
    const res = await createPromotion({
      locationId: null, name: "New promotion", kind: "percentage_off", source: "coupon",
      percentBps: 1000, eligibility: { channels: ["counter", "online"] },
      stacking: { stackable: true, exclusive: false }, status: "inactive",
    });
    setCreating(false);
    if (res.ok) { toast.success(t("list.created")); router.push(`/promotions/${res.data.id}`); }
    else toast.error(res.error.message);
  };

  const savePolicy = async () => {
    if (!policy) return;
    setSavingPol(true);
    await updateManualDiscountPolicy(policy);
    setSavingPol(false);
    toast.success(t("policy.saved"));
    polQ.reload();
  };

  const columns: Column<Promotion>[] = [
    { key: "name", header: t("editor.name"), render: (p) => <span className="font-medium">{p.name}</span> },
    { key: "kind", header: t("editor.kind"), render: (p) => t(`kind.${p.kind}`) },
    { key: "source", header: t("editor.source"), render: (p) => (p.source === "coupon" ? t("list.coupon") : t("list.automatic")) },
    { key: "status", header: t("editor.status"), render: (p) => <StatusPill status={p.status} /> },
  ];

  return (
    <PageShell
      title={t("list.title")}
      description={t("list.description")}
      actions={<Button icon={<Plus size={16} strokeWidth={1.5} />} loading={creating} onClick={create}>{t("list.new")}</Button>}
    >
      <div className="flex flex-col gap-major">
        {/* Cashier discount policy */}
        <section className="card-surface p-major">
          <h2 className="type-h2 text-base">{t("policy.title")}</h2>
          <p className="mb-section text-[13px] text-faint">{t("policy.description")}</p>
          {policy && (
            <div className="flex flex-wrap items-end gap-section">
              <div className="w-40">
                <FormField label={t("policy.maxPercent")} variant="number" value={String(policy.maxPercentBps / 100)} onChange={(e) => setPolicy({ ...policy, maxPercentBps: Math.round((parseFloat(e.target.value) || 0) * 100) })} />
              </div>
              <label className="flex h-11 items-center gap-inline text-[13px]">
                <input type="checkbox" checked={policy.requireReason} onChange={(e) => setPolicy({ ...policy, requireReason: e.target.checked })} className="h-4 w-4 accent-ember" />
                {t("policy.requireReason")}
              </label>
              <Button size="sm" loading={savingPol} onClick={savePolicy}>{t("policy.save")}</Button>
            </div>
          )}
        </section>

        {/* Promotions list */}
        {q.loading || (q.data?.data.length ?? 0) > 0 ? (
          <DataTable columns={columns} rows={q.data?.data ?? []} getRowId={(p) => p.id} loading={q.loading} onRowClick={(p) => router.push(`/promotions/${p.id}`)} />
        ) : (
          <EmptyState title={t("list.empty")} action={<Button onClick={create}>{t("list.new")}</Button>} />
        )}
      </div>
    </PageShell>
  );
}
