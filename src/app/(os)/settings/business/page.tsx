"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, FormField, PageShell, useToast } from "@/components/ui";
import { AppearancePicker } from "@/components/ThemeProvider";
import { getOperator, updateOperator, type Operator } from "@/lib/api";

const CURRENCIES = ["BDT", "MYR", "USD", "CAD"];
const TIMEZONES = ["Asia/Dhaka", "Asia/Kuala_Lumpur", "America/New_York", "America/Toronto"];

interface FormState {
  name: string;
  currency: string;
  defaultTimezone: string;
  taxRatePct: string;
}

const fromOperator = (o: Operator): FormState => ({
  name: o.name,
  currency: o.currency,
  defaultTimezone: o.defaultTimezone,
  taxRatePct: String(o.taxRatePct),
});

export default function BusinessSetupPage() {
  const toast = useToast();
  const [state, setState] = useState<FormState | null>(null);
  const [initial, setInitial] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOperator().then((res) => {
      if (res.ok) {
        const s = fromOperator(res.data);
        setState(s);
        setInitial(s);
      }
    });
  }, []);

  const dirty = useMemo(
    () => !!state && !!initial && JSON.stringify(state) !== JSON.stringify(initial),
    [state, initial],
  );

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setState((s) => (s ? { ...s, [k]: v } : s));

  const save = async () => {
    if (!state) return;
    setSaving(true);
    const res = await updateOperator({
      name: state.name,
      currency: state.currency,
      defaultTimezone: state.defaultTimezone,
      taxRatePct: parseFloat(state.taxRatePct) || 0,
    });
    setSaving(false);
    if (res.ok) {
      const s = fromOperator(res.data);
      setState(s);
      setInitial(s);
      toast.success("Business settings saved.");
    } else {
      toast.error(res.error.message);
    }
  };

  return (
    <PageShell title="Business setup" description="Operator identity, currency, timezone, and tax.">
      {!state ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : (
        <div className="flex max-w-2xl flex-col gap-section pb-hero">
          <div className="rounded-md border border-line bg-card p-major">
            <h2 className="type-h2 mb-section text-base">Identity</h2>
            <div className="grid gap-section sm:grid-cols-2">
              <FormField label="Business name" value={state.name} onChange={(e) => set("name", e.target.value)} className="sm:col-span-2" />
              <div className="flex flex-col gap-tight">
                <span className="type-label text-[12px] text-muted">Logo</span>
                <div className="flex h-20 items-center justify-center rounded-sm border border-dashed border-line text-[12px] text-faint">
                  Two-colour logo — upload is a follow-up
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-line bg-card p-major">
            <h2 className="type-h2 mb-section text-base">Regional</h2>
            <div className="grid gap-section sm:grid-cols-3">
              <FormField
                label="Currency"
                variant="select"
                value={state.currency}
                onChange={(e) => set("currency", e.target.value)}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
              <FormField
                label="Timezone"
                variant="select"
                value={state.defaultTimezone}
                onChange={(e) => set("defaultTimezone", e.target.value)}
                options={TIMEZONES.map((t) => ({ value: t, label: t }))}
              />
              <FormField label="Tax rate (%)" variant="number" value={state.taxRatePct} onChange={(e) => set("taxRatePct", e.target.value)} />
            </div>
          </div>

          <div className="rounded-md border border-line bg-card p-major">
            <h2 className="type-h2 mb-section text-base">Appearance</h2>
            <AppearancePicker className="max-w-sm" />
            <p className="mt-tight text-[12px] text-faint">Per user, on this browser. Scan screens and printed tickets keep their designed look in both modes.</p>
          </div>

          <div className="sticky bottom-0 flex items-center justify-end gap-tight border-t border-line bg-surface py-section">
            <Button onClick={save} loading={saving} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
