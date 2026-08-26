"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, FormField, useToast } from "@/components/ui";
import { useEnumLabels } from "@/lib/labels";
import {
  createStaff,
  updateStaff,
  type Counter,
  type Location,
  type Role,
  type Staff,
  type StaffInput,
  type StaffStatus,
} from "@/lib/api";

const STATUSES: StaffStatus[] = ["invited", "active", "suspended"];

interface FormState {
  name: string;
  email: string;
  phone: string;
  roleId: string;
  locationIds: string[];
  counterIds: string[];
  status: StaffStatus;
}

const fromStaff = (s: Staff): FormState => ({
  name: s.name,
  email: s.email ?? "",
  phone: s.phone ?? "",
  roleId: s.roleId,
  locationIds: s.locationIds,
  counterIds: s.counterIds,
  status: s.status,
});

export function StaffForm({
  mode,
  staff,
  roles,
  locations,
  counters,
}: {
  mode: "create" | "edit";
  staff?: Staff;
  roles: Role[];
  locations: Location[];
  counters: Counter[];
}) {
  const router = useRouter();
  const t = useTranslations("settings");
  const enumL = useEnumLabels();
  const toast = useToast();
  const initial = useMemo<FormState>(
    () =>
      staff
        ? fromStaff(staff)
        : { name: "", email: "", phone: "", roleId: roles[0]?.id ?? "", locationIds: [], counterIds: [], status: "invited" },
    [staff, roles],
  );
  const [state, setState] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(initial), [state, initial]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setState((s) => ({ ...s, [k]: v }));
  const toggle = (key: "locationIds" | "counterIds", id: string) =>
    set(key, state[key].includes(id) ? state[key].filter((x) => x !== id) : [...state[key], id]);

  const save = async () => {
    setSaving(true);
    setErrors({});
    const input: StaffInput = {
      name: state.name,
      email: state.email.trim() || null,
      phone: state.phone.trim() || null,
      roleId: state.roleId,
      locationIds: state.locationIds,
      counterIds: state.counterIds,
      status: state.status,
    };
    const res = mode === "create" ? await createStaff(input) : await updateStaff(staff!.id, input);
    setSaving(false);
    if (res.ok) {
      toast.success(mode === "create" ? t("team.added") : t("common.changesSaved"));
      if (mode === "create") router.push(`/settings/team/${res.data.id}`);
      else setState(fromStaff(res.data));
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
          <FormField label={t("common.name")} required value={state.name} onChange={(e) => set("name", e.target.value)} error={errors.name} className="sm:col-span-2" />
          <FormField label={t("team.email")} variant="email" value={state.email} onChange={(e) => set("email", e.target.value)} error={errors.email} help={t("team.emailOrPhoneHelp")} />
          <FormField label={t("team.phone")} value={state.phone} onChange={(e) => set("phone", e.target.value)} />
          <FormField
            label={t("common.role")}
            variant="select"
            value={state.roleId}
            onChange={(e) => set("roleId", e.target.value)}
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
          />
          <FormField
            label={t("common.status")}
            variant="select"
            value={state.status}
            onChange={(e) => set("status", e.target.value as StaffStatus)}
            options={STATUSES.map((s) => ({ value: s, label: enumL.status(s) }))}
          />
        </div>
      </div>

      <div className="grid gap-section sm:grid-cols-2">
        <div className="card-surface p-major">
          <h2 className="type-h2 mb-section text-base">{t("team.locations")}</h2>
          <div className="flex flex-col gap-tight">
            {locations.map((l) => (
              <label key={l.id} className="flex cursor-pointer items-center gap-tight text-sm">
                <input type="checkbox" checked={state.locationIds.includes(l.id)} onChange={() => toggle("locationIds", l.id)} className="h-4 w-4 accent-ember" />
                {l.name}
              </label>
            ))}
          </div>
        </div>
        <div className="card-surface p-major">
          <h2 className="type-h2 mb-section text-base">{t("team.counters")}</h2>
          <div className="flex flex-col gap-tight">
            {counters.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-tight text-sm">
                <input type="checkbox" checked={state.counterIds.includes(c.id)} onChange={() => toggle("counterIds", c.id)} className="h-4 w-4 accent-ember" />
                {c.name}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 max-md:bottom-[calc(56px+env(safe-area-inset-bottom))] flex items-center justify-end gap-tight border-t border-line bg-surface py-section">
        <Button variant="secondary" onClick={() => router.push("/settings/team")} disabled={saving}>{t("common.cancel")}</Button>
        <Button onClick={save} loading={saving} disabled={!dirty && mode === "edit"}>
          {mode === "create" ? t("team.addStaff") : t("common.saveChanges")}
        </Button>
      </div>
    </div>
  );
}
