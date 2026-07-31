"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, useToast } from "@/components/ui";
import { createRole, updateRole, type Role, type RoleInput } from "@/lib/api";

const PERMISSIONS: { value: string; label: string }[] = [
  { value: "products.manage", label: "Manage products" },
  { value: "pricing.manage", label: "Manage pricing" },
  { value: "bookings.manage", label: "Manage bookings" },
  { value: "orders.view", label: "View orders" },
  { value: "orders.refund", label: "Refund orders" },
  { value: "reports.view", label: "View reports" },
  { value: "pos.sell", label: "Sell at POS" },
  { value: "scan.validate", label: "Scan & validate" },
  { value: "staff.manage", label: "Manage staff" },
  { value: "settings.manage", label: "Manage settings" },
];

interface FormState {
  name: string;
  permissions: string[];
  refundUnlimited: boolean;
  refundLimit: string;
  discountUnlimited: boolean;
  discountLimitPct: string;
}

const fromRole = (r: Role): FormState => ({
  name: r.name,
  permissions: r.permissions,
  refundUnlimited: r.refundLimit == null,
  refundLimit: r.refundLimit != null ? (r.refundLimit / 100).toFixed(2) : "",
  discountUnlimited: r.discountLimitPct == null,
  discountLimitPct: r.discountLimitPct != null ? String(r.discountLimitPct) : "",
});

export function RoleForm({ mode, role }: { mode: "create" | "edit"; role?: Role }) {
  const router = useRouter();
  const toast = useToast();
  const initial = useMemo<FormState>(
    () =>
      role
        ? fromRole(role)
        : { name: "", permissions: [], refundUnlimited: false, refundLimit: "", discountUnlimited: false, discountLimitPct: "" },
    [role],
  );
  const [state, setState] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(initial), [state, initial]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setState((s) => ({ ...s, [k]: v }));
  const togglePerm = (p: string) =>
    set("permissions", state.permissions.includes(p) ? state.permissions.filter((x) => x !== p) : [...state.permissions, p]);

  const save = async () => {
    setSaving(true);
    setErrors({});
    const input: RoleInput = {
      name: state.name,
      permissions: state.permissions,
      refundLimit: state.refundUnlimited ? null : Math.round((parseFloat(state.refundLimit) || 0) * 100),
      discountLimitPct: state.discountUnlimited ? null : parseInt(state.discountLimitPct || "0", 10),
    };
    const res = mode === "create" ? await createRole(input) : await updateRole(role!.id, input);
    setSaving(false);
    if (res.ok) {
      toast.success(mode === "create" ? "Role created." : "Changes saved.");
      if (mode === "create") router.push(`/settings/roles/${res.data.id}`);
      else setState(fromRole(res.data));
    } else if (res.error.code === "validation" && res.error.fieldErrors) {
      setErrors(res.error.fieldErrors);
      toast.error(res.error.message);
    } else {
      toast.error(res.error.message);
    }
  };

  return (
    <div className="flex flex-col gap-section pb-hero">
      <div className="rounded-md border border-line bg-card p-major">
        <h2 className="type-h2 mb-section text-base">Details</h2>
        <FormField label="Name" required value={state.name} onChange={(e) => set("name", e.target.value)} error={errors.name} className="max-w-sm" />
      </div>

      <div className="rounded-md border border-line bg-card p-major">
        <h2 className="type-h2 mb-section text-base">Permissions</h2>
        <div className="grid grid-cols-1 gap-tight sm:grid-cols-2">
          {PERMISSIONS.map((p) => (
            <label key={p.value} className="flex cursor-pointer items-center gap-tight text-sm">
              <input type="checkbox" checked={state.permissions.includes(p.value)} onChange={() => togglePerm(p.value)} className="h-4 w-4 accent-ember" />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-line bg-card p-major">
        <h2 className="type-h2 mb-section text-base">Limits</h2>
        <div className="grid gap-section sm:grid-cols-2">
          <div className="flex flex-col gap-tight">
            <FormField
              label="Unlimited refunds"
              variant="toggle"
              checked={state.refundUnlimited}
              onChange={(e) => set("refundUnlimited", (e.target as HTMLInputElement).checked)}
            />
            {!state.refundUnlimited && (
              <FormField label="Refund limit (BDT)" variant="number" value={state.refundLimit} onChange={(e) => set("refundLimit", e.target.value)} error={errors.refundLimit} />
            )}
          </div>
          <div className="flex flex-col gap-tight">
            <FormField
              label="Unlimited discount"
              variant="toggle"
              checked={state.discountUnlimited}
              onChange={(e) => set("discountUnlimited", (e.target as HTMLInputElement).checked)}
            />
            {!state.discountUnlimited && (
              <FormField label="Discount limit (%)" variant="number" value={state.discountLimitPct} onChange={(e) => set("discountLimitPct", e.target.value)} error={errors.discountLimitPct} />
            )}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 flex items-center justify-end gap-tight border-t border-line bg-surface py-section">
        <Button variant="secondary" onClick={() => router.push("/settings/roles")} disabled={saving}>Cancel</Button>
        <Button onClick={save} loading={saving} disabled={!dirty && mode === "edit"}>
          {mode === "create" ? "Create role" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
