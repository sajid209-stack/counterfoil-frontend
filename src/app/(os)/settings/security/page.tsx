"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CircleAlert,
  Copy,
  LogOut,
  Monitor,
  ShieldCheck,
  Smartphone,
  Tablet,
  type LucideIcon,
} from "lucide-react";
import { Button, ConfirmDialog, Modal, PageShell, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { getAccessPolicy, listRoles, listStaff } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { DEMO_STAFF_ID } from "@/lib/session";
import { IconTile, SettingRow, SettingsSection, Switch, controlCls } from "../_components/SettingsKit";
import { twoStepApplies } from "../_lib/access";
import { useSince } from "../_lib/time";

const MOCK_SIGNINS = [
  { at: "2026-07-29T09:05:00", where: "Fort iPad 1 · Dhaka", ok: true },
  { at: "2026-07-28T18:40:00", where: "Chrome on Windows · Dhaka", ok: true },
  { at: "2026-07-28T07:12:00", where: "Unknown device · Chattogram", ok: false },
];

interface Session {
  id: string;
  device: string;
  place: string;
  kind: "desktop" | "tablet" | "phone";
  lastActiveAt: string;
  current?: boolean;
}

/* Where this account is signed in right now. The sign-in log answers "was that
   me?"; this answers "where am I still signed in?" — the question someone asks
   after losing a phone, and the only one of the two they can act on, one place
   at a time. */
const MOCK_SESSIONS: Session[] = [
  { id: "ses_here", device: "Chrome on Windows", place: "Dhaka", kind: "desktop", lastActiveAt: "2026-07-29T12:00:00", current: true },
  { id: "ses_go", device: "Counterfoil Go · Fort iPad 1", place: "Lalbagh Fort", kind: "tablet", lastActiveAt: "2026-07-29T09:05:00" },
  { id: "ses_phone", device: "Safari on iPhone", place: "Dhaka", kind: "phone", lastActiveAt: "2026-07-27T21:40:00" },
];

const KIND_ICON: Record<Session["kind"], LucideIcon> = { desktop: Monitor, tablet: Tablet, phone: Smartphone };

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
 *
 * Where the business's Sign-in rules require two-step of your role, the section
 * says so and links there — and does not offer to switch it off, because a
 * switch that the next sign-in would turn straight back on is not a choice.
 */
export default function SecurityPage() {
  const t = useTranslations("settings");
  const toast = useToast();
  const since = useSince();
  const staffQ = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);
  const roleQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const policyQ = useApiQuery(() => getAccessPolicy(), []);

  const [pw, setPw] = useState({ current: "", next: "", repeat: "" });
  const [twoStep, setTwoStep] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [codesOpen, setCodesOpen] = useState(false);
  const [recovery, setRecovery] = useState("");
  const [email, setEmail] = useState("nadia@lalbagh.example");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [sessions, setSessions] = useState(MOCK_SESSIONS);
  const [confirmOthers, setConfirmOthers] = useState(false);

  const tooShort = pw.next.length > 0 && pw.next.length < 8;
  const mismatch = pw.repeat.length > 0 && pw.next !== pw.repeat;
  const canChange = !!pw.current && pw.next.length >= 8 && pw.next === pw.repeat;
  const managers = (staffQ.data?.data ?? []).filter((s) => s.roleId === "role_manager");
  const me = staffQ.data?.data.find((s) => s.id === DEMO_STAFF_ID);
  const myRole = roleQ.data?.data.find((r) => r.id === me?.roleId);
  const required = !!policyQ.data && !!me && !!roleQ.data && twoStepApplies(policyQ.data.twoStep, myRole);
  const others = sessions.filter((s) => !s.current);

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
          <div className="flex justify-end px-card py-section">
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
          {required && (
            <div className="px-card py-section">
              <div className="flex flex-col gap-tight rounded-sm border border-line bg-subtle/60 p-comfortable text-[13px] leading-relaxed sm:flex-row sm:items-center sm:justify-between sm:gap-section">
                <span className="flex min-w-0 items-start gap-tight">
                  <ShieldCheck size={16} strokeWidth={1.5} aria-hidden className="mt-[2px] shrink-0 text-muted" />
                  <span>
                    <span className="block font-medium text-fg">{t("security.requiredBy")}</span>
                    <span className={cn("block", twoStep ? "text-muted" : "text-warning")}>
                      {twoStep ? t("security.requiredOn") : t("security.requiredOff")}
                    </span>
                  </span>
                </span>
                <Link
                  href="/settings/sign-in"
                  className="inline-flex min-h-11 shrink-0 items-center gap-inline self-start rounded-sm font-medium text-fg underline-offset-2 hover:underline sm:self-center md:min-h-9"
                >
                  {t("security.requiredLink")}
                  <ArrowRight size={14} strokeWidth={1.5} aria-hidden />
                </Link>
              </div>
            </div>
          )}
          <SettingRow label={t("security.twoStepLabel")} labelFor={false}>
            {({ labelId, describedBy }) => (
              <div className="flex sm:justify-end">
                <Switch
                  checked={twoStep}
                  disabled={required && twoStep}
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
            <div className="px-card py-section" role="status">
              <div className="flex flex-col gap-section rounded-sm border border-warning/30 bg-warning-wash p-comfortable text-[13px] text-fg sm:flex-row sm:items-center sm:justify-between">
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
          title={t("security.sessionsTitle")}
          description={t("security.sessionsDesc")}
          aside={
            others.length > 0 ? (
              <Button variant="secondary" size="sm" icon={<LogOut size={14} strokeWidth={1.5} />} onClick={() => setConfirmOthers(true)}>
                {t("security.signOutOthers")}
              </Button>
            ) : undefined
          }
        >
          <ul className="divide-y divide-hairline">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-section px-card py-comfortable">
                <IconTile icon={KIND_ICON[s.kind]} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-tight gap-y-inline">
                    <span className="text-sm font-medium text-fg">{s.device}</span>
                    {s.current && (
                      <span className="rounded-xs border border-line px-inline text-[12px] font-medium text-muted">{t("security.thisBrowser")}</span>
                    )}
                  </span>
                  <span className="mt-inline block text-[13px] text-muted">
                    {t("security.sessionMeta", { place: s.place, since: s.current ? t("security.activeNow") : since(s.lastActiveAt) })}
                  </span>
                </span>
                {/* No sign-out on the session you are using: that is the Sign
                    out in the account menu, and doing it from here would end the
                    page mid-sentence. */}
                {!s.current && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSessions((all) => all.filter((x) => x.id !== s.id));
                      toast.success(t("security.signedOutOne", { device: s.device }));
                    }}
                  >
                    {t("security.signOut")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </SettingsSection>

        <SettingsSection title={t("security.recentSignins")} description={t("security.signinsDesc")}>
          <ul className="divide-y divide-hairline">
            {MOCK_SIGNINS.map((s) => (
              <li key={s.at} className="flex items-center gap-section px-card py-comfortable">
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

      <ConfirmDialog
        open={confirmOthers}
        onClose={() => setConfirmOthers(false)}
        onConfirm={() => {
          setSessions((all) => all.filter((s) => s.current));
          setConfirmOthers(false);
          toast.success(t("security.signedOutOthers"));
        }}
        title={t("security.signOutOthersTitle")}
        message={t("security.signOutOthersBody", { count: others.length })}
        confirmLabel={t("security.signOutOthers")}
      />
    </PageShell>
  );
}
