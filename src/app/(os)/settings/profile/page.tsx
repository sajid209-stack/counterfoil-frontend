"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { Avatar, PageShell, useToast } from "@/components/ui";
import { LanguagePicker } from "@/components/LocaleProvider";
import { useApiQuery } from "@/lib/useApi";
import { getStaff, listCounters, listLocations, listRoles, updateStaff } from "@/lib/api";
import { DEMO_STAFF_ID } from "@/lib/session";
import { formatDay } from "@/lib/format";
import { RecordFacts, SaveBar, SectionSkeleton, SettingRow, SettingsSection, controlCls } from "../_components/SettingsKit";

interface Draft {
  name: string;
  email: string;
  phone: string;
}

/**
 * My profile — the person, not the business.
 *
 * It existed, at `/profile`, and three things were wrong with it. It was
 * **unreachable from OS**: nothing in the shell or in Settings linked to it,
 * while the till's More sheet did — which threw a cashier into the admin app,
 * sidebar and all. It kept its own **hardcoded list of devices** beside the
 * real one Security already shows, so "where am I signed in" had two answers.
 * And it kept its own copy of the signed-in staff id, which is the thing
 * `lib/session` exists to stop.
 *
 * So it moved here, under Your account, beside Security and Preferences — the
 * group that is already about the person rather than the business — and the
 * till keeps a profile of its own shape at `/profile`.
 *
 * One thing per place: this holds who you are and where you work; passwords,
 * two-step and sessions are Security's, and it says so rather than drawing a
 * second version of them.
 */
export default function MyProfilePage() {
  const t = useTranslations("settings");
  const toast = useToast();
  const meQ = useApiQuery(() => getStaff(DEMO_STAFF_ID), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const countersQ = useApiQuery(() => listCounters({ pageSize: 100 }), []);
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const me = meQ.data;
  if (!me) {
    return (
      <PageShell title={t("profile.title")} description={t("profile.description")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  const saved: Draft = { name: me.name, email: me.email ?? "", phone: me.phone ?? "" };
  const form = draft ?? saved;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch: Partial<Draft>) => setDraft({ ...form, ...patch });
  const nameError = form.name.trim() ? undefined : t("profile.nameRequired");

  const named = (ids: string[] | undefined, all: { id: string; name: string }[]) =>
    (ids ?? []).map((id) => all.find((x) => x.id === id)?.name ?? id).join(" · ") || "—";

  const save = async () => {
    if (nameError) return;
    setSaving(true);
    const res = await updateStaff(DEMO_STAFF_ID, {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setDraft(null);
    meQ.reload();
    toast.success(t("profile.saved"));
  };

  const role = rolesQ.data?.data.find((r) => r.id === me.roleId);

  return (
    <PageShell title={t("profile.title")} description={t("profile.description")}>
      <div className="flex flex-col gap-section">
        {/* Who this is, before what can be changed about them — the shape the
            customer record and the device record already use. */}
        <div className="card-surface flex items-center gap-section p-card">
          <Avatar name={me.name} size={56} />
          <div className="min-w-0">
            <p className="truncate text-lg font-medium">{me.name}</p>
            <p className="text-[13px] text-muted">{role?.name ?? t("profile.noRole")}</p>
          </div>
        </div>

        <RecordFacts
          label={t("profile.factsLabel")}
          facts={[
            { key: "role", label: t("profile.role"), value: role?.name ?? t("profile.noRole") },
            { key: "status", label: t("profile.status"), value: t(`profile.status_${me.status}`) },
            { key: "locations", label: t("profile.locations"), value: named(me.locationIds, locationsQ.data?.data ?? []) },
            { key: "counters", label: t("profile.counters"), value: named(me.counterIds, countersQ.data?.data ?? []) },
            { key: "since", label: t("profile.since"), value: formatDay(me.createdAt.slice(0, 10), { weekday: false }) },
          ]}
        />

        <SettingsSection title={t("profile.detailsTitle")} description={t("profile.detailsDesc")}>
          <SettingRow label={t("profile.name")} error={nameError}>
            {({ id, describedBy }) => (
              <input
                id={id}
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                aria-describedby={describedBy}
                aria-invalid={!!nameError || undefined}
                className={controlCls(!!nameError)}
              />
            )}
          </SettingRow>
          <SettingRow label={t("profile.email")} description={t("profile.emailDesc")}>
            {({ id, describedBy }) => (
              <input id={id} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} aria-describedby={describedBy} className={controlCls(false)} />
            )}
          </SettingRow>
          <SettingRow label={t("profile.phone")} description={t("profile.phoneDesc")}>
            {({ id, describedBy }) => (
              <input id={id} type="tel" inputMode="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} aria-describedby={describedBy} className={controlCls(false)} />
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={t("profile.languageTitle")} description={t("profile.languageDesc")}>
          <SettingRow label={t("profile.language")} description={t("profile.languageHelp")} labelFor={false}>
            {() => <LanguagePicker />}
          </SettingRow>
        </SettingsSection>

        {/* Not a second copy of any of it: Security owns the password, the
            two-step setting and the list of places you are signed in, and two
            lists of sessions is two answers to one question. */}
        <SettingsSection title={t("profile.securityTitle")} description={t("profile.securityDesc")}>
          <SettingRow label={t("profile.securityRow")} description={t("profile.securityRowDesc")} labelFor={false}>
            {() => (
              <Link
                href="/settings/security"
                className="inline-flex min-h-11 items-center gap-tight rounded-sm border border-line px-comfortable text-[13px] font-medium transition-colors duration-quick hover:border-strong md:min-h-9"
              >
                <ShieldCheck size={14} strokeWidth={1.5} aria-hidden />
                {t("profile.openSecurity")}
              </Link>
            )}
          </SettingRow>
        </SettingsSection>

        <SaveBar dirty={dirty} saving={saving} invalid={!!nameError} onSave={save} onDiscard={() => setDraft(null)} />
      </div>
    </PageShell>
  );
}
