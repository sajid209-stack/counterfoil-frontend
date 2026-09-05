"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy } from "lucide-react";
import { Button, FormField, Modal, PageShell, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listStaff } from "@/lib/api";

const MOCK_SIGNINS = [
  { at: "2026-07-29 09:05", where: "Fort iPad 1 · Dhaka", ok: true },
  { at: "2026-07-28 18:40", where: "Chrome on Windows · Dhaka", ok: true },
  { at: "2026-07-28 07:12", where: "Unknown device · Chattogram", ok: false },
];

const genCodes = () => Array.from({ length: 8 }, () => Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase());

// Per-user security: password, two-step, backup codes (shown once), sessions,
// the recovery contact, and the email pending-change state.
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

  const card = "card-surface p-major";

  const makeCodes = () => {
    setCodes(genCodes());
    setCodesOpen(true);
  };

  return (
    <PageShell title={t("security.title")} description={t("security.description")}>
      <div className="flex max-w-3xl flex-col gap-section">
        <div className={card}>
          <h2 className="type-h2 mb-section text-base">{t("security.password")}</h2>
          <div className="grid gap-section sm:grid-cols-3">
            <FormField label={t("security.current")} variant="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            <FormField label={t("security.new")} variant="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <FormField label={t("security.repeatNew")} variant="password" value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} error={pw.repeat && pw.next !== pw.repeat ? t("security.noMatch") : undefined} />
          </div>
          <Button className="mt-section" disabled={!pw.current || pw.next.length < 8 || pw.next !== pw.repeat} onClick={() => { setPw({ current: "", next: "", repeat: "" }); toast.success(t("security.passwordChanged")); }}>{t("security.changePassword")}</Button>
        </div>

        <div className={card}>
          <h2 className="type-h2 mb-section text-base">{t("security.twoStep")}</h2>
          <FormField label={t("security.twoStepLabel")} variant="toggle" checked={twoStep} onChange={(e) => { const on = (e.target as HTMLInputElement).checked; setTwoStep(on); if (on && !codes) makeCodes(); }} help={t("security.twoStepHelp")} />
          <div className="mt-section flex items-center gap-tight">
            <Button variant="secondary" size="sm" onClick={makeCodes}>{codes ? t("security.regenerateCodes") : t("security.generateCodes")}</Button>
            {codes && <span className="text-[12px] text-faint">{t("security.codesExist")}</span>}
          </div>
        </div>

        <div className={card}>
          <h2 className="type-h2 mb-section text-base">{t("security.email")}</h2>
          {pendingEmail ? (
            <div className="rounded-sm border border-line border-l-[3px] border-l-ember bg-subtle p-comfortable text-[13px]">
              {t("security.emailPending", { email: pendingEmail, current: email })}
              <button type="button" onClick={() => { setEmail(pendingEmail); setPendingEmail(null); toast.success(t("security.emailConfirmed")); }} className="ml-tight text-ember underline-offset-4 hover:underline">{t("security.demoConfirm")}</button>
              <button type="button" onClick={() => setPendingEmail(null)} className="ml-tight text-faint hover:text-danger">{t("common.cancel")}</button>
            </div>
          ) : (
            <div className="flex items-end gap-tight">
              <FormField label={t("security.currentEmail", { email })} placeholder={t("security.newEmailPlaceholder")} value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} className="flex-1" help={t("security.emailChangeHelp")} />
              <Button variant="secondary" disabled={!emailDraft.includes("@")} onClick={() => { setPendingEmail(emailDraft); setEmailDraft(""); }}>{t("security.change")}</Button>
            </div>
          )}
        </div>

        <div className={card}>
          <h2 className="type-h2 mb-section text-base">{t("security.recovery")}</h2>
          <p className="mb-section text-[13px] text-muted">
            {t("security.recoveryNote")}
          </p>
          <select aria-label={t("security.recovery")} value={recovery} onChange={(e) => { setRecovery(e.target.value); if (e.target.value) toast.success(t("security.recoverySet")); }} className="h-11 w-full max-w-sm rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse">
            <option value="">{t("security.noRecovery")}</option>
            {(staffQ.data?.data ?? []).filter((s) => s.roleId === "role_manager").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className={card}>
          <h2 className="type-h2 mb-section text-base">{t("security.recentSignins")}</h2>
          {MOCK_SIGNINS.map((s, i) => (
            <div key={i} className="flex h-10 items-center gap-section border-b border-line text-[13px] last:border-0">
              <span className="w-36 shrink-0 font-mono text-[12px] tabular-nums text-muted">{s.at}</span>
              <span className="min-w-0 flex-1 truncate">{s.where}</span>
              <span className={`font-mono text-[12px] ${s.ok ? "text-success" : "text-danger"}`}>{s.ok ? t("security.ok") : t("security.failed")}</span>
            </div>
          ))}
          <Button variant="secondary" className="mt-section" onClick={() => toast.success(t("security.signedOutAll"))}>{t("security.signOutAll")}</Button>
        </div>
      </div>

      {/* Backup codes — shown ONCE. */}
      <Modal open={codesOpen} onClose={() => setCodesOpen(false)} title={t("security.codesTitle")} footer={<Button onClick={() => setCodesOpen(false)}>{t("security.codesSaved")}</Button>}>
        <p className="mb-section text-[13px] text-muted">{t("security.codesNote")}</p>
        <div className="grid grid-cols-2 gap-tight rounded-sm border border-line bg-subtle p-comfortable font-mono text-[13px] tabular-nums">
          {(codes ?? []).map((c) => <span key={c}>{c}</span>)}
        </div>
        <Button variant="secondary" size="sm" className="mt-section" icon={<Copy size={14} strokeWidth={1.5} />} onClick={() => { navigator.clipboard.writeText((codes ?? []).join("\n")); toast.success(t("security.copied")); }}>{t("security.copyAll")}</Button>
      </Modal>
    </PageShell>
  );
}
