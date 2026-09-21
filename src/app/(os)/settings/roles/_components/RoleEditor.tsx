"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleAlert } from "lucide-react";
import { Avatar, useToast } from "@/components/ui";
import { createRole, updateRole, type Role, type RoleInput, type Staff } from "@/lib/api";
import { ALL_PERMISSIONS, PERMISSION_GROUPS, permissionKey } from "@/lib/permissions";
import { CreateBar, SaveBar, SettingRow, SettingsSection, SuffixInput, Switch, controlCls } from "../../_components/SettingsKit";

interface Draft {
  name: string;
  permissions: string[];
  /** Whole percent as typed; empty is no limit. */
  discount: string;
  /** Major units as typed; empty is no limit. */
  refund: string;
}

/** Permissions in registry order, so a toggle off and on again is not a change. */
const ordered = (ps: string[]) => [...ALL_PERMISSIONS.filter((p) => ps.includes(p)), ...ps.filter((p) => !ALL_PERMISSIONS.includes(p))];

const fromRole = (r: Role): Draft => ({
  name: r.name,
  permissions: ordered(r.permissions),
  discount: r.discountLimitPct == null ? "" : String(r.discountLimitPct),
  refund: r.refundLimit == null ? "" : String(r.refundLimit / 100),
});

const BLANK: Draft = { name: "", permissions: [], discount: "", refund: "" };
const PCT = /^\d{1,3}$/;
const AMOUNT = /^\d{1,7}(\.\d{1,2})?$/;

/** Losing one of these from your own role can shut you out of this very page. */
const LOCKOUT = new Set(["settings.manage", "staff.manage"]);

/**
 * A role: its name, who holds it, and what it allows — grouped by where the
 * work happens, each permission with a sentence saying what it lets someone do.
 *
 * The limits are not a separate "Limits" card any more. A discount cap means
 * nothing to a role that cannot sell, so it sits directly under Sell at the
 * till and appears only while that is on; the refund cap sits under Refund
 * orders the same way. Empty means no limit, which is what an unlimited
 * toggle beside an amount field was saying with two controls.
 */
