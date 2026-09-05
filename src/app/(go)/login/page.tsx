"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, FormField, Modal } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listStaff, type Staff } from "@/lib/api";
import { Keypad } from "../_components/Keypad";

// Mock session facts: this device is paired to the Fort Main Gate counter and
// Nadia's shift has been open since 09:14. Demo PIN for everyone: 1234.
const COUNTER_ID = "cnt_fort_main";
const COUNTER_NAME = "Fort Main Gate";
const DEVICE_NAME = "Fort iPad 1";
const BUSINESS = "Lalbagh Heritage Attractions";
const OPEN_SHIFT = { staffId: "stf_nadia", since: "09:14" };
const DEMO_PIN = "1234";
const MAX_ATTEMPTS = 3;

export default function GoLoginPage() {
  const router = useRouter();
  const staffQ = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);

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
        if (n >= MAX_ATTEMPTS) setLocked(true);
      }
    }
  };

  const stateLine = (s: Staff) =>
    s.id === OPEN_SHIFT.staffId ? `On shift since ${OPEN_SHIFT.since}` : "Off";

  return (
    // Full-bleed ink — this screen is a moment, not a form.
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center bg-ink px-section py-major text-paper">
      <h1 className="sr-only">Sign in</h1>
      {/* Context bar — confirm you're on the right till before signing in. */}
      <div className="w-full max-w-lg text-center">
        <p className="font-mono text-[12px] uppercase tracking-wider text-neutral-400">
          {BUSINESS} · {COUNTER_NAME} · {DEVICE_NAME}
        </p>
        <p className="mt-inline font-mono text-[12px] text-neutral-400">
          {shiftOwner ? `Shift open — ${shiftOwner.name.split(" ")[0]}, since ${OPEN_SHIFT.since}` : "No shift open"}
          <span className="ml-tight text-neutral-600">· demo PIN {DEMO_PIN}</span>
        </p>
      </div>

      <span className="type-h2 mt-major text-2xl text-paper">Counterfoil</span>

      {!who ? (
        <>
          {/* Step 1 — who are you. Faster than a PIN that must also identify. */}
          <p className="type-label mt-major text-[12px] uppercase tracking-wide text-neutral-400">Who&apos;s signing in?</p>
          <div className="mt-section grid w-full max-w-lg grid-cols-2 gap-tight sm:grid-cols-3">
            {team.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setWho(s); setPin(""); setAttempts(0); setLocked(false); }}
                className="flex min-h-28 flex-col items-center justify-center gap-tight rounded-md border border-neutral-800 bg-neutral-900 p-comfortable transition-colors duration-quick active:border-ember"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-paper font-semibold text-ink">
                  {s.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}
                </span>
                <span className="max-w-full truncate text-sm text-paper">{s.name}</span>
                <span className={`font-mono text-[12px] ${s.id === OPEN_SHIFT.staffId ? "text-brand-foreground" : "text-neutral-600"}`}>{stateLine(s)}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSomeoneElse(true)}
              className="flex min-h-28 flex-col items-center justify-center gap-tight rounded-md border border-dashed border-neutral-800 p-comfortable text-neutral-400 active:border-ember"
            >
              <span className="text-2xl leading-none">+</span>
              <span className="text-sm">Someone else</span>
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Step 2 — the PIN pad. */}
          <div className="mt-major flex items-center gap-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-paper font-semibold text-ink">
              {who.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}
            </span>
            <span className="text-lg">{who.name}</span>
            <button type="button" onClick={() => { setWho(null); setPin(""); setAttempts(0); setLocked(false); }} className="ml-tight text-[13px] text-neutral-400 underline-offset-4 active:underline">
              Not you?
            </button>
          </div>

          <div className={`mt-section flex gap-comfortable ${shake ? "animate-[shake_0.12s_ease-in-out_0s_2]" : ""}`} aria-label={`${pin.length} of 4 digits entered`}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-4 w-4 rounded-full border-2 border-paper ${i < pin.length ? "bg-paper" : "bg-transparent"}`} />
            ))}
          </div>

          {locked ? (
            <div className="mt-section flex flex-col items-center gap-tight text-center">
              <p className="text-sm text-danger">Locked for 5 minutes. Ask a manager to unlock.</p>
              <Button variant="secondary" onClick={() => { setLocked(false); setAttempts(0); setPin(""); }}>Manager override</Button>
            </div>
          ) : (
            attempts > 0 && (
              <p className="mt-tight text-[13px] text-danger">
                PIN not recognised. {MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts === 1 ? "" : "s"} left.
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
        title={`Take over from ${shiftOwner?.name.split(" ")[0] ?? "the current shift"}?`}
        footer={<><Button variant="secondary" onClick={() => { setTakeOver(false); setPin(""); }}>Cancel</Button><Button onClick={() => router.push("/pos")}>Take over shift</Button></>}
      >
        <p className="text-sm text-muted">
          The drawer and its sales stay attributed to {shiftOwner?.name ?? "the previous person"} up to this point. From here, everything records under {who?.name}.
        </p>
      </Modal>

      {/* Someone else — staff not assigned to this counter. */}
      <Modal
        open={someoneElse}
        onClose={() => setSomeoneElse(false)}
        title="Sign in — someone else"
        footer={<><Button variant="secondary" onClick={() => setSomeoneElse(false)}>Cancel</Button><Button disabled={!guestName.trim()} onClick={() => { setWho({ id: "guest", name: guestName.trim() }); setSomeoneElse(false); setPin(""); setAttempts(0); setLocked(false); }}>Continue</Button></>}
      >
        <div className="flex flex-col gap-section">
          <FormField label="Name" placeholder="Full name" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          <FormField label="Email" placeholder="name@business.example" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} help="For staff not assigned to this counter." />
        </div>
      </Modal>
    </main>
  );
}
