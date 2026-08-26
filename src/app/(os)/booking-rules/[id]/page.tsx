"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, FormField, PageShell, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  archiveBookingRule,
  createBookingRule,
  getBookingRule,
  listLocations,
  listProducts,
  updateBookingRule,
} from "@/lib/api";
import type { BookingRuleInput } from "@/lib/api";

const BLANK: BookingRuleInput = {
  name: "", productId: null, locationId: null, capacity: 20, slotMinutes: 60,
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6], blackoutDates: [], status: "active",
};

export default function BookingRuleEditorPage() {
  const t = useTranslations("bookingRules");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const isNew = params.id === "new";

  const ruleQ = useApiQuery(() => (isNew ? Promise.resolve({ ok: true as const, data: null }) : getBookingRule(params.id)), [params.id]);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);

  const [form, setForm] = useState<BookingRuleInput>(BLANK);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew && ruleQ.data) {
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = ruleQ.data;
      void _id; void _c; void _u;
      setForm(rest);
    }
  }, [isNew, ruleQ.data]);

  if (!isNew && !ruleQ.loading && !ruleQ.data) {
    return <PageShell title={t("back")}><EmptyState title={t("notFound")} action={<Button onClick={() => router.push("/booking-rules")}>{t("back")}</Button>} /></PageShell>;
  }

  const set = <K extends keyof BookingRuleInput>(k: K, v: BookingRuleInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleDay = (d: number) => set("daysOfWeek", form.daysOfWeek.includes(d) ? form.daysOfWeek.filter((x) => x !== d) : [...form.daysOfWeek, d].sort());

  const save = async () => {
    setSaving(true);
    const res = isNew ? await createBookingRule(form) : await updateBookingRule(params.id, form);
    setSaving(false);
    if (res.ok) { toast.success(isNew ? t("created") : t("saved")); router.push("/booking-rules"); }
    else toast.error(res.error.message);
  };
  const archive = async () => { await archiveBookingRule(params.id); toast.success(t("archived")); router.push("/booking-rules"); };

  const products = productsQ.data?.data ?? [];
  const locations = locationsQ.data?.data ?? [];

  return (
    <PageShell
      title={isNew ? t("newRule") : (form.name || t("editRule"))}
      actions={<Button loading={saving} onClick={save}>{t("save")}</Button>}
    >
      <button type="button" onClick={() => router.push("/booking-rules")} className="mb-section flex items-center gap-inline text-[13px] text-muted hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("back")}
      </button>

      <div className="grid max-w-2xl gap-section rounded-md border border-line bg-card p-major sm:grid-cols-2">
        <FormField label={t("fieldName")} value={form.name} onChange={(e) => set("name", e.target.value)} className="sm:col-span-2" />
        <FormField label={t("fieldProduct")} variant="select" value={form.productId ?? ""} onChange={(e) => set("productId", e.target.value || null)} options={[{ value: "", label: t("allProducts") }, ...products.map((p) => ({ value: p.id, label: p.name }))]} />
        <FormField label={t("fieldLocation")} variant="select" value={form.locationId ?? ""} onChange={(e) => set("locationId", e.target.value || null)} options={[{ value: "", label: t("allLocations") }, ...locations.map((l) => ({ value: l.id, label: l.name }))]} />
        <FormField label={t("fieldCapacity")} variant="number" value={String(form.capacity)} onChange={(e) => set("capacity", Math.max(0, parseInt(e.target.value) || 0))} />
        <FormField label={t("fieldSlot")} variant="number" value={String(form.slotMinutes)} onChange={(e) => set("slotMinutes", Math.max(1, parseInt(e.target.value) || 1))} />
        <FormField label={t("fieldStatus")} variant="select" value={form.status} onChange={(e) => set("status", e.target.value as BookingRuleInput["status"])} options={[{ value: "active", label: t("statusActive") }, { value: "inactive", label: t("statusInactive") }]} />
        <div className="sm:col-span-2">
          <span className="type-label mb-tight block text-[12px] text-muted">{t("fieldDays")}</span>
          <div className="flex flex-wrap gap-inline">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <button key={d} type="button" onClick={() => toggleDay(d)} className={`h-10 min-w-12 rounded-sm border px-comfortable text-[13px] ${form.daysOfWeek.includes(d) ? "border-ember bg-ember/5 font-medium" : "border-line"}`}>{t(`day.${d}` as never)}</button>
            ))}
          </div>
        </div>
      </div>

      {!isNew && (
        <Button variant="secondary" className="mt-section" onClick={archive}>{t("archive")}</Button>
      )}
    </PageShell>
  );
}