export function RoleEditor({
  mode,
  role,
  members,
  isYourRole,
  onSaved,
}: {
  mode: "create" | "edit";
  role?: Role;
  members: Staff[];
  isYourRole: boolean;
  onSaved?: (r: Role) => void;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const toast = useToast();
  const initial = useMemo(() => (role ? fromRole(role) : BLANK), [role]);
  const [base, setBase] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const saved = base ?? initial;
  const form = draft ?? saved;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch: Partial<Draft>) => setDraft({ ...form, ...patch });
  const has = (p: string) => form.permissions.includes(p);
  const toggle = (p: string, on: boolean) =>
    set({ permissions: ordered(on ? [...form.permissions, p] : form.permissions.filter((x) => x !== p)) });

  const discountErr =
    form.discount !== "" && (!PCT.test(form.discount) || Number(form.discount) > 100) ? t("roles.limitInvalidPct") : undefined;
  const refundErr = form.refund !== "" && !AMOUNT.test(form.refund) ? t("roles.limitInvalidAmount") : undefined;
  const nameErr = (mode === "edit" || draft) && !form.name.trim() ? t("roles.nameRequired") : undefined;
  const invalid = !form.name.trim() || !!discountErr || !!refundErr;

  const submit = async () => {
    setSaving(true);
    const input: RoleInput = {
      name: form.name.trim(),
      permissions: form.permissions,
      discountLimitPct: form.discount === "" ? null : Number(form.discount),
      refundLimit: form.refund === "" ? null : Math.round(Number(form.refund) * 100),
    };
    const res = mode === "create" ? await createRole(input) : await updateRole(role!.id, input);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    if (mode === "create") {
      toast.success(t("roles.created"));
      router.push(`/settings/roles/${res.data.id}`);
      return;
    }
    setBase(fromRole(res.data));
    setDraft(null);
    onSaved?.(res.data);
    toast.success(t("common.changesSaved"));
  };

  return (
    <div className="flex max-w-3xl flex-col gap-section pb-hero">
      <SettingsSection title={t("roles.sectionRole")} description={t("roles.sectionRoleDesc")}>
        <SettingRow label={t("common.name")} error={nameErr}>
          {({ id, describedBy }) => (
            <input
              id={id}
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              autoComplete="off"
              aria-invalid={!!nameErr || undefined}
              aria-describedby={describedBy}
              className={controlCls(!!nameErr)}
            />
          )}
        </SettingRow>
        {mode === "edit" && (
          <SettingRow
            label={t("roles.membersLabel")}
            description={members.length === 0 ? t("roles.membersNone") : undefined}
            labelFor={false}
          >
            {() =>
              members.length > 0 ? (
                <ul className="flex flex-wrap gap-tight sm:justify-end">
                  {members.slice(0, 6).map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/settings/team/${m.id}`}
                        className="inline-flex min-h-11 items-center gap-tight rounded-full border border-line py-inline pl-inline pr-comfortable text-[13px] text-fg transition-colors duration-quick hover:bg-subtle/60 md:min-h-9"
                      >
                        <Avatar name={m.name} size={24} soft />
                        {m.name}
                      </Link>
                    </li>
                  ))}
                  {members.length > 6 && (
                    <li className="inline-flex min-h-9 items-center text-[13px] text-muted">
                      {t("roles.membersMore", { count: members.length - 6 })}
                    </li>
                  )}
                </ul>
              ) : null
            }
          </SettingRow>
        )}
      </SettingsSection>

      {PERMISSION_GROUPS.map((g) => (
        <SettingsSection key={g.key} title={t(`permGroup.${g.key}.title`)} description={t(`permGroup.${g.key}.desc`)}>
          {g.permissions.map((p) => {
            const k = permissionKey(p);
            const losingOwn = mode === "edit" && isYourRole && LOCKOUT.has(p) && saved.permissions.includes(p) && !has(p);
            return (
              <div key={p} className="divide-y divide-hairline">
                <SettingRow label={t(`perm.${k}.title`)} description={t(`perm.${k}.desc`)} labelFor={false}>
                  {({ labelId, describedBy }) => (
                    <div className="flex sm:justify-end">
                      <Switch checked={has(p)} onChange={(on) => toggle(p, on)} labelledBy={labelId} describedBy={describedBy} />
                    </div>
                  )}
                </SettingRow>
                {losingOwn && (
                  <p role="note" className="flex items-start gap-tight bg-warning-wash px-card py-tight text-[13px] text-fg">
                    <CircleAlert size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-warning" />
                    {t("roles.selfWarning")}
                  </p>
                )}
                {p === "pos.sell" && has(p) && (
                  <SettingRow label={t("roles.discountMax")} description={t("roles.discountDesc")} error={discountErr}>
                    {({ id, describedBy }) => (
                      <SuffixInput
                        id={id}
                        value={form.discount}
                        onChange={(v) => set({ discount: v })}
                        suffix="%"
                        placeholder={t("roles.noLimit")}
                        invalid={!!discountErr}
                        describedBy={describedBy}
                        inputMode="numeric"
                      />
                    )}
                  </SettingRow>
                )}
                {p === "orders.refund" && has(p) && (
                  <SettingRow label={t("roles.refundMax")} description={t("roles.refundDesc")} error={refundErr}>
                    {({ id, describedBy }) => (
                      <SuffixInput
                        id={id}
                        value={form.refund}
                        onChange={(v) => set({ refund: v })}
                        suffix="৳"
                        placeholder={t("roles.noLimit")}
                        invalid={!!refundErr}
                        describedBy={describedBy}
                      />
                    )}
                  </SettingRow>
                )}
              </div>
            );
          })}
        </SettingsSection>
      ))}

      {mode === "create" ? (
        <CreateBar
          dirty={!!draft}
          invalid={invalid}
          saving={saving}
          note={t("roles.createNote")}
          invalidNote={t("roles.createInvalid")}
          submitLabel={t("roles.createRole")}
          onSubmit={submit}
          onCancel={() => router.push("/settings/roles")}
        />
      ) : (
        <SaveBar dirty={dirty} saving={saving} invalid={invalid} onSave={submit} onDiscard={() => setDraft(null)} />
      )}
    </div>
  );
}
