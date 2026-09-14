"use client";

import { useTranslations } from "next-intl";
import { KeyRound, Mail, UserCheck, UserX } from "lucide-react";
import { Button, StatusPill } from "@/components/ui";
import type { Staff } from "@/lib/api";
import { DEMO_STAFF_ID } from "@/lib/session";
import { SettingRow, SettingsSection } from "../../_components/SettingsKit";
import { useSince } from "../../_lib/time";

/**
 * Whether someone can get in, and the one thing to do about it.
 *
 * Status used to be a select — Invited / Active / Suspended — which let an
 * admin "choose" that a person had accepted an invite they had never opened.
 * A status is something that happens to a person; what an admin controls is
 * the action. So each state offers only the actions that apply to it: resend
 * an invite that is still pending, reset or suspend someone active, reactivate
 * someone suspended. You cannot suspend yourself — the button says so rather
 * than locking you out.
 */
export function AccessSection({
  member,
  busy,
  onResend,
  onReset,
  onSuspend,
  onReactivate,
}: {
  member: Staff;
  busy: boolean;
  onResend: () => void;
  onReset: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
}) {
  const t = useTranslations("settings");
  const since = useSince();
  const isYou = member.id === DEMO_STAFF_ID;
  const via = member.email ?? member.phone ?? "";
  const when = member.lastActiveAt ? since(member.lastActiveAt) : t("team.neverActive");
  const statusDesc =
    member.status === "active"
      ? t("team.activeDesc", { when })
      : member.status === "invited"
        ? t("team.invitedDesc", { via })
        : t("team.suspendedDesc");

  return (
    <SettingsSection title={t("team.accessTitle")} description={t("team.accessDesc")}>
      <SettingRow label={t("team.statusLabel")} description={statusDesc} labelFor={false}>
        {() => (
          <div className="flex sm:justify-end sm:pt-[11px]">
            <StatusPill status={member.status} />
          </div>
        )}
      </SettingRow>

      {member.status === "invited" && (
        <SettingRow label={t("team.resendLabel")} description={t("team.resendDesc")} labelFor={false}>
          {() => (
            <div className="flex sm:justify-end">
              <Button variant="secondary" icon={<Mail size={16} strokeWidth={1.5} />} onClick={onResend}>
                {t("team.resendInvite")}
              </Button>
            </div>
          )}
        </SettingRow>
      )}

      {member.status === "active" && (
        <>
          <SettingRow label={t("team.passwordLabel")} description={t("team.passwordDesc")} labelFor={false}>
            {() => (
              <div className="flex sm:justify-end">
                <Button variant="secondary" icon={<KeyRound size={16} strokeWidth={1.5} />} onClick={onReset}>
                  {t("team.sendReset")}
                </Button>
              </div>
            )}
          </SettingRow>
          {/* Not offered on your own record at all: a row whose only button
              can never be pressed is a control that says nothing. */}
          {!isYou && (
            <SettingRow label={t("team.suspendLabel")} description={t("team.suspendDesc")} labelFor={false}>
              {() => (
                <div className="flex sm:justify-end">
                  <Button variant="secondary" icon={<UserX size={16} strokeWidth={1.5} />} onClick={onSuspend} disabled={busy}>
                    {t("team.suspend")}
                  </Button>
                </div>
              )}
            </SettingRow>
          )}
        </>
      )}

      {member.status === "suspended" && (
        <SettingRow label={t("team.reactivateLabel")} description={t("team.reactivateDesc")} labelFor={false}>
          {() => (
            <div className="flex sm:justify-end">
              <Button icon={<UserCheck size={16} strokeWidth={1.5} />} onClick={onReactivate} loading={busy}>
                {t("team.reactivate")}
              </Button>
            </div>
          )}
        </SettingRow>
      )}
    </SettingsSection>
  );
}
