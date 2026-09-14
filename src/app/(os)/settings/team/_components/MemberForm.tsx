"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui";
import { createStaff, updateStaff, type Counter, type Location, type Role, type Staff, type StaffInput } from "@/lib/api";
import { CreateBar, SaveBar, SettingRow, SettingsSection, controlCls } from "../../_components/SettingsKit";
import { RolePicker } from "./RolePicker";
import { WorkplacePicker } from "./WorkplacePicker";

interface Draft {
  name: string;
  email: string;
  phone: string;
  roleId: string;
  locationIds: string[];
  counterIds: string[];
}

const fromStaff = (s: Staff): Draft => ({
  name: s.name,
  email: s.email ?? "",
  phone: s.phone ?? "",
  roleId: s.roleId,
  locationIds: s.locationIds,
  counterIds: s.counterIds,
});

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Inviting someone, and editing them afterwards — one form, three questions.
 *
 * Who they are, what they can do, where they work. The role is chosen in the
 * same step as the invite, so access is scoped from the first click rather than
 * provisioned broad and narrowed later; and a new invite starts on the role that
 * can do the least, because the safe mistake is someone who has to ask for more.
 */
export function MemberForm({
  mode,
  staff,
  roles,
  locations,
  counters,
  staffCounts,
  onSaved,
}: {
  mode: "create" | "edit";
  staff?: Staff;
  roles: Role[];
  locations: Location[];
  counters: Counter[];
  staffCounts: Record<string, number>;
  onSaved?: (s: Staff) => void;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const toast = useToast();

  const initial = useMemo<Draft>(() => {
    if (staff) return fromStaff(staff);
    const leastPowerful = [...roles].sort((a, b) => a.permissions.length - b.permissions.length)[0];
    const places = locations.filter((l) => l.status === "active");
    return {
      name: "",
      email: "",
      phone: "",
      roleId: leastPowerful?.id ?? "",
      locationIds: places.length === 1 ? [places[0].id] : [],
      counterIds: [],
    };
  }, [staff, roles, locations]);

  const [base, setBase] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [blurred, setBlurred] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const saved = base ?? initial;
  const form = draft ?? saved;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch: Partial<Draft>) => setDraft({ ...form, ...patch });
  const blur = (field: string) => setBlurred((b) => ({ ...b, [field]: true }));

  // Errors wait for the field to be left (or for there to be a saved record to
  // compare against): a blank invite form that opens already red is shouting at
  // someone who has not typed yet.
  const judge = mode === "edit";
  const hasContact = !!form.email.trim() || !!form.phone.trim();
  const emailBad = !!form.email.trim() && !EMAIL.test(form.email.trim());
  const nameErr = (judge || blurred.name) && !form.name.trim() ? t("team.nameRequired") : undefined;
  const contactErr =
    (judge || blurred.email) && emailBad
      ? t("team.emailInvalid")
      : (judge || (blurred.email && blurred.phone)) && !hasContact
        ? t("team.contactRequired")
        : undefined;
  const invalid = !form.name.trim() || !hasContact || emailBad;

  const submit = async () => {
    setSaving(true);
    const input: StaffInput = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      roleId: form.roleId,
      locationIds: form.locationIds,
      counterIds: form.counterIds,
      status: staff?.status ?? "invited",
    };
    const res = mode === "create" ? await createStaff(input) : await updateStaff(staff!.id, input);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    if (mode === "create") {
      toast.success(t("team.invitedToast", { name: res.data.name }));
      router.push(`/settings/team/${res.data.id}`);
      return;
    }
    setBase(fromStaff(res.data));
    setDraft(null);
    setBlurred({});
    onSaved?.(res.data);
    toast.success(t("common.changesSaved"));
  };

  return (
    <div className="flex max-w-3xl flex-col gap-section pb-hero">
      <SettingsSection title={t("team.profileTitle")} description={mode === "create" ? t("team.profileDescNew") : t("team.profileDesc")}>
        <SettingRow label={t("common.name")} error={nameErr}>
          {({ id, describedBy }) => (
            <input
              id={id}
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              onBlur={() => blur("name")}
              autoComplete="off"
              aria-invalid={!!nameErr || undefined}
              aria-describedby={describedBy}
              className={controlCls(!!nameErr)}
            />
          )}
        </SettingRow>
        <SettingRow label={t("team.email")} description={t("team.emailDesc")} error={contactErr}>
          {({ id, describedBy }) => (
            <input
              id={id}
              type="email"
              inputMode="email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              onBlur={() => blur("email")}
              aria-invalid={!!contactErr || undefined}
              aria-describedby={describedBy}
              className={controlCls(!!contactErr)}
            />
          )}
        </SettingRow>
        <SettingRow label={t("team.phone")} description={t("team.phoneDesc")}>
          {({ id, describedBy }) => (
            <input
              id={id}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value })}
              onBlur={() => blur("phone")}
              aria-describedby={describedBy}
              className={controlCls()}
            />
          )}
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        title={t("common.role")}
        description={t("team.roleDesc")}
        aside={
          <Link
            href="/settings/roles"
            className="inline-flex min-h-11 items-center rounded-sm px-tight text-[13px] font-medium text-muted transition-colors duration-quick hover:bg-subtle/60 hover:text-fg md:min-h-9"
          >
            {t("team.manageRoles")}
          </Link>
        }
      >
        <RolePicker roles={roles} value={form.roleId} onChange={(roleId) => set({ roleId })} staffCounts={staffCounts} />
      </SettingsSection>

      <SettingsSection title={t("team.whereTitle")} description={t("team.whereDesc")}>
        <WorkplacePicker
          locations={locations}
          counters={counters}
          locationIds={form.locationIds}
          counterIds={form.counterIds}
          onChange={(locationIds, counterIds) => set({ locationIds, counterIds })}
          warnEmpty={mode === "edit" || !!draft}
        />
      </SettingsSection>

      {mode === "create" ? (
        <CreateBar
          dirty={!!draft}
          invalid={invalid}
          saving={saving}
          note={t("team.inviteNote")}
          invalidNote={t("team.inviteInvalid")}
          submitLabel={t("team.sendInvite")}
          onSubmit={submit}
          onCancel={() => router.push("/settings/team")}
        />
      ) : (
        <SaveBar
          dirty={dirty}
          saving={saving}
          invalid={invalid}
          onSave={submit}
          onDiscard={() => {
            setDraft(null);
            setBlurred({});
          }}
        />
      )}
    </div>
  );
}
