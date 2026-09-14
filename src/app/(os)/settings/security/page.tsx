"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CircleAlert, Copy, LogOut } from "lucide-react";
import { Button, Modal, PageShell, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { listStaff } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { SettingRow, SettingsSection, Switch, controlCls } from "../_components/SettingsKit";

const MOCK_SIGNINS = [
  { at: "2026-07-29T09:05:00", where: "Fort iPad 1 · Dhaka", ok: true },
  { at: "2026-07-28T18:40:00", where: "Chrome on Windows · Dhaka", ok: true },
  { at: "2026-07-28T07:12:00", where: "Unknown device · Chattogram", ok: false },
];

const genCodes = () =>
  Array.from({ length: 8 }, () => `${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase());

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Your security — the person's, not the business's.
 *
 * Same anatomy as every other settings page now: what the setting is on the
 * left, the control on the right. It had its own dialect before — three
 * password boxes in a row under uppercase labels, a bare browser select, and a
 * sign-in log in monospace with a fixed-width date column that pushed the device
 * name into a truncation on a phone.
 *
 * Password change is a deliberate action, not a draft: it has its own button
 * and never appears in a save bar, because "discard your new password" is not a
 * thing anyone wants offered to them.
 */
export default function SecurityPage() {
  const t = useTranslations("settings");
  const toast = useToast();
  const staffQ = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);

  const [pw, setPw] = useState({ current: "", next: "", repeat: "" });
  const [twoStep, setTwoStep] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [codesOpen, setCodesOpen] = useState(false);
  const [recovery, setRecovery] = useState("");
  const [email, setEmail] = useState("nadia@lalbagh.example");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");

  const tooShort = pw.next.length > 0 && pw.next.length < 8;
  const mismatch = pw.repeat.length > 0 && pw.next !== pw.repeat;
  const canChange = !!pw.current && pw.next.length >= 8 && pw.next === pw.repeat;
  const managers = (staffQ.data?.data ?? []).filter((s) => s.roleId === "role_manager");

  const makeCodes = () => {
    setCodes(genCodes());
    setCodesOpen(true);
  };

  return (
    <PageShell title={t("security.title")} description={t("security.description")}>
      <div className="flex max-w-3xl flex-col gap-section pb-hero">
        <SettingsSection title={t("security.password")} description={t("security.passwordDesc")}>
          <SettingRow label={t("security.current")}>
            {({ id }) => (
              <input
                id={id}
                type="password"
                autoComplete="current-password"
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
                className={controlCls()}
              />
            )}
          </SettingRow>
          <SettingRow label={t("security.new")} description={t("security.newDesc")} error={tooShort ? t("security.pwTooShort") : undefined}>
            {({ id, describedBy }) => (
              <input
                id={id}
                type="password"
                autoComplete="new-password"
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
                aria-invalid={tooShort || undefined}
                aria-describedby={describedBy}
                className={controlCls(tooShort)}
              />
            )}
          </SettingRow>
          <SettingRow label={t("security.repeatNew")} error={mismatch ? t("security.noMatch") : undefined}>
            {({ id, describedBy }) => (
              <input
                id={id}
                type="password"
                autoComplete="new-password"
                value={pw.repeat}
                onChange={(e) => setPw({ ...pw, repeat: e.target.value })}
                aria-invalid={mismatch || undefined}
                aria-describedby={describedBy}
                className={controlCls(mismatch)}
              />
            )}
          </SettingRow>
          <div className="flex justify-end px-major py-section">
            <Button
              disabled={!canChange}
              onClick={() => {
                setPw({ current: "", next: "", repeat: "" });
                toast.success(t("security.passwordChanged"));
              }}
            >
              {t("security.changePassword")}
            </Button>
          </div>
        </SettingsSection>

        <SettingsSection title={t("security.twoStep")} description={t("security.twoStepHelp")}>
          <SettingRow label={t("security.twoStepLabel")} labelFor={false}>
            {({ labelId, describedBy }) => (
              <div className="flex sm:justify-end">
                <Switch
                  checked={twoStep}
                  onChange={(on) => {
                    setTwoStep(on);
                    // Turning it on without a way back in is how people lock
                    // themselves out, so the codes arrive in the same motion.
                    if (on && !codes) makeCodes();
                  }}
                  labelledBy={labelId}
                  describedBy={describedBy}
                />
              </div>
            )}
          </SettingRow>
          <SettingRow label={t("security.backupCodes")} description={t("security.backupCodesDesc")} labelFor={false}>
            {() => (
              <div className="flex flex-wrap items-center gap-tight sm:justify-end">
                {codes && <span className="text-[13px] text-muted">{t("security.codesExist")}</span>}
                <Button variant="secondary" onClick={makeCodes}>
                  {codes ? t("security.regenerateCodes") : t("security.generateCodes")}
                </Button>
              </div>
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={t("security.email")} description={t("security.emailDesc")}>
          {pendingEmail ? (
            <div className="px-major py-section" role="status">
              <div className="flex flex-col gap-section rounded-sm border border-warning/30 bg-warning-wash p-section text-[13px] text-fg sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-start gap-tight">
                  <CircleAlert size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-warning" />
                  {t("security.emailPending", { email: pendingEmail, current: email })}
                </span>
                <span className="flex shrink-0 gap-tight">
                  <Button variant="secondary" size="sm" onClick={() => setPendingEmail(null)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEmail(pendingEmail);
                      setPendingEmail(null);
                      toast.success(t("security.emailConfirmed"));
                    }}
                  >
                    {t("security.demoConfirm")}
                  </Button>
                </span>
              </div>
            </div>
          ) : (
            <SettingRow label={t("security.currentEmail", { email })} description={t("security.emailChangeHelp")}>
              {({ id, describedBy }) => (
                <div className="flex gap-tight">
                  <input
                    id={id}
                    type="email"
                    autoComplete="email"
                    placeholder={t("security.newEmailPlaceholder")}
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    aria-describedby={describedBy}
                    className={controlCls()}
                  />
                  <Button
                    variant="secondary"
                    disabled={!EMAIL.test(emailDraft)}
                    onClick={() => {
                      setPendingEmail(emailDraft);
                      setEmailDraft("");
                    }}
                  >
                    {t("security.change")}
                  </Button>
                </div>
              )}
            </SettingRow>
          )}
        </SettingsSection>

        <SettingsSection title={t("security.recovery")} description={t("security.recoveryNote")}>
          <SettingRow label={t("security.recoveryWho")}>
            {({ id }) => (
              <select
                id={id}
                value={recovery}
                onChange={(e) => {
                  setRecovery(e.target.value);
                  if (e.target.value) toast.success(t("security.recoverySet"));
                }}
                className={cn(controlCls(), "pr-section")}
              >
                <option value="">{t("security.noRecovery")}</option>
                {managers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection
          title={t("security.recentSignins")}
          description={t("security.signinsDesc")}
          aside={
            <Button variant="secondary" size="sm" icon={<LogOut size={14} strokeWidth={1.5} />} onClick={() => toast.success(t("security.signedOutAll"))}>
              {t("security.signOutAll")}
            </Button>
          }
        >
          <ul className="divide-y divide-hairline">
            {MOCK_SIGNINS.map((s) => (
              <li key={s.at} className="flex items-center gap-section px-major py-comfortable">
                {/* The outcome is said in words on the right; the dot only
                    helps the eye find the failed one in a longer list. */}
                <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", s.ok ? "bg-success" : "bg-danger")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-fg">{s.where}</span>
                  <span className="mt-inline block text-[13px] text-muted">{formatDateTime(s.at)}</span>
                </span>
                <span className={cn("shrink-0 text-[13px] font-medium", s.ok ? "text-muted" : "text-danger")}>
                  {s.ok ? t("security.ok") : t("security.failed")}
                </span>
              </li>
            ))}
          </ul>
        </SettingsSection>
      </div>

      {/* Backup codes — shown ONCE. */}
      <Modal
        open={codesOpen}
        onClose={() => setCodesOpen(false)}
        title={t("security.codesTitle")}
        footer={<Button onClick={() => setCodesOpen(false)}>{t("security.codesSaved")}</Button>}
      >
        <p className="mb-section text-[13px] text-muted">{t("security.codesNote")}</p>
        <div className="grid grid-cols-2 gap-tight rounded-sm border border-line bg-subtle p-comfortable font-mono text-[13px]">
          {(codes ?? []).map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mt-section"
          icon={<Copy size={14} strokeWidth={1.5} />}
          onClick={() => {
            navigator.clipboard.writeText((codes ?? []).join("\n"));
            toast.success(t("security.copied"));
          }}
        >
          {t("security.copyAll")}
        </Button>
      </Modal>
    </PageShell>
  );
}
