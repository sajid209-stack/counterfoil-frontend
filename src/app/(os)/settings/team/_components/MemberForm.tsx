"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, useToast } from "@/components/ui";
import {
  createStaff,
  generatePin,
  passwordIssue,
  pinIssue,
  updateStaff,
  type Counter,
  type Location,
  type Role,
  type Staff,
  type StaffInput,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { CreateBar, SaveBar, SettingRow, SettingsSection, controlCls } from "../../_components/SettingsKit";
import { SecretInput, StrengthMeter, usePasswordMessage, usePinMessage } from "./PasswordFields";
import { RolePicker } from "./RolePicker";
import { WorkplacePicker } from "./WorkplacePicker";

interface Draft {
  name: string;
  email: string;
  phone: string;
  roleId: string;
  locationIds: string[];
  counterIds: string[];
  /** How a new person gets in: an invite link, or a password set now. Create only. */
  signIn: "link" | "password";
  /** Held only while the form is open; sent to the api once and then dropped. */
  password: string;
  confirm: string;
  mustChange: boolean;
  pin: string;
}

const NO_SECRETS = { signIn: "link", password: "", confirm: "", mustChange: true, pin: "" } as const;

const fromStaff = (s: Staff): Draft => ({
  ...NO_SECRETS,
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
  after,
}: {
  mode: "create" | "edit";
  staff?: Staff;
  roles: Role[];
  locations: Location[];
  counters: Counter[];
  staffCounts: Record<string, number>;
  onSaved?: (s: Staff) => void;
  /** Sections that follow the details and sit above the Save bar — on a record
   *  page, access and devices: what is done to the person rather than what is
   *  written about them. */
  after?: React.ReactNode;
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
      ...NO_SECRETS,
    };
  }, [staff, roles, locations]);

  const [base, setBase] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [blurred, setBlurred] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const sayPassword = usePasswordMessage();
  const sayPin = usePinMessage();
  const modeName = useId();
  const mustId = useId();
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
  /* How they sign in, create only. Each refusal says what is wrong beside the
     field once it has been left, and the button waits until all of it is fine. */
  const usingPassword = mode === "create" && form.signIn === "password";
  const pwIssue = usingPassword ? passwordIssue(form.password, form) : null;
  const pwErr = usingPassword && blurred.password ? sayPassword(pwIssue) : undefined;
  const confirmErr =
    usingPassword && (form.confirm ? form.confirm !== form.password : blurred.confirm)
      ? t("team.pwMismatch")
      : undefined;
  const pinIss = mode === "create" && form.pin ? pinIssue(form.pin) : null;
  const pinErr = blurred.pin ? sayPin(pinIss) : undefined;
  const secretsBad = usingPassword ? !!pwIssue || form.confirm !== form.password || !!pinIss : !!pinIss;
  const invalid = !form.name.trim() || !hasContact || emailBad || (mode === "create" && secretsBad);

  const submit = async () => {
    setBlurred((b) => ({ ...b, password: true, confirm: true, pin: true }));
    if (invalid) return;
    setSaving(true);
    const input: StaffInput = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      roleId: form.roleId,
      locationIds: form.locationIds,
      counterIds: form.counterIds,
      // Someone given a password now can sign in now; an invite waits to be accepted.
      status: staff?.status ?? (usingPassword ? "active" : "invited"),
    };
    const res =
      mode === "create"
        ? await createStaff(input, {
            ...(usingPassword ? { password: form.password, mustChangePassword: form.mustChange } : {}),
            ...(form.pin ? { pin: form.pin } : {}),
          })
        : await updateStaff(staff!.id, input);
    setSaving(false);
    if (!res.ok) {
      const first = res.error.fieldErrors ? Object.values(res.error.fieldErrors)[0] : undefined;
      toast.error(first ?? res.error.message);
      return;
    }
    if (mode === "create") {
      // What happens next depends on what was chosen, and the message says it.
      toast.success(
        usingPassword
          ? t(form.mustChange ? "team.addedPasswordToast" : "team.addedPasswordKeepToast", { name: res.data.name })
          : t("team.invitedToast", { name: res.data.name }),
      );
      setDraft(null);
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
              placeholder={t("team.namePlaceholder")}
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
              placeholder={t("team.emailPlaceholder")}
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
              placeholder={t("team.phonePlaceholder")}
              onChange={(e) => set({ phone: e.target.value })}
              onBlur={() => blur("phone")}
              aria-describedby={describedBy}
              className={controlCls()}
            />
          )}
        </SettingRow>
      </SettingsSection>

      {mode === "create" && (
        <SettingsSection title={t("team.signInTitle")} description={t("team.signInDesc")}>
          <div role="radiogroup" aria-label={t("team.signInGroup")} className="flex flex-col gap-tight px-card py-section">
            {(["link", "password"] as const).map((v) => {
              const checked = form.signIn === v;
              return (
                <label
                  key={v}
                  className={cn(
                    "flex cursor-pointer items-start gap-comfortable rounded-sm p-comfortable transition-colors duration-quick",
                    checked ? "bg-card ring-2 ring-inset ring-ember-solid" : "bg-muted-wash/70 hover:bg-muted-wash",
                  )}
                >
                  <input
                    type="radio"
                    name={modeName}
                    value={v}
                    checked={checked}
                    onChange={() => set({ signIn: v })}
                    className="mt-[3px] h-4 w-4 shrink-0 accent-ember"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-fg">{t(v === "link" ? "team.signInLink" : "team.signInPassword")}</span>
                    <span className="mt-inline block text-[13px] leading-relaxed text-muted">
                      {t(v === "link" ? "team.signInLinkNote" : "team.signInPasswordNote")}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {usingPassword && (
            <>
              <SettingRow label={t("team.pwLabel")} description={t("team.pwHint")} error={pwErr}>
                {({ id, describedBy }) => (
                  <>
                    <SecretInput
                      id={id}
                      value={form.password}
                      onChange={(password) => set({ password })}
                      onBlur={() => blur("password")}
                      show={showPw}
                      onToggleShow={() => setShowPw((s) => !s)}
                      invalid={!!pwErr}
                      describedBy={describedBy}
                      showLabel={t("team.pwShow")}
                      hideLabel={t("team.pwHide")}
                    />
                    <StrengthMeter password={form.password} />
                  </>
                )}
              </SettingRow>
              <SettingRow label={t("team.pwConfirmLabel")} error={confirmErr}>
                {({ id, describedBy }) => (
                  <input
                    id={id}
                    type={showPw ? "text" : "password"}
                    value={form.confirm}
                    onChange={(e) => set({ confirm: e.target.value })}
                    onBlur={() => blur("confirm")}
                    autoComplete="new-password"
                    spellCheck={false}
                    aria-invalid={!!confirmErr || undefined}
                    aria-describedby={describedBy}
                    className={controlCls(!!confirmErr)}
                  />
                )}
              </SettingRow>
              <div className="px-card py-section">
                <label htmlFor={mustId} className="flex min-h-11 cursor-pointer items-start gap-comfortable text-sm text-fg">
                  <input
                    id={mustId}
                    type="checkbox"
                    checked={form.mustChange}
                    onChange={(e) => set({ mustChange: e.target.checked })}
                    className="mt-[3px] h-4 w-4 shrink-0 accent-ember"
                  />
                  <span>{t("team.pwMustChange")}</span>
                </label>
                <p className="mt-tight text-[13px] leading-relaxed text-muted">{t("team.pwSafe")}</p>
              </div>
            </>
          )}

          <SettingRow label={t("team.pinLabel")} description={t("team.pinHint")} error={pinErr}>
            {({ id, describedBy }) => (
              <div className="flex flex-col gap-tight sm:flex-row">
                <div className="min-w-0 flex-1">
                  <SecretInput
                    id={id}
                    value={form.pin}
                    onChange={(v) => set({ pin: v.replace(/\D/g, "").slice(0, 6) })}
                    onBlur={() => blur("pin")}
                    show={showPin}
                    onToggleShow={() => setShowPin((s) => !s)}
                    invalid={!!pinErr}
                    describedBy={describedBy}
                    showLabel={t("team.pinShow")}
                    hideLabel={t("team.pinHide")}
                    autoComplete="off"
                    inputMode="numeric"
                    maxLength={6}
                    mono
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    set({ pin: generatePin(4) });
                    setShowPin(true);
                    setBlurred((b) => ({ ...b, pin: false }));
                  }}
                >
                  {t("team.pinGenerate")}
                </Button>
              </div>
            )}
          </SettingRow>
        </SettingsSection>
      )}

      <SettingsSection
        title={t("common.role")}
        description={t("team.roleDesc")}
        aside={
          <Link
            href="/settings/roles"
            className="-ml-tight inline-flex min-h-11 items-center rounded-sm px-tight text-[13px] font-medium text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg sm:ml-0 md:min-h-9"
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

      {after}

      {mode === "create" ? (
        <CreateBar
          dirty={!!draft}
          invalid={invalid}
          saving={saving}
          note={usingPassword ? t("team.addPasswordNote") : t("team.inviteNote")}
          invalidNote={!form.name.trim() || !hasContact || emailBad ? t("team.inviteInvalid") : t("team.addInvalidSecrets")}
          submitLabel={usingPassword ? t("team.addMember") : t("team.sendInvite")}
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
