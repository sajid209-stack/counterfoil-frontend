"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, FormField, Modal } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { formatClock } from "@/lib/format";
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

/** Each person's face has a colour of its own, so somebody who cannot read the
 *  names finds themselves by colour. Handed out in the order people joined
 *  this counter, so the first five never share one and a new hire takes the
 *  next colour without repainting anybody else. The five are the validated
 *  accent palette; the letters sit on a light wash of it in ink, so they read
 *  in both themes. */
const FACE_COLORS = ["orange", "blue", "green", "rose", "amber"] as const;
type FaceColor = (typeof FACE_COLORS)[number];
function faceColors(team: Staff[]): Map<string, FaceColor> {
  const ordered = [...team].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return new Map(ordered.map((s, i) => [s.id, FACE_COLORS[i % FACE_COLORS.length]]));
}
function Face({ color, name, size }: { color: FaceColor; name: string; size: "lg" | "md" }) {
  const c = color;
  return (
    <span
      aria-hidden
      className={`flex items-center justify-center rounded-full border-2 font-semibold text-fg ${size === "lg" ? "h-12 w-12 text-[1rem]" : "h-10 w-10 text-[0.9375rem]"}`}
      style={{
        borderColor: `var(--color-cat-${c})`,
        background: `color-mix(in srgb, var(--color-cat-${c}) 22%, var(--color-card))`,
      }}
    >
      {name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}
    </span>
  );
}

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
  const colors = faceColors(team);
  const colorOf = (id: string): FaceColor => colors.get(id) ?? "orange";
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
    s.id === OPEN_SHIFT.staffId ? t("login.onShiftSince", { time: formatClock(OPEN_SHIFT.since) }) : t("login.offShift");

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
        <p className="text-[0.875rem] font-medium text-muted">
          {BUSINESS} · {COUNTER_NAME} · {DEVICE_NAME}
        </p>
        <p className="mt-inline text-[0.8125rem] text-muted">
          {shiftOwner ? t("login.shiftOpenBy", { name: shiftOwner.name.split(" ")[0], time: formatClock(OPEN_SHIFT.since) }) : t("login.noShift")}
          <span className="ml-tight text-muted">· {t("login.demoPin", { pin: DEMO_PIN })}</span>
        </p>
      </div>


      {!who ? (
        <>
          {/* Step 1 — who are you. Faster than a PIN that must also identify. */}
          <p className="mt-major text-[1rem] font-semibold text-fg">{t("login.whoTitle")}</p>
          {/* The people as cells on ONE card — the till's own drawing — each a
              face, a name and whether they are on shift. Tap yours. */}
          <div className="go-surface mt-section w-full max-w-lg overflow-hidden rounded-go">
          <div className="-mb-px -mr-px grid grid-cols-2 sm:grid-cols-3">
            {team.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setWho(s); setPin(""); setAttempts(0); setLocked(false); }}
                data-focus-inset
                className="flex min-h-32 flex-col items-center justify-center gap-tight border-b border-r border-line bg-card p-comfortable transition-colors duration-quick active:bg-ember/10"
              >
                <Face color={colorOf(s.id)} name={s.name} size="lg" />
                <span className="max-w-full truncate text-[0.9375rem] font-semibold text-fg">{s.name}</span>
                <span className={`text-[0.8125rem] ${s.id === OPEN_SHIFT.staffId ? "font-medium text-success" : "text-muted"}`}>{stateLine(s)}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSomeoneElse(true)}
              data-focus-inset
              className="flex min-h-32 flex-col items-center justify-center gap-tight border-b border-r border-line bg-card p-comfortable text-muted active:bg-ember/10"
            >
              <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-strong text-2xl leading-none">+</span>
              <span className="text-[0.9375rem] font-medium">{t("login.someoneElse")}</span>
            </button>
          </div>
          </div>
        </>
      ) : (
        <>
          {/* Step 2 — the PIN pad. */}
          <div className="mt-major flex items-center gap-tight">
            <Face color={colorOf(who.id)} name={who.name} size="md" />
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
