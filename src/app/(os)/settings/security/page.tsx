"use client";

import { useState } from "react";
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

  const card = "rounded-md border border-line bg-card p-major";

  const makeCodes = () => {
    setCodes(genCodes());
    setCodesOpen(true);
  };

  return (
    <PageShell title="Security" description="Password, two-step login, backup codes and recovery — per user.">
      <div className="flex max-w-3xl flex-col gap-section">
        <div className={card}>
          <h2 className="type-h2 mb-section text-base">Password</h2>
          <div className="grid gap-section sm:grid-cols-3">
            <FormField label="Current" variant="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            <FormField label="New" variant="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <FormField label="Repeat new" variant="password" value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} error={pw.repeat && pw.next !== pw.repeat ? "Doesn't match." : undefined} />
          </div>
          <Button className="mt-section" disabled={!pw.current || pw.next.length < 8 || pw.next !== pw.repeat} onClick={() => { setPw({ current: "", next: "", repeat: "" }); toast.success("Password changed."); }}>Change password</Button>
        </div>

        <div className={card}>
          <h2 className="type-h2 mb-section text-base">Two-step login</h2>
          <FormField label="Require a code as well as a password" variant="toggle" checked={twoStep} onChange={(e) => { const on = (e.target as HTMLInputElement).checked; setTwoStep(on); if (on && !codes) makeCodes(); }} help="A code from an authenticator app is asked for on new devices." />
          <div className="mt-section flex items-center gap-tight">
            <Button variant="secondary" size="sm" onClick={makeCodes}>{codes ? "Regenerate backup codes" : "Generate backup codes"}</Button>
            {codes && <span className="text-[12px] text-faint">Codes exist — regenerating voids the old ones.</span>}
          </div>
        </div>

        <div className={card}>
          <h2 className="type-h2 mb-section text-base">Email</h2>
          {pendingEmail ? (
            <div className="rounded-sm border border-line border-l-[3px] border-l-ember bg-subtle p-comfortable text-[13px]">
              Change to <span className="font-medium">{pendingEmail}</span> pending — confirmation sent to the current address ({email}).
              <button type="button" onClick={() => { setEmail(pendingEmail); setPendingEmail(null); toast.success("Email confirmed and changed."); }} className="ml-tight text-ember underline-offset-4 hover:underline">(demo: confirm)</button>
              <button type="button" onClick={() => setPendingEmail(null)} className="ml-tight text-faint hover:text-danger">Cancel</button>
            </div>
          ) : (
            <div className="flex items-end gap-tight">
              <FormField label={`Current: ${email}`} placeholder="new@address.example" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} className="flex-1" help="Changing it requires confirmation from the current address." />
              <Button variant="secondary" disabled={!emailDraft.includes("@")} onClick={() => { setPendingEmail(emailDraft); setEmailDraft(""); }}>Change</Button>
            </div>
          )}
        </div>

        <div className={card}>
          <h2 className="type-h2 mb-section text-base">Recovery contact</h2>
          <p className="mb-section text-[13px] text-muted">
            If the owner is locked out — a lost phone, a left employee, a forgotten password —
            this person can restore access. Pick someone you trust with the business.
          </p>
          <select value={recovery} onChange={(e) => { setRecovery(e.target.value); if (e.target.value) toast.success("Recovery contact set."); }} className="h-11 w-full max-w-sm rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse">
            <option value="">No recovery contact</option>
            {(staffQ.data?.data ?? []).filter((s) => s.roleId === "role_manager").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className={card}>
          <h2 className="type-h2 mb-section text-base">Recent sign-ins</h2>
          {MOCK_SIGNINS.map((s, i) => (
            <div key={i} className="flex h-10 items-center gap-section border-b border-line text-[13px] last:border-0">
              <span className="w-36 shrink-0 font-mono text-[12px] tabular-nums text-muted">{s.at}</span>
              <span className="min-w-0 flex-1 truncate">{s.where}</span>
              <span className={`font-mono text-[11px] ${s.ok ? "text-success" : "text-danger"}`}>{s.ok ? "OK" : "FAILED"}</span>
            </div>
          ))}
          <Button variant="secondary" className="mt-section" onClick={() => toast.success("Signed out everywhere. Devices will ask for the PIN or password again.")}>Sign out of all devices</Button>
        </div>
      </div>

      {/* Backup codes — shown ONCE. */}
      <Modal open={codesOpen} onClose={() => setCodesOpen(false)} title="Backup codes — save these now" footer={<Button onClick={() => setCodesOpen(false)}>I&apos;ve saved them</Button>}>
        <p className="mb-section text-[13px] text-muted">Each code works once, when you can&apos;t use your authenticator. They will not be shown again.</p>
        <div className="grid grid-cols-2 gap-tight rounded-sm border border-line bg-subtle p-comfortable font-mono text-[13px] tabular-nums">
          {(codes ?? []).map((c) => <span key={c}>{c}</span>)}
        </div>
        <Button variant="secondary" size="sm" className="mt-section" icon={<Copy size={14} strokeWidth={1.5} />} onClick={() => { navigator.clipboard.writeText((codes ?? []).join("\n")); toast.success("Copied."); }}>Copy all</Button>
      </Modal>
    </PageShell>
  );
}
