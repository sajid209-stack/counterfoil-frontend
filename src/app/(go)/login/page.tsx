"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Avatar, Button, FormField, Modal } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getAccessPolicy, listStaff, type Staff } from "@/lib/api";
import { Keypad } from "../_components/Keypad";

// Mock session facts: this device is paired to the Fort Main Gate counter and
// Nadia's shift has been open since 09:14. Demo PIN for everyone: 1234.
const COUNTER_ID = "cnt_fort_main";
const COUNTER_NAME = "Fort Main Gate";
const DEVICE_NAME = "Fort iPad 1";
const BUSINESS = "Lalbagh Heritage Attractions";
const OPEN_SHIFT = { staffId: "stf_nadia", since: "09:14" };
const DEMO_PIN = "1234";

export default function GoLoginPage() {
  const router = useRouter();
  const t = useTranslations("pos");
  const staffQ = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);
  // How many wrong PINs before the pause is the business's call, made in
  // Settings → Sign-in rules; three until that answer arrives.
  const policyQ = useApiQuery(() => getAccessPolicy(), []);
  const maxAttempts = policyQ.data?.pinAttempts ?? 3;

  const [who, setWho] = useState<Staff | { id: "guest"; name: string } | null>(null);
  const [pin, setPin] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [shake, setShake] = useState(false);
  const [locked, setLocked] = useState(false);
  const [takeOver, setTakeOver] = useState(false);
  const [someoneElse, setSomeoneElse] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  const team = (staffQ.data?.data ?? []).filter((s) => s.counterIds.includes(COUNTER_ID));
  const shiftOwner = staffQ.data?.data.find((s) => s.id === OPEN_SHIFT.staffId);

  const proceed = (person: NonNullable<typeof who>) => {
    if (OPEN_SHIFT.staffId && person.id !== OPEN_SHIFT.staffId) setTakeOver(true);
    else router.push(person.id === OPEN_SHIFT.staffId ? "/pos" : "/shift/open");
  };

  const onKey = (d: string) => {
    if (locked || !who) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      if (next === DEMO_PIN) {
        setAttempts(0);
        setTimeout(() => proceed(who), 150);
      } else {
        // Wrong PIN: shake once, clear, count down — the selection is kept.
        const n = attempts + 1;
        setAttempts(n);
        setShake(true);
        setTimeout(() => { setShake(false); setPin(""); }, 200);
        if (n >= maxAttempts) setLocked(true);
      }
    }
  };

  const stateLine = (s: Staff) =>
    s.id === OPEN_SHIFT.staffId ? t("login.onShiftSince", { time: OPEN_SHIFT.since }) : t("login.offShift");

  return (
    /* Full-bleed and quiet — this screen is a moment, not a form. It used to
       be hardcoded ink, which was fine while the app had one appearance and
       wrong the moment it had two: a dark sign-in sat inside light chrome and
       read as a rendering fault. Semantic tokens now, like everything except
       the two surfaces that are mode-locked on purpose (a scan verdict and the
       ticket stub). */
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center bg-surface px-section py-major text-fg">
      <h1 className="sr-only">{t("signInTitle")}</h1>
      {/* Context bar — confirm you're at the right counter before signing in. */}
      <div className="w-full max-w-lg text-center">
        <p className="font-mono text-[0.8125rem] uppercase tracking-wider text-muted">
          {BUSINESS} · {COUNTER_NAME} · {DEVICE_NAME}
        </p>
        <p className="mt-inline font-mono text-[0.8125rem] text-muted">
          {shiftOwner ? t("login.shiftOpenBy", { name: shiftOwner.name.split(" ")[0], time: OPEN_SHIFT.since }) : t("login.noShift")}
          <span className="ml-tight text-muted">· {t("login.demoPin", { pin: DEMO_PIN })}</span>
        </p>
      </div>

      <span className="type-h2 mt-major text-2xl text-fg">Counterfoil</span>

      {!who ? (
        <>
          {/* Step 1 — who are you. Faster than a PIN that must also identify. */}
          <p className="type-label mt-major text-[0.8125rem] uppercase tracking-wide text-muted">{t("login.whoTitle")}</p>
          <div className="mt-section grid w-full max-w-lg grid-cols-2 gap-tight sm:grid-cols-3">
            {team.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setWho(s); setPin(""); setAttempts(0); setLocked(false); }}
                className="flex min-h-28 flex-col items-center justify-center gap-tight rounded-go border border-line bg-card p-comfortable transition-colors duration-quick active:border-ember"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-inverse font-semibold text-inverse-fg">
                  {s.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}
                </span>
                <span className="max-w-full truncate text-sm text-fg">{s.name}</span>
                <span className={`font-mono text-[0.8125rem] ${s.id === OPEN_SHIFT.staffId ? "text-brand-foreground" : "text-muted"}`}>{stateLine(s)}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSomeoneElse(true)}
              className="flex min-h-28 flex-col items-center justify-center gap-tight rounded-go border border-dashed border-line p-comfortable text-muted active:border-ember"
            >
              <span aria-hidden className="text-2xl leading-none">+</span>
              <span className="text-sm">{t("login.someoneElse")}</span>
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Step 2 — the PIN pad. */}
          <div className="mt-major flex items-center gap-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-inverse font-semibold text-inverse-fg">
              {who.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}
            </span>
            <span className="text-lg">{who.name}</span>
            <button type="button" onClick={() => { setWho(null); setPin(""); setAttempts(0); setLocked(false); }} className="ml-tight text-[0.8125rem] text-muted underline-offset-4 active:underline">
              {t("login.notYou")}
            </button>
          </div>

          <div className={`mt-section flex gap-comfortable ${shake ? "animate-[shake_0.12s_ease-in-out_0s_2]" : ""}`} role="img" aria-label={t("login.pinProgress", { count: pin.length })}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-4 w-4 rounded-full border-2 border-fg ${i < pin.length ? "bg-fg" : "bg-transparent"}`} />
            ))}
          </div>

          {locked ? (
            <div className="mt-section flex flex-col items-center gap-tight text-center">
              <p className="text-sm text-danger">{t("login.locked")}</p>
              <Button shape="pill" variant="secondary" onClick={() => { setLocked(false); setAttempts(0); setPin(""); }}>{t("login.managerUnlock")}</Button>
            </div>
          ) : (
            attempts > 0 && (
              <p className="mt-tight text-[0.8125rem] text-danger">
                {t("login.wrongPin", { left: maxAttempts - attempts })}
              </p>
            )
          )}

          <div className="mt-section w-full max-w-xs">
            <Keypad large onKey={onKey} onBackspace={() => setPin((p) => p.slice(0, -1))} />
          </div>
        </>
      )}

      {/* Take over an open shift — the drawer stays attributed until now. */}
      <Modal
        open={takeOver}
        onClose={() => setTakeOver(false)}
        title={t("login.takeOverTitle", { name: shiftOwner?.name.split(" ")[0] ?? t("login.takeOverFallback") })}
        footer={<><Button shape="pill" variant="secondary" onClick={() => { setTakeOver(false); setPin(""); }}>{t("login.cancel")}</Button><Button shape="pill" onClick={() => router.push("/pos")}>{t("login.takeOver")}</Button></>}
      >
        <p className="text-sm text-muted">
          {t("login.takeOverBody", { from: shiftOwner?.name ?? t("login.takeOverFallback"), to: who?.name ?? "" })}
        </p>
      </Modal>

      {/* Someone else — staff not assigned to this counter. */}
      <Modal
        open={someoneElse}
        onClose={() => setSomeoneElse(false)}
        title={t("login.someoneElseTitle")}
        footer={<><Button shape="pill" variant="secondary" onClick={() => setSomeoneElse(false)}>{t("login.cancel")}</Button><Button shape="pill" disabled={!guestName.trim()} onClick={() => { setWho({ id: "guest", name: guestName.trim() }); setSomeoneElse(false); setPin(""); setAttempts(0); setLocked(false); }}>{t("login.continue")}</Button></>}
      >
        <div className="flex flex-col gap-section">
          <FormField label={t("login.name")} placeholder={t("login.namePlaceholder")} value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          <FormField label={t("login.email")} placeholder="name@business.example" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} help={t("login.emailHelp")} />
        </div>
      </Modal>
    </main>
  );
}
