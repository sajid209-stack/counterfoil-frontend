"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, FormField, useToast } from "@/components/ui";
import {
  createCounter,
  updateCounter,
  type Counter,
  type CounterInput,
  type Location,
  type PaymentMethod,
  type Product,
} from "@/lib/api";

interface FormState {
  name: string;
  locationId: string;
  allowAll: boolean;
  allowedProductIds: string[];
  payments: PaymentMethod[];
  active: boolean;
}

const fromCounter = (c: Counter): FormState => ({
  name: c.name,
  locationId: c.locationId,
  allowAll: c.allowedProductIds === "all",
  allowedProductIds: c.allowedProductIds === "all" ? [] : c.allowedProductIds,
  payments: c.allowedPaymentMethods,
  active: c.status !== "inactive",
});

export function CounterForm({
  mode,
  counter,
  locations,
  products,
}: {
  mode: "create" | "edit";
  counter?: Counter;
  locations: Location[];
  products: Product[];
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("settings");
  const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
    { value: "cash", label: t("counters.methodCash") },
    { value: "card_terminal", label: t("counters.methodCardTerminal") },
    { value: "bkash", label: t("counters.methodBkash") },
    { value: "bangla_qr", label: t("counters.methodBanglaQr") },
    { value: "voucher", label: t("counters.methodVoucher") },
    { value: "credit", label: t("counters.methodCredit") },
  ];
  const initial = useMemo<FormState>(
    () =>
      counter
        ? fromCounter(counter)
        : {
            name: "",
            locationId: locations[0]?.id ?? "",
            allowAll: true,
            allowedProductIds: [],
            payments: ["cash"],
            active: true,
          },
    [counter, locations],
  );
  const [state, setState] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(initial), [state, initial]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setState((s) => ({ ...s, [k]: v }));
  const togglePayment = (m: PaymentMethod) =>
    set("payments", state.payments.includes(m) ? state.payments.filter((x) => x !== m) : [...state.payments, m]);
  const toggleProduct = (id: string) =>
    set("allowedProductIds", state.allowedProductIds.includes(id) ? state.allowedProductIds.filter((x) => x !== id) : [...state.allowedProductIds, id]);

  const save = async () => {
    setSaving(true);
    setErrors({});
    const input: CounterInput = {
      name: state.name,
      locationId: state.locationId,
      allowedProductIds: state.allowAll ? "all" : state.allowedProductIds,
      allowedPaymentMethods: state.payments,
      status: state.active ? "active" : "inactive",
    };
    const res = mode === "create" ? await createCounter(input) : await updateCounter(counter!.id, input);
    setSaving(false);
    if (res.ok) {
      toast.success(mode === "create" ? t("counters.created") : t("common.changesSaved"));
      if (mode === "create") router.push(`/settings/counters/${res.data.id}`);
      else setState(fromCounter(res.data));
    } else if (res.error.code === "validation" && res.error.fieldErrors) {
      setErrors(res.error.fieldErrors);
      toast.error(res.error.message);
    } else {
      toast.error(res.error.message);
    }
  };

  return (
    <div className="flex flex-col gap-section pb-hero">
      <div className="card-surface p-major">
        <h2 className="type-h2 mb-section text-base">{t("common.details")}</h2>
        <div className="grid gap-section sm:grid-cols-2">
          <FormField label={t("common.name")} required value={state.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
          <FormField
            label={t("common.location")}
            variant="select"
            value={state.locationId}
            onChange={(e) => set("locationId", e.target.value)}
            options={locations.map((l) => ({ value: l.id, label: l.name }))}
            error={errors.locationId}
          />
          <FormField
            label={t("common.active")}
            variant="toggle"
            checked={state.active}
            onChange={(e) => set("active", (e.target as HTMLInputElement).checked)}
          />
        </div>
      </div>

      <div className="card-surface p-major">
        <h2 className="type-h2 mb-section text-base">{t("counters.paymentMethods")}</h2>
        <div className="grid grid-cols-2 gap-tight sm:grid-cols-3">
          {PAYMENT_METHODS.map((m) => (
            <label key={m.value} className="flex cursor-pointer items-center gap-tight text-sm">
              <input type="checkbox" checked={state.payments.includes(m.value)} onChange={() => togglePayment(m.value)} className="h-4 w-4 accent-ember" />
              {m.label}
            </label>
          ))}
        </div>
      </div>

      <div className="card-surface p-major">
        <h2 className="type-h2 mb-section text-base">{t("counters.allowedProducts")}</h2>
        <FormField
          label={t("counters.allowAll")}
          variant="toggle"
          checked={state.allowAll}
          onChange={(e) => set("allowAll", (e.target as HTMLInputElement).checked)}
        />
        {!state.allowAll && (
          <div className="mt-section grid grid-cols-1 gap-tight sm:grid-cols-2">
            {products.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-tight text-sm">
                <input type="checkbox" checked={state.allowedProductIds.includes(p.id)} onChange={() => toggleProduct(p.id)} className="h-4 w-4 accent-ember" />
                {p.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 max-md:bottom-[calc(56px+env(safe-area-inset-bottom))] flex items-center justify-end gap-tight border-t border-line bg-surface py-section">
        <Button variant="secondary" onClick={() => router.push("/settings/counters")} disabled={saving}>{t("common.cancel")}</Button>
        <Button onClick={save} loading={saving} disabled={!dirty && mode === "edit"}>
          {mode === "create" ? t("counters.createCounter") : t("common.saveChanges")}
        </Button>
      </div>
    </div>
  );
}
